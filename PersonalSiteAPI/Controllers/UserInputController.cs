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
        public UserInputController(IEmailService emailService)
        {
            _emailService = emailService;
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
            Console.WriteLine(email);
            Console.WriteLine(content);
            // TODO: the purpose of this method is to send an email to my work email
            // make sure that inputs are being throttled
            // perhaps I should implement a banlist on my database

            var result = await _emailService.SendMailToMeAsync(email, content);
            return Ok(result);
        }
    }
}
