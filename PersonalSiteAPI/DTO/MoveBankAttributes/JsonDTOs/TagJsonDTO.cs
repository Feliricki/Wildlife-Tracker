using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace PersonalSiteAPI.DTO.MoveBankAttributes.JsonDTOs
{
    public class TagJsonDTO
    {
        [Required]
        [JsonPropertyName("id")]
        public long TagId { get; set; }
        [JsonPropertyName("local_identifier")]
        public string? LocalIdentifier { get; set; } = null;
    }
}
