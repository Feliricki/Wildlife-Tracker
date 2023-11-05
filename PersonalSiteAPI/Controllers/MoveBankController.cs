using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using MyBGList.Attributes;
using PersonalSiteAPI.Attributes;
using PersonalSiteAPI.Constants;
using PersonalSiteAPI.DTO;
using PersonalSiteAPI.DTO.MoveBankAttributes;
using PersonalSiteAPI.DTO.MoveBankAttributes.JsonDTOs;
using PersonalSiteAPI.Mappings;
using PersonalSiteAPI.Models;
using PersonalSiteAPI.Services;
using System.Collections.Immutable;
using System.ComponentModel.DataAnnotations;
using System.Linq.Expressions;

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
        private readonly IHttpContextAccessor _contextAccessor;
        //private readonly IHttpContextAccessor 

        public MoveBankController(
            ApplicationDbContext context,
            ILogger<AccountController> logger,
            IMoveBankService moveBankService,
            IMemoryCache memoryCache,
            UserManager<ApplicationUser> userManager,
            IHttpContextAccessor contextAccessor)
        {
            _context = context;
            _logger = logger;
            _moveBankService = moveBankService;
            _memoryCache = memoryCache;
            _userManager = userManager;
            _contextAccessor = contextAccessor;
        }

        // GET: api/<MoveBankController>
        [HttpGet(Name = "GetToken")]
        [Authorize(Roles = $"{RoleNames.Administrator}, {RoleNames.Moderator}")]
        public async Task<ActionResult<ApiTokenResultDTO>> GetToken()
        {
            try
            {
                var response = await _moveBankService.GetApiToken() ?? throw new Exception("Unable to retrieve api token.");
                return Ok(response);
            }
            catch (Exception e)
            {
                var exceptionDetails = new ProblemDetails
                {
                    Detail = e.Message,
                    Status = StatusCodes.Status500InternalServerError,
                };
                return StatusCode(StatusCodes.Status500InternalServerError, exceptionDetails);
            }
        }
        // Set proper authorization
        [HttpGet(Name = "GetStudy")]
        [ResponseCache(CacheProfileName = "Any-60")]
        public async Task<ActionResult<StudyDTO>> GetStudy(long studyId)
        {
            try
            {
                // TODO: implement caching
                Console.WriteLine("Calling GetStudy");
                var cacheKey = $"GetStudy: {studyId}";
                Studies? study = null;
                if (!_memoryCache.TryGetValue<Studies>(cacheKey, out var storedResult))
                {
                    study = await _context.Studies.Where(s => s.Id == studyId && s.IHaveDownloadAccess).FirstOrDefaultAsync();
                }
                else
                {
                    study = storedResult;
                }
                if (study == null)
                {
                    return Unauthorized();
                }
                bool authorized = User.IsInRole(RoleNames.Administrator);
                var result = new StudyDTO()
                {
                    Acknowledgements = study.Acknowledgements,
                    Citation = study.Citation,
                    GrantsUsed = study.GrantsUsed,
                    Id = study.Id,
                    LicenseType = study.LicenseType,
                    MainLocationLat = FloatParser(study.MainLocationLat),
                    MainLocationLon = FloatParser(study.MainLocationLon),
                    Name = study.Name,
                    NumberOfDeployments = study.NumberOfDeployments,
                    NumberOfIndividuals = study.NumberOfIndividuals,
                    NumberOfTags = study.NumberOfTags,
                    StudyObjective = study.StudyObjective,
                    TimestampFirstDeployedLocation = study.TimeStampFirstDeployedLocation,
                    TimestampLastDeployedLocation = study.TimeStampLastDeployedLocation,
                    NumberOfDeployedLocations = study.NumberOfDeployedLocations,
                    TaxonIds = study.TaxonIds,
                    SensorTypeIds = study.SensorTypeIds,
                    ContactPersonName = study.ContactPersonName
                };
                if (authorized)
                {
                    return result;
                }
                if (!ValidLicense(study))
                {
                    return Unauthorized("User is not authorized.");
                }
                _memoryCache.Set(cacheKey, study, new TimeSpan(0, 1, 0));
                return result;
            }
            catch (Exception)
            {
                return Unauthorized();
            }
        }

        // TODO: Create custom validators       
        // TODO: Test this method with filterQueries and the sorting of different columns
        [HttpGet(Name = "GetStudies")]
        [ResponseCache(CacheProfileName = "Any-60")]
        public async Task<ActionResult<ApiResult<StudyDTO>>> GetStudies(
            int pageIndex = 0,
            [Range(1, 50)] int pageSize = 10,
            string? sortColumn = "Name",
            [SortOrderValidatorAttribute] string? sortOrder = "ASC",
            string? filterColumn = null,
            string? filterQuery = null)
        {
            try
            {
                Console.WriteLine("Calling GetStudies");

                if (!ModelState.IsValid)
                {
                    return BadRequest();
                }
                //var currentQuery = from s in _context.Studies.AsNoTracking()
                //                   where s.IHaveDownloadAccess select s;
                IQueryable<Studies> source = _context.Studies
                    .AsNoTracking()
                    .Where(study => study.IHaveDownloadAccess);

                bool authorized = true;
                if (!User.IsInRole(RoleNames.Administrator))
                {
                    Console.WriteLine("User is not authorized.");
                    // Valid Licenses are: "CC_0", "CC_BY", "CC_BY_NC"                    
                    source = source.Where(ValidLicenseExp);
                    authorized = false;
                }

                var cacheKey = $"GetStudies: {authorized}-{pageIndex}-{pageSize}-{sortColumn}-{sortOrder}-{filterColumn}-{filterQuery}";
                if (_memoryCache.TryGetValue<ApiResult<StudyDTO>>(cacheKey, out var storedResult))
                {
                    return storedResult ?? throw new NullReferenceException();
                }
                //StudyMapper mapper = new StudyMapper();
                //IEnumerable<StudyDTO> dataSource = mapper.EntityToDTO(await source.ToListAsync());
                IQueryable<StudyDTO> dataSource = source.Select(study => new StudyDTO()
                {
                    Acknowledgements = study.Acknowledgements,
                    Citation = study.Citation,
                    GrantsUsed = study.GrantsUsed,
                    Id = study.Id,
                    LicenseType = study.LicenseType,
                    MainLocationLat = FloatParser(study.MainLocationLat),
                    MainLocationLon = FloatParser(study.MainLocationLon),
                    Name = study.Name,
                    NumberOfDeployments = study.NumberOfDeployments,
                    NumberOfIndividuals = study.NumberOfIndividuals,
                    NumberOfTags = study.NumberOfTags,
                    StudyObjective = study.StudyObjective,
                    TimestampFirstDeployedLocation = study.TimeStampFirstDeployedLocation,
                    TimestampLastDeployedLocation = study.TimeStampLastDeployedLocation,
                    NumberOfDeployedLocations = study.NumberOfDeployedLocations,
                    TaxonIds = study.TaxonIds,
                    SensorTypeIds = study.SensorTypeIds,
                    ContactPersonName = study.ContactPersonName
                });

                ApiResult<StudyDTO> apiResult = await ApiResult<StudyDTO>.CreateAsync(
                    dataSource,
                    pageIndex,
                    pageSize,
                    sortColumn,
                    sortOrder,
                    filterColumn,
                    filterQuery);

                // Tentatively, cache the result for 1 minute.
                var cacheOptions = new MemoryCacheEntryOptions()
                {
                    Size = 1,
                    SlidingExpiration = TimeSpan.FromMinutes(2),
                    AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5)
                };

                _memoryCache.Set(cacheKey, apiResult, cacheOptions);
                return apiResult;
            }
            catch (Exception e)
            {
                Console.WriteLine(e.Message);
                return StatusCode(StatusCodes.Status500InternalServerError);
            }
        }
        [HttpGet(Name = "GetAllStudies")]
        [ResponseCache(CacheProfileName = "Any-60")]
        public async Task<ActionResult<StudyDTO[]>> GetAllStudies()
        {
            try
            {
                IQueryable<Studies> source = _context.Studies
                    .AsNoTracking()
                    .Where(study => study.IHaveDownloadAccess);

                if (!User.IsInRole(RoleNames.Administrator))
                {
                    Console.WriteLine("User is not authorized");
                    source = source
                      .Where(ValidLicenseExp);
                }
                var cacheKey = "GetAllStudies";
                if (_memoryCache.TryGetValue<StudyDTO[]>(cacheKey, out var result))
                {
                    Console.WriteLine("Cache hit on GetAllStudies");
                    return result!;
                }

                IQueryable<StudyDTO> dataSource = source.Select(study => new StudyDTO()
                {
                    Acknowledgements = study.Acknowledgements,
                    Citation = study.Citation,
                    GrantsUsed = study.GrantsUsed,
                    Id = study.Id,
                    LicenseType = study.LicenseType,
                    MainLocationLat = FloatParser(study.MainLocationLat),
                    MainLocationLon = FloatParser(study.MainLocationLon),
                    Name = study.Name,
                    NumberOfDeployments = study.NumberOfDeployments,
                    NumberOfIndividuals = study.NumberOfIndividuals,
                    NumberOfTags = study.NumberOfTags,
                    StudyObjective = study.StudyObjective,
                    TimestampFirstDeployedLocation = study.TimeStampFirstDeployedLocation,
                    TimestampLastDeployedLocation = study.TimeStampLastDeployedLocation,
                    NumberOfDeployedLocations = study.NumberOfDeployedLocations,
                    TaxonIds = study.TaxonIds,
                    SensorTypeIds = study.SensorTypeIds,
                    ContactPersonName = study.ContactPersonName
                });

                // TODO: refactor to use default cache options? 
                // Then I'll switch this only use a new TimeSpan Object
                var cacheOptions = new MemoryCacheEntryOptions()
                {
                    Size = 1,
                    SlidingExpiration = TimeSpan.FromMinutes(2),
                    AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5)
                };
                result = await dataSource.ToArrayAsync();
                _memoryCache.Set(cacheKey, result, cacheOptions);

                return result;
            }
            catch (Exception error)
            {
                Console.WriteLine(error.Message);
                return StatusCode(StatusCodes.Status503ServiceUnavailable);
            }
        }

        // TODO: Implement custom input validators here.
        // Implement a authenticated version of the PublicJsonRequest method
        [HttpGet(Name="GetEventData")]
        [ResponseCache(CacheProfileName = "Any-60")]
        public async Task<ActionResult<EventJsonDTO>> GetEventData(
            string[] individual_local_identifiers,
            long studyId,
            string sensorType,
            string[]? eventProfiles=null,
            string[]? attributes=null)
        {
            try
            {
                // Use memory cache as always 
                var cacheKey = $"GetEventData:{individual_local_identifiers}-{studyId}-{eventProfiles}-{sensorType}-{attributes}";
                if (_memoryCache.TryGetValue<EventJsonDTO>(cacheKey, out var result))
                {
                    return result ?? throw new NullReferenceException();
                }           
                // The event profile is the only optional parameter being passed
                // Use the EU_RING_01 profile in 
                var response = await _moveBankService.PublicJsonRequest(studyId, sensorType, individual_local_identifiers.ToImmutableArray(), null, eventProfiles);
                var data = await response.Content.ReadFromJsonAsync<EventJsonDTO>();
                
                if (data != null)
                {
                    _memoryCache.Set(cacheKey, data);
                    return data;
                }
                else
                {
                    throw new Exception();
                }

            } catch (Exception error)
            {
                Console.WriteLine(error.Message);
                return StatusCode(StatusCodes.Status500InternalServerError);
            }
        }


        protected static float? FloatParser(string? num)
        {
            if (num == null)
            {
                return null;
            }
            if (float.TryParse(num, out var floatNum))
            {
                return floatNum;
            }
            else
            {
                return null;
            }
        }
        private readonly Expression<Func<Studies, bool>> ValidLicenseExp = study => study.LicenseType == "CC_0" || study.LicenseType == "CC_BY" || study.LicenseType == "CC_BY_NC";
        protected bool ValidLicense(Studies study)
        {
            string[] licenses = { "CC_0", "CC_BY", "CC_BY_NC" };
            return licenses.Contains(study.LicenseType.Trim());
        }
    }
}
