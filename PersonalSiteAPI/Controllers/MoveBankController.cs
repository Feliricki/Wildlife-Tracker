using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;
using PersonalSiteAPI.Constants;
using PersonalSiteAPI.DTO;
using PersonalSiteAPI.Models;
using PersonalSiteAPI.Services;

// For more information on enabling Web API for empty projects, visit https://go.microsoft.com/fwlink/?LinkID=397860

namespace PersonalSiteAPI.Controllers
{
    [Route("api/[controller]/[action]")]
    [ApiController]
    public class MoveBankController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<AccountController> _logger;
        private readonly IMoveBankService _moveBankService;
        private readonly IMemoryCache _memoryCache;
        private readonly UserManager<ApplicationUser> _userManager;

        public MoveBankController(
            ApplicationDbContext context, 
            ILogger<AccountController> logger,
            IMoveBankService moveBankService,
            IMemoryCache memoryCache, 
            UserManager<ApplicationUser> userManager) 
        {
            _context = context;
            _logger = logger;
            _moveBankService = moveBankService;
            _memoryCache = memoryCache;
            _userManager = userManager;
        }
        // GET: api/<MoveBankController>

        [HttpGet(Name = "GetToken")]
        [Authorize(Roles = $"{RoleNames.Administrator}, {RoleNames.Moderator}")]
        public async Task<ActionResult<ApiTokenResultDTO>> GetToken()
        {
            try
            {                
                var response = await _moveBankService.GetApiToken();
                if (response == null)
                {
                    return new ApiTokenResultDTO();
                }
                return response;
            }
            catch (Exception)
            {   
                var exceptionDetails = new ProblemDetails
                {
                    Detail = "Error retrieving Token",
                    Status = StatusCodes.Status500InternalServerError,
                    Type = "https://tools.ietf.org/html/rfc7231#section-6.6.1"
                };
                return StatusCode(StatusCodes.Status500InternalServerError, exceptionDetails);
            }
        }
        // Set proper authorization
        [HttpGet(Name="GetStudy")]
        public async Task<ActionResult<Studies?>> GetStudy(long studyId)
        {
            try
            {
                
                if (_memoryCache.TryGetValue<Studies>(studyId, out var cachedStudy))
                {
                    return cachedStudy!;
                }
                var study = await _context.Studies.FindAsync(studyId);
                if (study != null && !string.IsNullOrEmpty(study.LicenseType) && validLicense(study.LicenseType))
                {
                    _memoryCache.Set(studyId, study);
                    return study;
                }
                return Unauthorized();
            }
            catch (Exception)
            {
                return NotFound();
            }
        }

        private bool validLicense(string licenseType)
        {
            string[] licenses = { "CC_0", "CC_BY", "CC_BY_NC" };
            return licenses.Contains(licenseType.Trim());
        }
    }
}
