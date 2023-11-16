using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace PersonalSiteAPI.DTO.MoveBankAttributes.JsonDTOs
{
    // The response when requesting for individuals local identifiers
    public class IndividualJsonDTO
    {
        public readonly string type = "individual";
        [Required]
        [JsonPropertyName("id")]
        public long Id { get; set; }
        [Required]
        [JsonPropertyName("local_identifier")]
        public string LocalIdentifier { get; set; } = string.Empty;
    }
}
