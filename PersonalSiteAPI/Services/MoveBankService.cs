﻿using Amazon.SecretsManager;
using Amazon.SecretsManager.Extensions.Caching;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.WebUtilities;
using PersonalSiteAPI.DTO;
using PersonalSiteAPI.Extensions;
using Amazon.SecretsManager.Model;
using System.Text.Json;
using System.Globalization;
using System.Security.Cryptography;
using System.Collections.Immutable;
using Microsoft.IdentityModel.Tokens;
using PersonalSiteAPI.Models;
using Microsoft.EntityFrameworkCore;
using Mapster;
using MapsterMapper;

namespace PersonalSiteAPI.Services
{
    public interface IMoveBankService
    {
        Task<ApiTokenResultDTO?> GetApiToken();
        DateTime? GetDateTime(string dateString, string timeZone = "CET");
        // Direct and Json request must specify an entity_type
        // Some entities are "individual, tag_type ,study"
        Task<HttpResponseMessage?> DirectRequest(
            string entityType,
            Dictionary<string, string?>? parameters = null,
            (string, string)[]? headers = null,
            bool authorizedUser = false
            );
        Task<HttpResponseMessage> JsonRequest(
            long studyId,
            string entityType,
            Dictionary<string, string?>? parameters = null,
            (string, string)[]? headers = null,
            bool authorizedUser = false);
        // Paremeters are required for json requests
        Task<HttpResponseMessage> JsonEventData(
            long studyId,
            string sensorType,
            ImmutableArray<string> individualLocalIdentifiers,
            Dictionary<string, string?>? parameters,
            string? eventProfile = null,
            (string, string)[]? headers = null,
            bool authorizedUser = false);

        //Task<bool> GetPermission(long studyId, string entityType = "individual");

        //Task<HttpResponseMessage> GetPermissionForDirectRead(
        //    HttpRequestMessage oldRequest,
        //    HttpResponseMessage oldResponse);
    }
    public class MoveBankService : IMoveBankService
    {
        private readonly HttpClient _httpClient;
        private readonly IConfiguration _configuration;
        private readonly ILogger<MoveBankService> _logger;
        private readonly IAmazonSecretsManager _amazonSecretsManager;
        private readonly IDataProtectionProvider _provider;
        private readonly ITimeLimitedDataProtector _protector;
        private readonly SecretsManagerCache _secretsCache;
        // This context will be used to post information on studies to contact 
        private readonly ApplicationDbContext _context;
        private readonly IMapper _mapper;

        public MoveBankService(
            HttpClient httpClient,
            IConfiguration configuration,
            ILogger<MoveBankService> logger,
            IAmazonSecretsManager amazonSecretsManager,
            IDataProtectionProvider provider,
            ApplicationDbContext context,
            IMapper mapper)
        {
            _httpClient = httpClient;
            _configuration = configuration;
            _logger = logger;
            _amazonSecretsManager = amazonSecretsManager;
            _provider = provider;
            _context = context;
            _mapper = mapper;

            _protector = _provider.CreateProtector("API Token").ToTimeLimitedDataProtector();
            uint durationMinutes = 1;
            _secretsCache = new SecretsManagerCache(
                _amazonSecretsManager,
                new SecretCacheConfiguration
                {
                    CacheItemTTL = durationMinutes,
                    MaxCacheSize = 1024,
                    VersionStage = "AWSCURRENT",
                    Client = _amazonSecretsManager,
                    CacheHook = new MySecretCacheHook(_protector, durationMinutes)
                });            
            //_httpClient.BaseAddress = new Uri("https://www.movebank.org/movebank/service/");

        }
        // Restrict this function
        public async Task<ApiTokenResultDTO?> GetApiToken()
        {
            // Check the cache for an existing API Token
            // TODO - Cache Implementation is working
            // Incorporate rotation/retrieval/ and insertion of keys
            // Rotate when DateTime of API key expires
            // Implement time limit for cache
            SecretCacheItem? secretCache = _secretsCache.GetCachedSecret(_configuration["ConnectionStrings:AWSKeyVault2ARN"]);
            GetSecretValueResponse? secretValue = await secretCache.GetSecretValue(new CancellationToken());

            var secretObj = JsonSerializer.Deserialize<ApiTokenResultDTO>(secretValue.SecretString)!;
            DateTime? expirationDate = GetDateTime(secretObj.ExpirationDate!);
            if (expirationDate != null && expirationDate > DateTime.Now)
            {
                return secretObj;
            }

            var uri = _httpClient.BaseAddress!.OriginalString + "direct-read";
            uri = QueryHelpers.AddQueryString(uri, "service", "request-token");

            using var request = new HttpRequestMessage()
            {
                RequestUri = new Uri(uri),
                Method = HttpMethod.Get,
            };

            using var response = await _httpClient.SendAsync(request);

            response.EnsureSuccessStatusCode();
            //Console.WriteLine("Headers: " + response.Headers.ToString());
            return await response.Content.ReadFromJsonAsync<ApiTokenResultDTO>();
        }
        // Helper method
        public DateTime? GetDateTime(string dateString, string timeZone = "CET")
        {
            // Hardcoded data - +1 is CET
            string newDataString = dateString.Replace(timeZone, "+1");
            string formatString = $"ddd MMM dd HH:mm:ss z yyyy";

            if (DateTime.TryParseExact(newDataString, formatString, null, DateTimeStyles.None, out DateTime result))
            {
                return result;
            }
            else
            {
                return null;
            }
        }
        // NOTE: This method is also used as a fallthrough for json request are empty
       
