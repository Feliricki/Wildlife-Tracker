using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace PersonalSiteAPI.DTO.MoveBankAttributes.JsonDTOs
{
    public class StudyJsonDTO
    {
        [Required]
        [JsonPropertyName("id")]
        public long StudyId { get; set; }

        [Required]
        [JsonPropertyName("name")]
        public string Name { get; set; } = null!;
        [JsonPropertyName("sensor_type_ids")]
        public string SensorTypeIds { get; set; } = "";
    }
}
