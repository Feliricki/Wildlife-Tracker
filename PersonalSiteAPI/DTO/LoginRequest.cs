using System.ComponentModel.DataAnnotations;

namespace PersonalSiteAPI.DTO
{
    public class LoginRequest
    {
        [EmailAddress]
        [Required(ErrorMessage = "Email is required.")]
        [MaxLength(50)]
        public string Email { get; set; } = null!;

        [Required(ErrorMessage = "Password is required.")]
        [MaxLength(50)]
        public string Password { get; set; } = null!;
    }
}
