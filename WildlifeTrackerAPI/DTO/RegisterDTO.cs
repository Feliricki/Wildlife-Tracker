using System.ComponentModel.DataAnnotations;

namespace WildlifeTrackerAPI.DTO
{
    public class RegisterDTO
    {
        [Required]
        [MaxLength(255)]
        public string? UserName { get; set; }

        [Required]
        [EmailAddress]
        [MaxLength(255)]
        public string? Email { get; set; }

        [Required]
        [MaxLength(255)]
        public string? Password { get; set; }
    }
}
