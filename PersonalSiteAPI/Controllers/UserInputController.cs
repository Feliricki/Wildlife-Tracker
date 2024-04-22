using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using PersonalSiteAPI.Constants;
using PersonalSiteAPI.Models.Email;
using PersonalSiteAPI.Services;
using System.ComponentModel.DataAnnotations;

namespace PersonalSiteAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class UserInputController : ControllerBase
    {
        private readonly IEmailService _emailService;
        private readonly ILogger<UserInputController> _logger;
        public UserInputController(IEmailService emailService, ILogger<UserInputController> logger)
        {
            _emailService = emailService;
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
            // TODO: the purpose of this method is to send an email to my work email
            // make sure that inputs are being throttled
            // perhaps I should implement a banlist on my database
            _logger.LogWarning("Calling authorization only method Suggestions in UserInputController");
            var result = await _emailService.SendMailToMeAsync(email, content);
            return Ok(result);
        }
    }
}
