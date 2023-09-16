using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using PersonalSiteAPI.Models;
using PersonalSiteAPI.Services;
using System.IdentityModel.Tokens.Jwt;
using PersonalSiteAPI.DTO;

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

        [HttpPost("Login")]
        [ResponseCache(CacheProfileName = "NoCache")]
        public async Task<IActionResult> Login(LoginRequest loginRequest)
        {            
            var user = await _userManager.FindByNameAsync(loginRequest.Email);
            if (user == null || !await _userManager.CheckPasswordAsync(user, loginRequest.Password))

                return Unauthorized(new LoginResultDTO()
                {
                    Success = false,
                    Message = "Invalid Credentials"
                });

            var secToken = await _jwtHandler.GetTokenAsync(user);
            var jwt = new JwtSecurityTokenHandler().WriteToken(secToken);

            return Ok(new LoginResultDTO()
            {
                Success = true,
                Message = "Login successful",
                Token = jwt
            });            
        }
    }
}
