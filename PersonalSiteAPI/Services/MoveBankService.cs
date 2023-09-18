using Amazon.Runtime;
using Amazon.SecretsManager;
using Amazon.SecretsManager.Extensions.Caching;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.WebUtilities;
using PersonalSiteAPI.DTO;
using PersonalSiteAPI.Extensions;
using System.Net.Http.Headers;
using Amazon.SecretsManager.Model;
using System.Text.Json;
using System.Globalization;

namespace PersonalSiteAPI.Services
{
    //public class Response : AmazonWebServiceResponses;
    public interface IMoveBankService
    {
        Task<ApiTokenResultDTO?> GetApiToken();
        Task GetJsonData(HttpRequestMessage request, Dictionary<string, string> queries);
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

            // Not secure but required by MoveBank's API implementation :/
            //_userCredentials = Base64.EncodeToUtf8();
            var _userCredentials = Convert.ToBase64String(
                System.Text.Encoding.UTF8.GetBytes(
                    $"{_configuration["MoveBank:Username"]}:{_configuration["MoveBank:Password"]}")
                );

            _httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Basic", _userCredentials);
        }
        public async Task<ApiTokenResultDTO?> GetApiToken()
        {
            // Check the cache for an existing API Token
            // TODO - Cache Implementation is working
            // Incorporate rotation/retrieval/ and insertion of keys
            // Rotate when DateTime of API key expires
            // Implement time limit for cache
            // Create DTO object for secrets
            SecretCacheItem? secretCache = _secretsCache.GetCachedSecret(_configuration["ConnectionStrings:AWSKeyVault2ARN"]);
            GetSecretValueResponse? secretValue = await secretCache.GetSecretValue(new CancellationToken());
            var secretObj = JsonSerializer.Deserialize<ApiTokenResultDTO>(secretValue.SecretString)!;
            DateTime? expirationDate = getDateTime(secretObj.ExpirationDate!);            
            if (expirationDate != null && expirationDate > DateTime.Now)
            {
                return secretObj;
            }

            var uri = _httpClient.BaseAddress!.OriginalString + "direct-read";
            uri = QueryHelpers.AddQueryString(uri, new Dictionary<string, string?>()
            {
                { "service", "request-token" }
            });          

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
            
        public async Task GetJsonData(HttpRequestMessage request, Dictionary<string, string> queries)
        {
            
            return;
        }

        public DateTime? getDateTime(string dateString, string timeZone="CET")
        {
            // Hardcoded data - +1 is CEST
            string newDataString = dateString.Replace(timeZone, "+1");
            string formatString = $"ddd MMM dd HH:mm:ss z yyyy";
            
            if (DateTime.TryParseExact(newDataString, formatString, null, DateTimeStyles.None, out DateTime result))
            {
                //var timeZoneInfo = result.
                return result;
            }
            else
            {
                return null;
            }
        }
    }
}
