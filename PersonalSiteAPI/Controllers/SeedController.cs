using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using PersonalSiteAPI.Models;
using PersonalSiteAPI.Constants;
using Microsoft.AspNetCore.Authorization;
using PersonalSiteAPI.Services;
using CsvHelper;
using System.Text;
using System.Globalization;
using PersonalSiteAPI.DTO.MoveBankAttributes;
using Microsoft.EntityFrameworkCore;

namespace PersonalSiteAPI.Controllers
{
    [Route("api/[controller]/[action]")]
    [ApiController]
    public class SeedController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly RoleManager<IdentityRole> _roleManager;
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly IWebHostEnvironment _env;
        private readonly IConfiguration _configuration;
        private readonly IMoveBankService _moveBankService;
        public SeedController(
            ApplicationDbContext context,
            RoleManager<IdentityRole> roleManager,
            UserManager<ApplicationUser> userManager,
            IWebHostEnvironment env,
            IConfiguration configuration,
            IMoveBankService moveBankService
            )
        {
            _context = context;
            _roleManager = roleManager;
            _userManager = userManager;
            _env = env;
            _configuration = configuration;
            _moveBankService = moveBankService;
        }

        [HttpPost(Name = "CreateDefaultUser")]
        [Authorize(Roles = $"{RoleNames.Administrator}, {RoleNames.Moderator}")]
        public async Task<IActionResult> CreateDefaultUsers()
        {
            int usersCreated = 0;
            int rolesCreated = 0;
            // First portion will create the default administrator and moderator role if they don't already exist
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
            // Creates the actual user if not already present in our database
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

        [HttpPost(Name="GetAllStudies")]
        public async Task<IActionResult> GetAllStudies()
        {
            try
            {
                var apiObj = _moveBankService.GetApiToken();
                if (apiObj == null)
                {
                    throw new Exception("Couldn't get API token");
                }
                var response = await _moveBankService.DirectRequest(entityType: "study", parameters: null, headers: null, authorizedUser: true);
                if (response == null)
                {
                    throw new Exception("Response error");
                }
                using var stream = new StreamReader(await response.Content.ReadAsStreamAsync(), Encoding.UTF8);
                using var csvReader = new CsvReader(stream, CultureInfo.InvariantCulture);

                var records = csvReader.GetRecordsAsync<StudiesRecord>();
                var existingStudies = await _context.Studies.ToDictionaryAsync(o => o.Id);

                int elementsAdded = 0;
                int rowsSkipped = 0;
                
                await foreach( var record in records)
                {
                    if (record == null || !record.Id.HasValue || existingStudies.ContainsKey(record.Id.Value))
                    {
                        rowsSkipped++;
                        continue;
                    }

                }

                return Ok();
            }
            catch (Exception err)
            {
                var exceptionDetails = new ProblemDetails
                {
                    Detail = err.Message,
                    Status = StatusCodes.Status401Unauthorized,
                    Type = "https://tools.ietf.org/html/rfc7231#section-6.6.1"
                };
                return StatusCode(StatusCodes.Status401Unauthorized, exceptionDetails);
            }
        }
    }
}