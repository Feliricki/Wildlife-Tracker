using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace PersonalSiteAPI.DTO.MoveBankAttributes.JsonDTOs
{
    public class LocationDTO
    {
        [JsonPropertyName("timestamp")]
        public long Timestamp { get; set; }
        // Save space by using a float
        [JsonPropertyName("location_long")]
        public float LocationLong { get; set; }

        [JsonPropertyName("location_lat")]
        public float LocationLat { get; set; }
        // Optional fields
        public string Comments { get; set; } = string.Empty;
        public bool Visible { get; set; } = true;
    }
}