        public async Task<HttpResponseMessage?> DirectRequest(
            string entityType, 
            Dictionary<string, string?>? parameters = null, 
            (string, string)[]? headers = null, 
            bool authorizedUser = false)
        {
            // Catch potential exceptions
            var secretObj = await GetApiToken();
            var uri = _httpClient.BaseAddress!.OriginalString + "direct-read";

            // Adding Parameters
            uri = QueryHelpers.AddQueryString(uri, "entity_type", entityType);

            if (parameters != null)
            {
                uri = QueryHelpers.AddQueryString(uri, parameters);
            }
            // Keep if this is enough to handle all requests
            if (secretObj != null && !string.IsNullOrEmpty(secretObj.ApiToken))
            {
                uri = QueryHelpers.AddQueryString(uri, "api-token", secretObj.ApiToken);
            }
            using var request = new HttpRequestMessage()
            {
                RequestUri = new Uri(uri),
                Method = HttpMethod.Get,
            };
            // Headers get set here
            if (headers != null)
            {
                foreach (var header in headers)
                {
                    request.Headers.Add(header.Item1, header.Item2);
                }
            }
            var response = await _httpClient.SendAsync(request);
            response.EnsureSuccessStatusCode();
            // TODO: Make sure the response is not being read more than once
            var needsPermission = HasLicenseTerms(response);
            // NOTE: This portion of the method is yet untested 
            if (response.Headers.TryGetValues("accept-license", out var isLicensed) && isLicensed.FirstOrDefault() == "true")
            {
                response = await GetPermissionForDirectRead(request, response);
            }
            return response;
        }

