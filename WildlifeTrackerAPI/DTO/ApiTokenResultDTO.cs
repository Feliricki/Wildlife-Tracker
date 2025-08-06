using System.Text.Json.Serialization;

namespace WildlifeTrackerAPI.DTO
{
    public class ApiTokenResultDTO
    {
        [JsonPropertyName("api-token")]
        public string? ApiToken { get; set; }
        [JsonPropertyName("api-token-expiry-date")]
        public string? ExpirationDate { get; set; }
        [JsonPropertyName("login")]
        public string? Login { get; set; }
    }
}
