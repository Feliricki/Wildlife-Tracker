using System.ComponentModel.DataAnnotations;

namespace WildlifeTrackerAPI.DTO
{
    public class LoginResultDTO
    {        
        // True if the login attempt is successful. False otherwise 
        [Required]
        public bool Success {  get; set; }
        // Login message
        [Required]
        public string Message { get; set; } = null!;
        // Jwt bearer token if the login attempt is successful. Null otherwise

        [Required]
        public List<string> Roles { get; set; } = [];

        [Required]
        public string? Token { get; set; }
    }
}
