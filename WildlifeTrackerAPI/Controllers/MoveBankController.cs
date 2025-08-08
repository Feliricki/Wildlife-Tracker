using MapsterMapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using WildlifeTrackerAPI.Attributes;
using WildlifeTrackerAPI.Attributes.MoveBankAttributes;
using WildlifeTrackerAPI.Constants;
using WildlifeTrackerAPI.DTO;
using WildlifeTrackerAPI.DTO.MoveBankAttributes;
using WildlifeTrackerAPI.Models;
using WildlifeTrackerAPI.Services;
using System.ComponentModel.DataAnnotations;
using System.Text.Json;
using WildlifeTrackerAPI.Enums;
using System.Text.Json.Serialization;

namespace WildlifeTrackerAPI.Controllers
{
    [Route("api/[controller]/[action]")]
    [ApiController]
    public class MoveBankController : ControllerBase
    {
        private readonly IMoveBankService _moveBankService;
        private readonly UserManager<ApplicationUser> _userManager;

        public MoveBankController(
            IMoveBankService moveBankService,
            UserManager<ApplicationUser> userManager)
        {
            _moveBankService = moveBankService;
            _userManager = userManager;
        }

        // GET: api/<MoveBankController>
        [HttpGet(Name = "GetToken")]
        [Authorize(Roles = $"{RoleNames.Administrator}, {RoleNames.Moderator}")]
        public async Task<ActionResult<ApiTokenResultDTO>> GetToken()
        {
            var response = await _moveBankService.GetApiToken() ?? throw new Exception("Unable to retrieve api token.");
            return Ok(response);
        }

        [HttpGet(Name = "GetStudy")]
        [ResponseCache(CacheProfileName = "Any-60")]
        public async Task<ActionResult<StudyDTO>> GetStudy(long studyId)
        {
            var studyDto = await _moveBankService.GetStudyAsync(studyId, User.IsInRole(RoleNames.Administrator));
            if (studyDto == null)
            {
                return Unauthorized("User is not authorized to view this study.");
            }
            return Ok(studyDto);
        }

        [HttpGet(Name = "GetStudies")]
        [ResponseCache(CacheProfileName = "Any-60")]
        public async Task<ActionResult<ApiResult<StudyDTO>>> GetStudies(
            int pageIndex = 0,
            [Range(1, 50)] int pageSize = 10,
            string? sortColumn = "Name",
            string? sortOrder = "ASC",
            string? filterColumn = null,
            string? filterQuery = null)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var result = await _moveBankService.GetStudiesAsync(
                pageIndex,
                pageSize,
                sortColumn,
                sortOrder,
                filterColumn,
                filterQuery,
                User.IsInRole(RoleNames.Administrator));

            return Ok(result);
        }

        [HttpGet(Name = "GetAllStudies")]
        [ResponseCache(CacheProfileName = "Any-60")]
        public async Task<IActionResult> GetAllStudies(bool geojsonFormat = false)
        {
            var result = await _moveBankService.GetAllStudiesAsync(User.IsInRole(RoleNames.Administrator), geojsonFormat);
            return Ok(result);
        }

        [HttpGet(Name = "GetJsonData")]
        [ResponseCache(CacheProfileName = "Any-60")]
        public async Task<IActionResult> GetJsonData(
            [Required] MoveBankEntityType entityType,
            [Required] long studyId,
            [SortOrderValidator] string sortOrder = "ASC")
        {
            var jsonString = await _moveBankService.GetJsonDataAsync(entityType, studyId, sortOrder, User.IsInRole(RoleNames.Administrator));
            return Content(jsonString, "application/json");
        }

        [HttpPost(Name = "GetEventData")]
        [ResponseCache(CacheProfileName = "NoCache")]
        public async Task<IActionResult> GetEventData([FromBody] EventRequest request)
        {
            var collection = await _moveBankService.GetEventDataAsync(request);
            var jsonString = JsonSerializer.Serialize(collection, new JsonSerializerOptions
            {
                PropertyNamingPolicy = null,
                NumberHandling = JsonNumberHandling.AllowNamedFloatingPointLiterals
            });
            return Ok(jsonString);
        }
    }
}
