﻿using CsvHelper;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using MyBGList.Attributes;
using Newtonsoft.Json;
//using Newtonsoft.Json;
//using ThirdParty.Json.LitJson/
using PersonalSiteAPI.Attributes;
using PersonalSiteAPI.Attributes.MoveBankAttributes;
using PersonalSiteAPI.Constants;
using PersonalSiteAPI.DTO;
using PersonalSiteAPI.DTO.MoveBankAttributes;
using PersonalSiteAPI.DTO.MoveBankAttributes.DirectReadDTOs;
using PersonalSiteAPI.DTO.MoveBankAttributes.JsonDTOs;
using PersonalSiteAPI.Models;
using PersonalSiteAPI.Services;
using System.Collections.Immutable;
using System.ComponentModel.DataAnnotations;
using System.Globalization;
using System.Linq.Expressions;
using System.Text;

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

        [HttpGet(Name = "GetJsonData")]
        [ResponseCache(CacheProfileName = "Any-60")]
        public async Task<IActionResult> GetJsonData(
            [Required][EntityTypeValidator] string entityType,
            [Required] long studyId)
        {
            try
            {
                Console.WriteLine("Calling GetJsonData");
                Dictionary<string, string?> parameters = new()
                {
                    //{ "study_id", studyId.ToString() }
                };

                var cacheKey = $"GetJsonData:{entityType}-{studyId}";
                if (_memoryCache.TryGetValue<string>(cacheKey, out var result) && result is not null)
                {
                    Console.WriteLine("GetJsonData: Returning cached result");
                    return Ok(result);
                }


                var responseTuple = await _moveBankService.JsonRequest(
                    studyId: studyId,
                    entityType: entityType,
                    parameters: parameters,
                    headers: null,
                    authorizedUser: User.IsInRole(RoleNames.Administrator));

                (var response, bool gotPermission) = responseTuple;
                var responseStream = await response.Content.ReadAsStreamAsync();
                // 

                object? data;
                if (response is null || responseStream.Length == 0)
                {
                    return BadRequest($"Passed invalid parameters to move bank service. Response has size {responseStream.Length}");
                }

                var jsonOptions = new Newtonsoft.Json.JsonSerializerSettings();

                if (gotPermission)
                {
                    Console.WriteLine("Returning CSV file.");
                    using var stream = new StreamReader(await response.Content.ReadAsStreamAsync(), Encoding.UTF8);
                    using var csvReader = new CsvReader(stream, CultureInfo.InvariantCulture);

                    switch (entityType.ToLower())
                    {
                        case "study":
                            var studyRecords = csvReader.GetRecords<StudiesRecord>().Select(studyRecord => new StudyJsonDTO()
                            {
                                Id = studyRecord.Id,
                                Name = studyRecord.Name ?? "",
                                SensorTypeIds = studyRecord.SensorTypeIds
                            });
                            return new JsonResult(studyRecords.ToList(), jsonOptions);

                        case "individual":
                            var individualRecords = csvReader.GetRecords<IndividualRecord>().Select(individualRecord => new IndividualJsonDTO()
                            {
                                Id = individualRecord.Id,
                                LocalIdentifier = individualRecord.LocalIdentifier ?? string.Empty
                            });
                            return new JsonResult(individualRecords.ToList(), jsonOptions);

                        case "tag":
                            // TODO - Look into the actual type returned movebank's api
                            var tagRecords = csvReader.GetRecords<TagRecord>().Select(tagRecord => new TagJsonDTO()
                            {
                                Id = tagRecord.Id,
                                LocalIdentifier = tagRecord.LocalIdentifier
                            });
                            return new JsonResult(tagRecords.ToList(), jsonOptions);

                        default:
                            throw new InvalidOperationException("Invalid parameter for entity type");
                    }
                }
                switch (entityType.ToLower())
                {
                    case "study":
                        data = await response.Content.ReadFromJsonAsync<List<StudyJsonDTO>>();
                        break;

                    case "individual":
                        data = await response.Content.ReadFromJsonAsync<List<IndividualJsonDTO>>();
                        break;

                    case "tag":
                        data = await response.Content.ReadFromJsonAsync<List<TagJsonDTO>>();
                        break;

                    default:
                        return BadRequest("Invalid entity type.");
                }

                if (data is not null)
                {
                    var jsonString = JsonConvert.SerializeObject(data);
                    Console.WriteLine("Final json string is " + jsonString);

                    var cacheOptions = new MemoryCacheEntryOptions()
                    {
                        Size = 1,
                        SlidingExpiration = TimeSpan.FromMinutes(2),
                        AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5)
                    };

                    _memoryCache.Set(cacheKey, jsonString, cacheOptions);
                    return Ok(jsonString);
                }
                else
                {
                    throw new InvalidOperationException();
                }

            }
            catch (Exception error)
            {
                Console.WriteLine(error.Message);
                return StatusCode(StatusCodes.Status500InternalServerError);
            }
        }

        // NOTE: 
        // TODO: Figure out a caching strategy
        // 1) Work out a plan for a caching service 
        // to reuse overlapping data 
        // 2) Check model state for validation state
        [HttpGet(Name = "GetEventData")]
        [ResponseCache(CacheProfileName = "Any-60")]
        public async Task<ActionResult<EventJsonDTO>> GetEventData(
            [Required][FromQuery] List<string> individualLocalIdentifiers,
            [Required] long studyId,
            [Required] string sensorType,
            [GreaterThanZero] int? maxEventsPerIndividual = null,
            long? timestampStart = null,
            long? timestampEnd = null,
            string? attributes = null,
            string? eventProfiles = null)
        {
            try
            {
                var parameters = new Dictionary<string, string?>();

                if (maxEventsPerIndividual is int numEvents)
                {
                    parameters.Add("max_events_per_individual", numEvents.ToString());
                }

                if (attributes is not null)
                {
                    parameters.Add("attributes", attributes);
                }
                // These timestamp as given in Unix Epoch time
                if (timestampStart is long start && timestampEnd is long end && end >= start)
                {
                    parameters.Add("timestamp_start", start.ToString());
                    parameters.Add("timestamp_end", end.ToString());
                }

                var response = await _moveBankService.JsonEventData(
                    studyId: studyId,
                    sensorType: sensorType,
                    individualLocalIdentifiers: individualLocalIdentifiers.ToImmutableArray(),
                    parameters: parameters,
                    eventProfile: eventProfiles,
                    headers: null,
                    authorizedUser: User.IsInRole(RoleNames.Administrator));

                var data = await response.Content.ReadFromJsonAsync<EventJsonDTO>();

                if (data is not null)
                {
                    return data;
                }
                else
                {
                    throw new Exception("Data was null.");
                }

            }
            catch (Exception error)
            {
                Console.WriteLine(error.Message);
                return StatusCode(StatusCodes.Status500InternalServerError);
            }
        }
        // private static EventJsonDTO CombineResults()

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
