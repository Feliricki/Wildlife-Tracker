using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using PersonalSiteAPI.Models;
using System.IdentityModel.Tokens.Jwt;
using PersonalSiteAPI.Services;
using PersonalSiteAPI.DTO;
using PersonalSiteAPI.Constants;

namespace PersonalSiteAPI.Controllers
{
    [Route("api/[controller]/[action]")]
    [ApiController]
    public class AccountController(
        ApplicationDbContext context,
        ILogger<AccountController> logger,
        UserManager<ApplicationUser> userManager,
        RoleManager<IdentityRole> roleManager,
        JwtHandler jwtHandler) : ControllerBase
    {
        // TODO - Implement Class
        private readonly ApplicationDbContext _context = context;
        private readonly ILogger<AccountController> _logger = logger;
        private readonly UserManager<ApplicationUser> _userManager = userManager;
        private readonly RoleManager<IdentityRole> _roleManager = roleManager;
        private readonly JwtHandler _jwtHandler = jwtHandler;

        [HttpPost(Name = "Login")]
        [ResponseCache(CacheProfileName = "NoCache")]
        public async Task<ActionResult<LoginResultDTO>> Login(LoginRequestDTO loginRequest)
        {
            try
            {
                //Console.WriteLine($"Got login request {JsonSerializer.Serialize(loginRequest)}");
                if (ModelState.IsValid)
                {
                    var userByName = await _userManager.FindByNameAsync(loginRequest.UserName);
                    var userByEmail = await _userManager.FindByEmailAsync(loginRequest.UserName);
                    if (userByName == null && userByEmail == null)
                    {
                        throw new Exception("Invalid username or email.");
                    }
                    if ((userByName != null && await _userManager.CheckPasswordAsync(userByName, loginRequest.Password)) ||
                        (userByEmail != null && await _userManager.CheckPasswordAsync(userByEmail, loginRequest.Password)))
                    {
                        userByName ??= userByEmail;
                        var sesssionToken = await _jwtHandler.GetTokenAsync(user: userByName!);
                        var jwt = new JwtSecurityTokenHandler().WriteToken(sesssionToken);

                        var roles = await _jwtHandler.GetRolesFromUserAsync(userByName!);
                        return Ok(new LoginResultDTO()
                        {
                            Success = true,
                            Message = "Login successful",
                            Roles = roles,
                            Token = jwt
                        });
                    }
                    else
                    {
                        throw new Exception("Invalid password.");
                    }
                }
                else
                {
                    throw new Exception("Invalid username or password.");
                }
            }
            catch (Exception e)
            {
                return Unauthorized(new LoginResultDTO()
                {
                    Success = false,
                    Message = e.Message,
                });
            }
        }

        [HttpPost(Name = "Register")]
        [ResponseCache(CacheProfileName = "NoCache")]
        public async Task<IActionResult> Register(RegisterDTO registerDTO)
        {
            await Task.Delay(1000);
            throw new NotImplementedException();
        }


        [HttpGet(Name = "IsAdmin")]
        [ResponseCache(CacheProfileName = "NoCache")]
        public async Task<ActionResult<bool>> IsAdmin([FromHeader(Name = "Authorization")] string authToken)
        {
            try
            {
                List<string> roles = await _jwtHandler.GetRolesFromToken(authToken);
                return roles.Contains(RoleNames.Administrator);
            }
            catch (Exception)
            {
                return false;
            }
        }
    }
}
