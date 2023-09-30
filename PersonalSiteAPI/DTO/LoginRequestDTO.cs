using System.ComponentModel.DataAnnotations;

namespace PersonalSiteAPI.DTO
{
    public class LoginRequestDTO
    {            
        [Required(ErrorMessage = "Username is required.")]
        [MaxLength(255)]
        public string UserName { get; set; } = null!;

        [Required(ErrorMessage = "Password is required.")]
        [MaxLength(255)]
        public string Password { get; set; } = null!;
    }
}
