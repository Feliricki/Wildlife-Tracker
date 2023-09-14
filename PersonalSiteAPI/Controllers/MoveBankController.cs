using Microsoft.AspNetCore.Mvc;
using PersonalSiteAPI.DTO;
using PersonalSiteAPI.Models;
using PersonalSiteAPI.Services;

// For more information on enabling Web API for empty projects, visit https://go.microsoft.com/fwlink/?LinkID=397860

namespace PersonalSiteAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class MoveBankController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<AccountController> _logger;
        private readonly IMoveBankService _moveBankService;

        public MoveBankController(
            ApplicationDbContext context, 
            ILogger<AccountController> logger,
            IMoveBankService moveBankService) 
        {
            _context = context;
            _logger = logger;
            _moveBankService = moveBankService;
        }
        // GET: api/<MoveBankController>
        [HttpGet(Name = "GetToken")]
        public async Task<ActionResult<ApiTokenResultDTO>> GetToken()
        {
            try {
                
                var response = await _moveBankService.GetApiToken();
                if (response == null)
                {
                    return new ApiTokenResultDTO();
                }
                return response;
            }
            catch
            {
                var exceptionDetails = new ProblemDetails
                {
                    Detail = "Error retrieving request token",
                    Status = StatusCodes.Status500InternalServerError,
                    Type = "https://tools.ietf.org/html/rfc7231#section-6.6.1"
                };
                return StatusCode(StatusCodes.Status500InternalServerError, exceptionDetails);
            }
        }

    }
}
