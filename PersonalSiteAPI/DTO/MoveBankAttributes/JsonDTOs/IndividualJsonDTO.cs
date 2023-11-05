using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace PersonalSiteAPI.DTO.MoveBankAttributes.JsonDTOs
{
    // The response when requesting for individuals local identifiers
    public class IndividualJsonDTO
    {
        [Required]
        [JsonPropertyName("id")]
        public long IndividualId { get; set; }
        [Required]
        [JsonPropertyName("local_identifier")]
        public string LocalIdentifier { get; set; } = string.Empty;
    }
}
