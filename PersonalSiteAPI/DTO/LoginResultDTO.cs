using System.ComponentModel.DataAnnotations;

namespace PersonalSiteAPI.DTO
{
    public class LoginResultDTO
    {
        [Required]
        public bool Success {  get; set; }
        [Required]
        public string Message { get; set; } = null!;
        [Required]
        public string? Token { get; set; }
    }
}
