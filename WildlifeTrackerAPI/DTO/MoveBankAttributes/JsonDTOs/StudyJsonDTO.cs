using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace WildlifeTrackerAPI.DTO.MoveBankAttributes.JsonDTOs
{
    // entity_type=study
    public class StudyJsonDTO
    {
        public readonly string type = "study";
        [Required]
        [JsonPropertyName("id")]    
        public long Id { get; set; }

        [Required]
        [JsonPropertyName("name")]
        public string Name { get; set; } = null!;
        [JsonPropertyName("sensor_type_ids")]
        public string? SensorTypeIds { get; set; } = string.Empty;
    }
}
