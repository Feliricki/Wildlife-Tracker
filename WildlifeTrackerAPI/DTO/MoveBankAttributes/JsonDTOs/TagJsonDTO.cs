using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace WildlifeTrackerAPI.DTO.MoveBankAttributes.JsonDTOs
{
    public class TagJsonDTO
    {
        public readonly string type = "tag";
        [Required]
        [JsonPropertyName("id")]
        public long Id { get; set; }
        [JsonPropertyName("local_identifier")]
        public string? LocalIdentifier { get; set; } = null;
    }
}
