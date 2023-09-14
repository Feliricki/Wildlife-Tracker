using System.Net.Http.Headers;
using Microsoft.AspNetCore.WebUtilities;
using PersonalSiteAPI.DTO;
using Microsoft.IdentityModel.Tokens;
//using System.Buffers.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace PersonalSiteAPI.Services
{
    public interface IMoveBankService
    {
        //Task<ApiTokenResultDTO?> GetAttributes();
        Task<ApiTokenResultDTO?> GetApiToken();
    }
    public class MoveBankService : IMoveBankService
    {
        private readonly HttpClient _httpClient;
        private readonly IConfiguration _configuration;
        private readonly ILogger<MoveBankService> _logger;

        private string _userCredentials;

        public MoveBankService(
            HttpClient httpClient,
            IConfiguration configuration,
            ILogger<MoveBankService> logger)
        {
            _httpClient = httpClient;
            _configuration = configuration;
            _logger = logger;
            
            _httpClient.BaseAddress = new Uri("https://www.movebank.org/movebank/service/");

            // Not secure but required by MoveBank's API implementation :/
            //_userCredentials = Base64.EncodeToUtf8();
            _userCredentials = Convert.ToBase64String(
                System.Text.Encoding.UTF8.GetBytes(
                    $"{_configuration["MoveBank:Username"]}:{_configuration["MoveBank:Password"]}")
                );

            _httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Basic", _userCredentials);
        }
        public async Task<ApiTokenResultDTO?> GetApiToken()
        {
            //var uri = new UriBuilder(_httpClient.BaseAddress!)
            var uri = _httpClient!.BaseAddress!.OriginalString + "direct-read";
            uri = QueryHelpers.AddQueryString(uri, new Dictionary<string, string?>()
            {
                { "service", "request-token" }
            });
            Console.WriteLine("Outgoing Uri = " + uri);
            using var request = new HttpRequestMessage()
            {
                RequestUri = new Uri(uri),
                Method = HttpMethod.Get,
            };
            
            using var response = await _httpClient.SendAsync(request);
            Console.WriteLine($"Response Headers: {response.RequestMessage} DefaultHeaders: {_httpClient.DefaultRequestHeaders.ToString()}");
            // This will throw an exception if the Http request failed
            response.EnsureSuccessStatusCode();
            //var contentStream = await response.Content.ReadAsStringAsync();                                  
            //response.Content.Read
            return await response.Content.ReadFromJsonAsync<ApiTokenResultDTO>();
        }

        //public async Task<String> GetJsonRequest(HttpRequestMessage request, Dictionary<string, string> queries)
        //{
        //    return "";
        //}
    }
}
