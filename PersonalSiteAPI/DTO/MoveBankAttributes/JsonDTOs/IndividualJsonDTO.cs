using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace PersonalSiteAPI.DTO.MoveBankAttributes.JsonDTOs
{
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
