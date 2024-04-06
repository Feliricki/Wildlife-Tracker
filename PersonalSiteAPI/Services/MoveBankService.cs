using Amazon.SecretsManager;
using Amazon.SecretsManager.Extensions.Caching;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.WebUtilities;
using PersonalSiteAPI.DTO;
using PersonalSiteAPI.Extensions;
using Amazon.SecretsManager.Model;
using System.Globalization;
using System.Security.Cryptography;
using System.Collections.Immutable;
using Microsoft.IdentityModel.Tokens;
using PersonalSiteAPI.Models;
using Microsoft.EntityFrameworkCore;
using Mapster;
using JsonSerializer = System.Text.Json.JsonSerializer;
using EventRequest = PersonalSiteAPI.DTO.MoveBankAttributes.EventRequest;

namespace PersonalSiteAPI.Services
{
    public interface IMoveBankService
    {
        Task<ApiTokenResultDTO?> GetApiToken();
        Task<List<string>> GetWordsWithPrefix(string prefix, long? maxCount = null, bool allowRestricted= false);
        DateTime? GetDateTime(string? dateString);

        Task<HttpResponseMessage?> DirectRequestEvents(EventRequest request);

        Task<HttpResponseMessage?> DirectRequest(
            string entityType,
            long? studyId = null,
            Dictionary<string, string?>? parameters = null,
            (string, string)[]? headers = null,
            bool authorizedUser = false);

