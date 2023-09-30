using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using PersonalSiteAPI.Models;
using PersonalSiteAPI.Services;
using System.IdentityModel.Tokens.Jwt;
using PersonalSiteAPI.DTO;
using static System.Net.WebRequestMethods;
using System.ComponentModel.DataAnnotations;
using System.Text.Json;

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
        private bool IsValidEmail(string email){
            try{
                var address = new System.Net.Mail.MailAddress(email.Trim());
                return address.Address == email;
            }
            catch(Exception){
                return false;
            }
        }
        
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
                        var sesssionToken = await _jwtHandler.GetTokenAsync(userByName ?? userByEmail);
                        var jwt = new JwtSecurityTokenHandler().WriteToken(sesssionToken);
                        return Ok(new LoginResultDTO()
                        {
                            Success = true,
                            Message = "Login successful",
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
                return Unauthorized(new LoginResultDTO(){
                    Success = false,
                    Message = e.Message,
                });                
            }
        }

        [HttpPost(Name = "Register")]
        [ResponseCache(CacheProfileName="NoCache")]
        public async Task <IActionResult> Register(RegisterDTO registerDTO)
        {
            await Task.Delay(1000);
            throw new NotImplementedException();
        }
    }
}