        public async Task<HttpResponseMessage> JsonRequest(
            long studyId,
            string entityType,
            Dictionary<string, string?>? parameters = null,
            (string, string)[]? headers = null,
            bool authorizedUser = false)
        {
            var secretObj = await GetApiToken();
            var uri = _httpClient.BaseAddress!.OriginalString;

            if (!authorizedUser)
            {
                uri += "public/json";
            }
            else
            {
                uri += "json-auth";
            }

            uri = QueryHelpers.AddQueryString(uri, "entity_type", entityType);
            uri = QueryHelpers.AddQueryString(uri, "study_id", studyId.ToString());
            if (parameters != null)
            {
                uri = QueryHelpers.AddQueryString(uri, parameters);
            }
            // Keep if this is enough to handle all requests
            if (secretObj != null && !string.IsNullOrEmpty(secretObj.ApiToken))
            {
                uri = QueryHelpers.AddQueryString(uri, "api-token", secretObj.ApiToken);
            }

            using var request = new HttpRequestMessage()
            {
                RequestUri = new Uri(uri),
                Method = HttpMethod.Get,
            };
            // Headers get set here
            if (headers is not null)
            {
                foreach (var header in headers)
                {
                    request.Headers.Add(header.Item1, header.Item2);
                }
            }
            // If permission is not granted then the content length is empty
            var response = await _httpClient.SendAsync(request);
            response.EnsureSuccessStatusCode();
            return response;

            //var content = await response.Content.ReadAsStringAsync();
            //string? responseType = null;

            //bool gotPermission = false;
            //if (content.Length == 0)
            //{
            //    // TODO:Build a new table to store studies from whom I've received license terms to accept.
            //    Console.WriteLine("Json Request response had a content length of zero.");
            //    (response, gotPermission) = await GetPermission(response, request);
            //    responseType = gotPermission ? "csv" : "json";
            //}
            //if (gotPermission)
            //{
            //    bool savedRequest = await SaveStudy(await _context.Studies.Where(study => study.Id == studyId).FirstAsync());
            //    if (savedRequest)
            //    {
            //        _logger.Log(LogLevel.Information, "Succesfully saved request to RequestPermission Table.");
            //    }
            //}
            //return Tuple.Create(response, gotPermission, responseType);

        }
        // TODO: This method does not handle the case when user permissions are needed 
        // Several inputs are required for events data to be returned
        // If a license agreement has not accepted then the license agreements must be returned in a MD5 hash string
        // The following parameters must be passed:
        // 1) the study id
        // 2) At least one 'individual_local_identifiers'
        // 3) A sensor type (usually 'gps')
        // times are provided in milliseconds since 1970-01-01 UTC 
        // Coordinates are in WGS84 format.
        // NOTE: This method may need a direct request analogue as a failsafe
        // Remember to check proper permissions
        public async Task<HttpResponseMessage> JsonEventData(
            long studyId,
            string sensorType,
            ImmutableArray<string> individualLocalIdentifiers,
            Dictionary<string, string?>? parameters = null,
            string? eventProfile = null,
            (string, string)[]? headers = null,
            bool authorizedUser = false)
        {
            var uri = _httpClient.BaseAddress!.OriginalString;
            var secretObj = await GetApiToken();

            if (!authorizedUser)
            {
                uri += "public/json";
            }
            else
            {
                uri += "json-auth";
            }

            uri = QueryHelpers.AddQueryString(uri, new Dictionary<string, string?>()
            {
                ["study_id"] = studyId.ToString(),
                ["sensor_type"] = sensorType,
            });
            foreach (var localIdentifier in individualLocalIdentifiers)
            {
                uri = QueryHelpers.AddQueryString(uri, "individual_local_identifiers", localIdentifier);
            }

            if (parameters is not null) uri = QueryHelpers.AddQueryString(uri, parameters);

            if (eventProfile is not null) uri = QueryHelpers.AddQueryString(uri, "event_reduction_profile", eventProfile);

            if (secretObj is not null && !string.IsNullOrEmpty(secretObj.ApiToken))
            {
                uri = QueryHelpers.AddQueryString(uri, "api-token", secretObj.ApiToken);
            }

            using var request = new HttpRequestMessage()
            {
                RequestUri = new Uri(uri),
                Method = HttpMethod.Get
            };

            if (headers != null)
            {
                foreach (var header in headers)
                {
                    request.Headers.Add(header.Item1, header.Item2);
                }
            }
            var response = await _httpClient.SendAsync(request);
            if (response.Headers.TryGetValues("Accept-License", out var isLicensed) && isLicensed.FirstOrDefault() == "true")
            {
                Console.WriteLine("Response is awaiting license approval.");
                response = await GetPermissionForDirectRead(request, response);
            }
            response.EnsureSuccessStatusCode();
            return response;
        }

