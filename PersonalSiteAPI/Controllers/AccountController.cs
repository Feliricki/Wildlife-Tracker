using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using PersonalSiteAPI.Models;
using PersonalSiteAPI.Services;
using System.IdentityModel.Tokens.Jwt;
using PersonalSiteAPI.DTO;
using static System.Net.WebRequestMethods;

namespace PersonalSiteAPI.Controllers
{
    [Route("api/[controller]/[action]")]
    [ApiController]
    public class AccountController : ControllerBase
    {
        // TODO - Implement Class
        private readonly ApplicationDbContext _context;
        private readonly ILogger<AccountController> _logger;
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly RoleManager<IdentityRole> _roleManager;
        private readonly JwtHandler _jwtHandler;

        public AccountController(
            ApplicationDbContext context,
            ILogger<AccountController> logger,
            UserManager<ApplicationUser> userManager,
            RoleManager<IdentityRole> roleManager,
            JwtHandler jwtHandler)
        {
            _context = context;
            _logger = logger;
            _userManager = userManager;
            _roleManager = roleManager;
            _jwtHandler = jwtHandler;
        }

        [HttpPost(Name = "Login")]
        [ResponseCache(CacheProfileName = "NoCache")]
        public async Task<IActionResult> Login(LoginRequestDTO loginRequest)
        {   
            try
            {
                if (ModelState.IsValid)
                {
                    var user = await _userManager.FindByNameAsync(loginRequest.UserName);
                    if (user == null || !await _userManager.CheckPasswordAsync(user, loginRequest.Password))
                    {
                        throw new Exception("Invalid login credentials.");
                    }
                    else
                    {
                        var sesssionToken = await _jwtHandler.GetTokenAsync(user);
                        var jwt = new JwtSecurityTokenHandler().WriteToken(sesssionToken);
                        return Ok(new LoginResultDTO()
                        {
                            Success = true,
                            Message = "Login sucessful",
                            Token = jwt
                        });
                    }
                }
                else
                {
                    var details = new ValidationProblemDetails(ModelState);
                    details.Type = "https://tools.ietf.org/html/rfc7231#section-6.5.1";
                    details.Status = StatusCodes.Status400BadRequest;
                    return new BadRequestObjectResult(details);
                }
            }
            catch (Exception e)
            {
                var exceptionDetails = new ProblemDetails
                {
                    Detail = "Unauthorized",
                    Status = StatusCodes.Status401Unauthorized,
                    Type = "https://tools.ietf.org/html/rfc7231#section-6.6.1"                        
                };
                return StatusCode(StatusCodes.Status401Unauthorized, exceptionDetails);
            }                     
        }

        [HttpPost(Name = "Register")]
        [ResponseCache(CacheProfileName="NoCache")]
        public async Task <IActionResult> Register(RegisterDTO registerDTO)
        {
            throw new NotImplementedException();
        }
    }
}