        Task<HttpResponseMessage> JsonRequest(
            long studyId,
            string entityType,
            Dictionary<string, string?>? parameters = null,
            (string, string)[]? headers = null,
            bool authorizedUser = false);
        // Parameters are required for json requests
        Task<HttpResponseMessage> JsonEventData(
            long studyId,
            string sensorType,
            ImmutableArray<string> individualLocalIdentifiers,
            Dictionary<string, string?>? parameters,
            string? eventProfile = null,
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
        // This context will be used to post information on studies to contact 
        private readonly ApplicationDbContext _context;
        private readonly IAutoCompleteService _autoCompleteService;

        public MoveBankService(
            HttpClient httpClient,
            IConfiguration configuration,
            ILogger<MoveBankService> logger,
            IAmazonSecretsManager amazonSecretsManager,
            IDataProtectionProvider provider,
            ApplicationDbContext context,
            IAutoCompleteService autoCompleteService)
        {
            _httpClient = httpClient;
            _configuration = configuration;
            _logger = logger;
            _amazonSecretsManager = amazonSecretsManager;
            _provider = provider;
            _context = context;
            
            _autoCompleteService = autoCompleteService;
            
            // TODO: Autocomplete should return different results depending on authorization 

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
        }
        
        
        // TODO: Change this method to accept 
        public async Task<List<string>> GetWordsWithPrefix(string prefix="", long? maxCount = 10, bool allowedRestricted = false)
        {
            return await Task.FromResult(
                _autoCompleteService.GetAllWordsWithPrefix(prefix, maxCount, allowedRestricted).Select(charArray => string.Join("", charArray)).ToList()
            );
        }
        // Restrict this function
        public async Task<ApiTokenResultDTO?> GetApiToken()
        {
            SecretCacheItem? secretCache = _secretsCache.GetCachedSecret(_configuration["ConnectionStrings:AWSKeyVault2ARN"]);
            GetSecretValueResponse? secretValue = await secretCache.GetSecretValue(new CancellationToken());

            var secretObj = JsonSerializer.Deserialize<ApiTokenResultDTO>(secretValue.SecretString);
            DateTime? expirationDate = GetDateTime(secretObj?.ExpirationDate!);

            if (expirationDate != null && expirationDate > DateTime.Now)
            {
                return secretObj;
            }            
            // INFO: Rotations are scheduled for the first of every month so this code should never be reached.
            var rotationRequest = new RotateSecretRequest()
            {
                SecretId = "MoveBankSecrets",
                RotateImmediately = true,                
            };

            await _amazonSecretsManager.RotateSecretAsync(rotationRequest);            

            secretCache = _secretsCache.GetCachedSecret(_configuration["ConnectionStrings:AWSKeyVault2ARN"]);
            secretValue = await secretCache.GetSecretValue(new CancellationToken());

            secretObj = JsonSerializer.Deserialize<ApiTokenResultDTO>(secretValue.SecretString)!;

            return secretObj;
        }
                
        // TODO: Current timezone being returned is CEST
        public DateTime? GetDateTime(string? dateString)
        {
            if (dateString is null)
            {
                return null;
            }
            // This method is still hardcoded.
            // The default timezone is CET.
            var tokens = dateString.Split(' ');
            var timeZone = tokens[4];
            var offset = "+1";
            if (timeZone == "CEST")
            {
                offset = "+2";
            }

            //var newDataString = dateString.Replace(timeZone, "+1");
            var newDateString = dateString.Replace(timeZone, offset);
            const string formatString = $"ddd MMM dd HH:mm:ss z yyyy";
            if (DateTime.TryParseExact(newDateString, formatString, null, DateTimeStyles.None, out var result))
            {
                return result;
            }
            else
            {
                return null;
            }
        }

        // TODO: Validation should occur in the controller method.
        public async Task<HttpResponseMessage?> DirectRequestEvents(EventRequest request)
        {
            var parameters = new Dictionary<string, string?>();
            var eventOptions = request.Options;

            if (eventOptions.MaxEventsPerIndividual is not null)
            {
                parameters.Add("max_events_per_individual", eventOptions.MaxEventsPerIndividual.ToString());
            }

            const string additionalAttributes = "individual_local_identifier,tag_local_identifier,timestamp,location_long,location_lat,individual_taxon_canonical_name";
            parameters.Add("attributes", additionalAttributes);

            if (!string.IsNullOrEmpty(eventOptions.EventProfile))
            {
                parameters.Add("event_reduction_profile", eventOptions.EventProfile);
            }

            // These timestamp as given in Unix Epoch time
            if (eventOptions.TimestampStart >= eventOptions.TimestampEnd)
            {
                parameters.Add("timestamp_start", eventOptions.TimestampStart.ToString());
                parameters.Add("timestamp_end", eventOptions.TimestampEnd.ToString());
            }

            // If this request has no parameters then movebank will return all publiclly available event data.
            if (request.LocalIdentifiers is not null && request.LocalIdentifiers.Count > 0)
            {
                parameters.Add("individual_local_identifier", string.Join(",", request.LocalIdentifiers));
            }
            
            var response = await DirectRequest(
                entityType: "event",
                studyId: request.StudyId,
                parameters: parameters,
                headers: null,
                authorizedUser: false);

            return response;
        }


        // NOTE: This method is also used as a fallthrough for json request are empty
        public async Task<HttpResponseMessage?> DirectRequest(
            string entityType,
            long? studyId = null,
            Dictionary<string, string?>? parameters = null,
            (string, string)[]? headers = null,
            bool authorizedUser = false)
        {
            var secretObj = await GetApiToken();
            var uri = _httpClient.BaseAddress!.OriginalString + "direct-read";

            // Adding Parameters
            uri = QueryHelpers.AddQueryString(uri, "entity_type", entityType);
            if (studyId is long studyIdLong && (parameters is null || !parameters.ContainsKey("study_id")))
            {
                uri = QueryHelpers.AddQueryString(uri, "study_id", studyIdLong.ToString());
            }

            if (parameters is not null)
            {
                uri = QueryHelpers.AddQueryString(uri, parameters);
            }

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

            // Timeout after 20 seconds.
            var cancellationToken = new CancellationTokenSource();
            cancellationToken.CancelAfter(1000 * 20);

            var response = await _httpClient.SendAsync(request, cancellationToken.Token);

            response.EnsureSuccessStatusCode();

            //var responseContentBytes = await response.Content.ReadAsByteArrayAsync();
            // The following method works by checking the headers of the response and thus avoids reading the stream unnecessarily.
            if (!HasLicenseTerms(response) || studyId is null)
            {
                Console.WriteLine("Returning the http response without sending another request asking for permissions.");
                return response;
            } 
            Console.WriteLine("Requesting permission for direct read response");

            // INFO: In this case, the another request is sent asking for permission and the study is stored in my database to credit at another time.                
            response = await GetPermissionForDirectRead(request, response);
            var study = await _context.Studies.AsNoTracking().Where(s => s.Id == studyId).FirstOrDefaultAsync();
            //if (await SaveStudy(study))
            //{
            //    Console.WriteLine("Successfully saved study to RequestPermission table");
            //}
            //else
            //{
            //    Console.WriteLine("Did not save study to database.");
            //}
                         
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
        }
        // TODO: This method does not handle the case when user permissions are needed 
        // Several inputs are required for events data to be returned
        // If a license agreement has not accepted then the license agreements must be returned in a MD5 hash string
        // The following parameters must be passed:
        // 1) the study id
        // 2) At least one 'individual_local_identifiers'
        // 3) A sensor type (usually 'gps')
        // 4) If the number of individuals exceeds a certain threshold than it may be prudent to enforce an event reduction profile.
        
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
            // Handle the empty case in the controller endpoint
            var response = await _httpClient.SendAsync(request);
            response.EnsureSuccessStatusCode();
            return response;
        }

        private async Task<bool> SaveStudy(Studies? study)
        {
            if (study is null) return await Task.FromResult(false);
            
            Dictionary<long, RequestPermission> recordedStudies = _context.RequestPermission.ToDictionary(s => s.Id);
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

        private static bool HasLicenseTerms(HttpResponseMessage? response)
        {
            if (response is null)
            {
                return false;
            }
            var headers = response.Headers;
            if ((headers.TryGetValues("accept-license", out var result) && result.FirstOrDefault() is "true")
                || (headers.TryGetValues("Accept-License", out var result2) && result2.FirstOrDefault() is "true"))
            {
                return true;
            }
            return false;
        }

        private static bool HasLicenseTerms(byte[] content)
        {
            string responseStr = System.Text.Encoding.UTF8.GetString(content);
            return responseStr.Contains("License Terms:");
        }

        // NOTE: This method is untested
        // This method assumes that the old response contains some license terms
        // Otherwise the same response be received
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
            return response;
        }

    }
}