        // Entity type is one of the following: "study", "individual" or "tag".
        // The return type is the new response message and wether the license terms were accepted
        private async Task<Tuple<HttpResponseMessage, bool>> GetPermission(
            //long studyId,
            //string entityType,
            HttpResponseMessage oldResponse,
            HttpRequestMessage oldRequest)
        {
            var uri = _httpClient.BaseAddress!.AbsoluteUri;
            uri += "direct-read";
            //uri = QueryHelpers.AddQuery
            // TODO: Refactor to be more explicit about which parameters are to remain
            // If json data is not available then use the record data from the direct request response casted to a dto class
            var requestParameters = QueryHelpers.ParseQuery(oldRequest.RequestUri!.Query);
            uri = QueryHelpers.AddQueryString(uri, requestParameters);

            var request = new HttpRequestMessage()
            {
                RequestUri = new Uri(uri),
                Method = HttpMethod.Get,                
            };

            var response = await _httpClient.SendAsync(request);
            var hasLicenseTerms = HasLicenseTerms(response);

            if (!hasLicenseTerms || (!response.Headers.TryGetValues("Accept-License", out var acceptedLicense))
                || acceptedLicense.IsNullOrEmpty() || acceptedLicense.FirstOrDefault() == "false")
            {
                Console.WriteLine($"Response did not ask for license terms. hasLicenseTerms={hasLicenseTerms}");
                return Tuple.Create(response, false);
            }

            var md5String = StringToMD5(await response.Content.ReadAsByteArrayAsync());
            uri = QueryHelpers.AddQueryString(uri, "license-md5", md5String);

            var newRequest = new HttpRequestMessage()
            {
                RequestUri = new Uri(uri),
                Method = HttpMethod.Get
            };            
            var newResponse = await _httpClient.SendAsync(newRequest);            
            return Tuple.Create(newResponse, true);
        }

        private async Task<bool> SaveStudy(Studies study)
        {

            Dictionary<long,RequestPermission> recordedStudies = _context.RequestPermission.ToDictionary(s => s.Id);
            if (_context.RequestPermission.IsNullOrEmpty() || recordedStudies.ContainsKey(study.Id))
            {
                RequestPermission request = study.Adapt<RequestPermission>();
                _context.RequestPermission.Add(request);
                // Identity insert is set to on so we can manually set the primary key
                using var transaction = _context.Database.BeginTransaction();
                _context.Database.ExecuteSqlRaw("SET IDENTITY_INSERT RequestPermission ON");
                var dbChanges = await _context.SaveChangesAsync();
                _context.Database.ExecuteSqlRaw("SET IDENTITY_INSERT RequestPermission OFF");
                Console.WriteLine("Success added entry to Request Permission table.");
                return true;
            }
            else
            {
                return await Task.FromResult(false);
            }
        }

        private static bool HasLicenseTerms(HttpResponseMessage response)
        {
            var responseAsStream = response.Content.ReadAsStream();
            using var reader = new StreamReader(responseAsStream);
            var responseStr = reader.ReadToEnd();

            return responseStr.Contains("License Terms:");
        }

        private static string StringToMD5(byte[] byteArray)
        {
            var checkSum = MD5.HashData(byteArray);
            return BitConverter.ToString(checkSum).Replace("-", string.Empty);
        }
        // NOTE: This method is untested
        // This method assumes that the old response contains some license terms
        private async Task<HttpResponseMessage> GetPermissionForDirectRead(
            HttpRequestMessage oldRequest,
            HttpResponseMessage oldResponse)
        {
            var uri = oldRequest.RequestUri!.AbsoluteUri;
            var checkSum = MD5.HashData(await oldResponse.Content!.ReadAsByteArrayAsync());
            var md5_string = BitConverter.ToString(checkSum).Replace("-", string.Empty);

            uri = QueryHelpers.AddQueryString(uri, "license-md5", md5_string);

            var request = new HttpRequestMessage()
            {
                RequestUri = new Uri(uri),
                Method = HttpMethod.Get,
            };
            var response = await _httpClient.SendAsync(request);
            response.EnsureSuccessStatusCode();

            Console.WriteLine("Accepted License Terms");

            return response;
        }

        //private static string ToCommaSeparatedList(string[] collection)
        //{
        //    return string.Join(",", collection.Select(str => str.Trim()));
        //}

    }
}
