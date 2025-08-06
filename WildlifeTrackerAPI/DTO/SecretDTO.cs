using System.ComponentModel.DataAnnotations;

namespace WildlifeTrackerAPI.DTO
{
    public class SecretDTO
    {
        [Required]
        public string? DefaultConnection { get; set; } = default;
        [Required]
        public string? GoogleMaps { get; set; } = default;
        [Required]
        public string? MoveBank { get; set; } = default;
    }
}
