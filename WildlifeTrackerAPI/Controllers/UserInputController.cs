using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WildlifeTrackerAPI.Constants;
using System.ComponentModel.DataAnnotations;

namespace WildlifeTrackerAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class UserInputController : ControllerBase
    {
        private readonly ILogger<UserInputController> _logger;
        public UserInputController(ILogger<UserInputController> logger)
        {
            _logger = logger;
        }


        [HttpPost(Name = "Suggestion")]
        [Authorize(Roles = $"{RoleNames.Administrator}, {RoleNames.Moderator}")]
        public async Task<IActionResult> Suggestion(
            [Required]
            [MaxLength(100)]
            [EmailAddress]
            string email,
            [Required]
            [MaxLength(10000)]
            string content)
        {
            // TODO: Purpose is to send emails. Not currently being used.
            _logger.LogWarning("Calling authorization only method Suggestions in UserInputController");
            await Task.CompletedTask;
            return Ok();
        }
    }
}
