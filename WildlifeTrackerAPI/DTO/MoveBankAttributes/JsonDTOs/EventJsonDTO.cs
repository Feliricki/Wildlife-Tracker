using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace WildlifeTrackerAPI.DTO.MoveBankAttributes.JsonDTOs
{
    public class EventJsonDTO
    {
        [JsonPropertyName("individuals")]
        public List<IndividualEventDTO> IndividualEvents { get; set; } = new List<IndividualEventDTO>();
    }
}
