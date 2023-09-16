using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using PersonalSiteAPI.Models;
using PersonalSiteAPI.Constants;

namespace PersonalSiteAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class SeedController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly RoleManager<IdentityRole> _roleManager;
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly IWebHostEnvironment _env;
        private readonly IConfiguration _configuration;

        public SeedController(
            ApplicationDbContext context,
            RoleManager<IdentityRole> roleManager,
            UserManager<ApplicationUser> userManager,
            IWebHostEnvironment env,
            IConfiguration configuration)
        {
            _context = context;
            _roleManager = roleManager;
            _userManager = userManager;
            _env = env;
            _configuration = configuration;
        }

        [HttpPost]
        public async Task<IActionResult> CreateDefaultUsers()
        {
            int usersCreated = 0;
            int rolesCreated = 0;
            if (await _roleManager.FindByNameAsync(RoleNames.Administrator) == null)
            {
                await _roleManager.CreateAsync(new IdentityRole(RoleNames.Administrator));
                rolesCreated++;
            }

            if (await _roleManager.FindByNameAsync(RoleNames.Moderator) == null)
            {
                await _roleManager.CreateAsync(new IdentityRole(RoleNames.Moderator));
                rolesCreated++;
            }
            var addedUserList = new List<ApplicationUser>();
            if (await _userManager.FindByNameAsync(_configuration["DefaultUser:Username"]) == null)
            {
                var adminUser = new ApplicationUser()
                {
                    SecurityStamp = Guid.NewGuid().ToString(),
                    UserName = _configuration["DefaultUser:Username"],
                    Email = _configuration["DefaultUser:Email"],
                };
                await _userManager.CreateAsync(adminUser, _configuration["DefaultUser:Password"]);
                await _userManager.AddToRoleAsync(adminUser, RoleNames.Administrator);
                await _userManager.AddToRoleAsync(adminUser, RoleNames.Moderator);

                adminUser.EmailConfirmed = true;
                adminUser.LockoutEnabled = true;

                addedUserList.Add(adminUser);
                usersCreated++;
            }
            return new JsonResult(new
            {
                UsersCreated = usersCreated,
                RolesCreated = rolesCreated,
                Users = addedUserList
            });
        }   
    }
}
