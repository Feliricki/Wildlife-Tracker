using Amazon.Runtime;
using Amazon.SecretsManager;
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
using Microsoft.AspNetCore.Http.Extensions;
using System;

namespace PersonalSiteAPI.Services
{
    //public class Response : AmazonWebServiceResponses;
    public interface IMoveBankService
    {
        Task<ApiTokenResultDTO?> GetApiToken();
        DateTime? GetDateTime(string dateString, string timeZone = "CET");
        // Direct and Json request must specify an entity_type
        // Some entities are "individual, tag_type ,study"
        Task<HttpResponseMessage?> DirectRequest(
            string entityType, 
            Dictionary<string, string?>? parameters=null,
            (string, string)[]? headers=null, 
            bool authorizedUser = false
            );        
        Task<HttpResponseMessage> JsonRequest(
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
            string[]? eventProfiles = null,
            (string, string)[]? headers = null,
            bool authorizedUser = false);




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

        public MoveBankService(
            HttpClient httpClient,
            IConfiguration configuration,
            ILogger<MoveBankService> logger,
            IAmazonSecretsManager amazonSecretsManager,
            IDataProtectionProvider provider)
        {
            _httpClient = httpClient;
            _configuration = configuration;
            _logger = logger;
            _amazonSecretsManager = amazonSecretsManager;
            _provider = provider;
            
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

            _httpClient.BaseAddress = new Uri("https://www.movebank.org/movebank/service/");
            
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
        public DateTime? GetDateTime(string dateString, string timeZone="CET")
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
        
        public async Task<HttpResponseMessage?> DirectRequest(string entityType, Dictionary<string, string?>? parameters=null, (string, string)[]? headers=null, bool authorizedUser=false)
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
            
            if (response.Headers.TryGetValues("accept-license", out var isLicensed) && isLicensed.FirstOrDefault() == "true")
            {
                response = await GetPermission(request, response);
            }
            return response;
        }

        public async Task<HttpResponseMessage> JsonRequest(
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

            if (response.Headers.TryGetValues("accept-license", out var isLicensed) && isLicensed.FirstOrDefault() == "true")
            {
                response = await GetPermission(request, response);
            }
            return response;

        }
        
        // Several inputs are required for events data to be returned
        // If a license agreement has not accepted then the license agreements must be returned in a MD5 hash string
        // The following parameters must be passed:
        // 1) the study id
        // 2) At least one 'individual_local_identifiers'
        // 3) A sensor type (usually 'gps')
        // times are provided in milliseconds since 1970-01-01 UTC 
        // Coordinates are in WGS84 format


        // NOTE: For now we ditch the parameters goes unsused
        public async Task<HttpResponseMessage> JsonEventData(
            long studyId,
            string sensorType,
            ImmutableArray<string> individualLocalIdentifiers,
            Dictionary<string, string?>? parameters = null,
            string[]? eventProfiles = null,
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

            if (parameters is not null)
            {
                uri = QueryHelpers.AddQueryString(uri, parameters);
            }

            if (eventProfiles is not null)
            {
                foreach (var profile in eventProfiles)
                {
                    uri = QueryHelpers.AddQueryString(uri, "event_reduction_profile", profile);
                }
            }
                        
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
            if (response.Headers.TryGetValues("accept-license", out var isLicensed) && isLicensed.FirstOrDefault() == "true")
            {
                Console.WriteLine("Response is awaiting license approval.");
                response = await GetPermission(request, response);
            }
            response.EnsureSuccessStatusCode();
            return response;
        }


        // NOTE: This method is untested
        private async Task<HttpResponseMessage> GetPermission(HttpRequestMessage oldRequest, HttpResponseMessage oldResponse)
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
