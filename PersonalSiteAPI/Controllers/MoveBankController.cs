using CsvHelper;
using Mapster;
using MapsterMapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Newtonsoft.Json;
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
using PersonalSiteAPI.DTO.GeoJSON;
using JsonSerializer = System.Text.Json.JsonSerializer;

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
        private readonly IMapper _mapper;

        public MoveBankController(
            ApplicationDbContext context,
            ILogger<AccountController> logger,
            IMoveBankService moveBankService,
            IMemoryCache memoryCache,
            UserManager<ApplicationUser> userManager,
            IMapper mapper)
        {
            _context = context;
            _logger = logger;
            _moveBankService = moveBankService;
            _memoryCache = memoryCache;
            _userManager = userManager;
            _mapper = mapper;
        }

        // INFO: Not in use.
        [HttpGet(Name = "AutoComplete")]
        [Authorize(Roles = $"{RoleNames.Administrator}, {RoleNames.Moderator}")]
        public async Task<IActionResult> AutoComplete(
            [MaxLength(200)] string prefix = "",
            long maxCount = 10)
        {
            try
            {
                var words = await _moveBankService.GetWordsWithPrefix(prefix, maxCount,
                    User.IsInRole(RoleNames.Administrator));

                return Ok(words);
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
                if (study is null)
                {
                    return Unauthorized();
                }

                var studyDto = study.Adapt<StudyDTO>();
                if (User.IsInRole(RoleNames.Administrator))
                {
                    return studyDto;
                }
                if (!ValidLicense(study))
                {
                    return Unauthorized("User is not authorized.");
                }

                var cacheOptions = new MemoryCacheEntryOptions()
                {
                    Size = 1,
                    SlidingExpiration = TimeSpan.FromMinutes(2),
                    AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5)
                };
                _memoryCache.Set(cacheKey, study, cacheOptions);
                return studyDto;
            }
            catch (Exception error)
            {
                return Unauthorized(error.Message);
            }
        }

        // TODO: Consider all of the studies in cache and then molding the data afterwards.
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
                    source = source.Where(_validLicenseExp);
                    authorized = false;
                }

                // TODO: New Idea; if the entire table has been stored in memory cache then just shape this data rather than making an api call.
                var cacheKey = $"GetStudies: {authorized}-{pageIndex}-{pageSize}-{sortColumn}-{sortOrder}-{filterColumn}-{filterQuery}";
                if (_memoryCache.TryGetValue<ApiResult<StudyDTO>>(cacheKey, out var storedResult))
                {
                    Console.WriteLine("Using cached result in GetStudies");
                    Console.WriteLine(storedResult?.Data[0].TimestampFirstDeployedLocation.ToString());
                    return storedResult ?? throw new Exception("Invalid object placed in cache.");
                }


                cacheKey = $"GetAllStudies:{User.IsInRole(RoleNames.Administrator)}";
                if (_memoryCache.TryGetValue<StudyDTO[]>(cacheKey, out var allStudies) && allStudies is not null)
                {
                    Console.WriteLine("Using cached result from GetAllStudies in GetStudies endpoint.");
                    var newSource = !User.IsInRole(RoleNames.Administrator)
                        ? allStudies.Where(ValidLicense) 
                        : allStudies.AsEnumerable();

                    return ApiResult<StudyDTO>.Create(
                        newSource,
                        pageIndex,
                        pageSize,
                        sortColumn,
                        sortOrder,
                        filterColumn,
                        filterQuery);
                }
                // INFO: The type Studies is projected to StudyDTO.
                var dataSource = source.ProjectToType<StudyDTO>();
                // TODO: Store the entire table in cache in apiResult?
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
                if (pageIndex == 0){
                    _memoryCache.Set(cacheKey, apiResult, cacheOptions);    
                }
                // _memoryCache.Set(cacheKey, apiResult, cacheOptions);
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
                      .Where(_validLicenseExp);
                }

                var cacheKey = $"GetAllStudies:{User.IsInRole(RoleNames.Administrator)}";
                if (_memoryCache.TryGetValue<StudyDTO[]>(cacheKey, out var result))
                {
                    Console.WriteLine("Cache hit on GetAllStudies");
                    Console.WriteLine(result?[0].TimestampFirstDeployedLocation.ToString());
                    return result ?? throw new Exception("Unexpected object placed in cache.");
                }

                IQueryable<StudyDTO> dataSource = source.ProjectToType<StudyDTO>();

                // TODO: refactor to use default cache options? 
                var cacheOptions = new MemoryCacheEntryOptions()
                {
                    Size = 1,
                    SlidingExpiration = TimeSpan.FromMinutes(2),
                    AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5)
                };
                result = await dataSource.ToArrayAsync();
                Console.WriteLine("Fetched result from GetAllStudies");
                Console.WriteLine(result[0].TimestampFirstDeployedLocation.ToString());
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
            [Required] long studyId,
            [SortOrderValidator] string sortOrder = "ASC")
        {
            try
            {
                Console.WriteLine("Calling GetJsonData");
                Dictionary<string, string?> parameters = new() { };

                var cacheKey = $"GetJsonData:{entityType}-{studyId}";
                if (_memoryCache.TryGetValue<object>(cacheKey, out var result) && result is not null)
                {
                    var sortedResult = SortObjects(sortOrder, result);
                    return sortedResult is not null ? Ok(JsonConvert.SerializeObject(result)) : throw new Exception("Invalid Object Found in Cache.");
                }

                // TODO: This service method might be in need of a refactor.
                // Possible options: "csv file", "json text" or null
                var response = await _moveBankService.JsonRequest(
                    studyId: studyId,
                    entityType: entityType,
                    parameters: parameters,
                    headers: null,
                    authorizedUser: User.IsInRole(RoleNames.Administrator));

                if (response is null)
                {
                    Console.WriteLine("null response in jsonRequest");
                    throw new Exception("Json request yielded a null response");
                }

                string? returnType = "json";
                byte[] responseContentArray = await response.Content.ReadAsByteArrayAsync();
                if (responseContentArray.Length == 0)
                {
                    Console.WriteLine("Sending a csv request in GetJsonData");
                    response = await _moveBankService.DirectRequest(
                        studyId: studyId,
                        entityType: entityType,
                        parameters: parameters,
                        headers: null,
                        authorizedUser: User.IsInRole(RoleNames.Administrator));

                    if (response is null) throw new Exception("Null return value on DirectRequest.");
                    responseContentArray = await response.Content.ReadAsByteArrayAsync();
                    returnType = responseContentArray.Length > 0 ? "csv" : null;
                }
                if (returnType is null)
                {
                    throw new UnauthorizedAccessException("GetJsonData: Did not receive a valid response from external api.");
                }

                object? data;
                // NOTE: The CSV file will return the sensor types all capitalized.
                if (returnType == "csv")
                {
                    var memStream = new MemoryStream(responseContentArray);
                    using var stream = new StreamReader(memStream, Encoding.UTF8);
                    using var csvReader = new CsvReader(stream, CultureInfo.InvariantCulture);

                    data = entityType.ToLower() switch
                    {
                        "study" => csvReader.GetRecords<StudiesRecord>().AsQueryable().ProjectToType<StudyJsonDTO>().ToList(),
                        "individual" => csvReader.GetRecords<IndividualRecord>().AsQueryable().ProjectToType<IndividualJsonDTO>().ToList(),
                        "tag" => csvReader.GetRecords<TagRecord>().AsQueryable().ProjectToType<TagJsonDTO>().ToList(),
                        _ => null
                    };
                }
                else
                {
                    data = entityType.ToLower() switch
                    {
                        "study" => JsonSerializer.Deserialize<List<StudyJsonDTO>>(responseContentArray),
                        "individual" => JsonSerializer.Deserialize<List<IndividualJsonDTO>>(responseContentArray),
                        "tag" => JsonSerializer.Deserialize<List<TagJsonDTO>>(responseContentArray),
                        _ => null
                    };
                }

                // TODO: Sort the data before returning it.
                // INFO: The object itself is being placed in cache instead of the serialized string.
                if (data is null)
                {
                    return BadRequest("Invalid return type");
                }

                var sorted = SortObjects(sortOrder, data);
                if (sorted is null)
                {
                    throw new Exception("Invalid object passed to SortObjects method.");
                }

                var jsonString = JsonConvert.SerializeObject(data);
                Console.WriteLine(jsonString);
                var cacheOptions = new MemoryCacheEntryOptions()
                {
                    Size = 1,
                    SlidingExpiration = TimeSpan.FromMinutes(2),
                    AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5)
                };

                _memoryCache.Set(cacheKey, sorted, cacheOptions);
                return Ok(jsonString);
            }
            catch (Exception error)
            {
                Console.WriteLine(error.Message);
                return StatusCode(StatusCodes.Status500InternalServerError);
            }
        }

        private static object? SortObjects(string sortOrder, object? jsonObjects)
        {
            if (jsonObjects is null)
            {
                return null;
            }
            if (sortOrder.ToUpper() == "ASC")
            {
                return jsonObjects switch
                {
                    List<StudyJsonDTO> studies => studies.OrderBy(s => s.Name).ToList(),
                    List<IndividualJsonDTO> individuals => individuals.OrderBy(i => i.LocalIdentifier).ToList(),
                    List<TagJsonDTO> tagged => tagged.OrderBy(t => t.LocalIdentifier).ToList(),
                    _ => null,
                };
            }
            return jsonObjects switch
            {
                List<StudyJsonDTO> studies => studies.OrderByDescending(s => s.Name).ToList(),
                List<IndividualJsonDTO> individuals => individuals.OrderByDescending(i => i.LocalIdentifier).ToList(),
                List<TagJsonDTO> tagged => tagged.OrderByDescending(t => t.LocalIdentifier).ToList(),
                _ => null,
            };
        }
        // TODO: This method needs more validation. 
        // 1) Check model state for validation state
        // 2) Sort data by timestamp.
        // 3) Include DateTime objects
        [HttpGet(Name = "GetEventData")]
        [ResponseCache(CacheProfileName = "Any-60")]
        public async Task<ActionResult<EventJsonDTO>> GetEventData(
            [Required][FromQuery] List<string> individualLocalIdentifiers,
            [Required] long studyId,
            [Required] string sensorType,
            int? maxEventsPerIndividual = null,
            long? timestampStart = null,
            long? timestampEnd = null,
            string? attributes = null,
            string? eventProfiles = null,
            string? geoJsonFormat = null)
        {
            try
            {
                var parameters = new Dictionary<string, string?>();

                if (maxEventsPerIndividual is not null)
                {
                    parameters.Add("max_events_per_individual", maxEventsPerIndividual.ToString());
                }
                // TODO: JsonRequest has support for additional attributes if they're provided.
                if (attributes is not null)
                {
                    parameters.Add("attributes", attributes);
                }
                // These timestamp as given in Unix Epoch time
                if (timestampStart is not null && timestampEnd is not null && timestampEnd >= timestampStart)
                {
                    parameters.Add("timestamp_start", timestampStart.ToString());
                    parameters.Add("timestamp_end", timestampEnd.ToString());
                }

                var response = await _moveBankService.JsonEventData(
                    studyId: studyId,
                    sensorType: sensorType,
                    individualLocalIdentifiers: individualLocalIdentifiers.ToImmutableArray(),
                    parameters: parameters,
                    eventProfile: eventProfiles,
                    headers: null,
                    authorizedUser: User.IsInRole(RoleNames.Administrator));

                var responseContentArray = await response.Content.ReadAsByteArrayAsync();
                var responseType = "json";
                if (responseContentArray.Length == 0)
                {
                    Console.WriteLine("Sending csv request for event data point.");
                    response = await _moveBankService.DirectRequest(
                        entityType: "event",
                        studyId: studyId,
                        parameters: parameters,
                        headers: null,
                        authorizedUser: User.IsInRole(RoleNames.Administrator)
                        );
                    responseType = "csv";
                }

                Console.WriteLine($"Response type = {responseType} for event data endpoint.");
                if (response is null)
                {
                    throw new InvalidOperationException("Null response from movebank service");
                }
                var responseString = Encoding.UTF8.GetString(responseContentArray);
                // TODO: This pattern is incomplete for the "csv" case
                // If a CSV request was sent then deserialize using csvHelper. 
                // Consider sending more fields to the frontend. (if I ever switch to only using CSV requests)
                EventJsonDTO? data;
                if (responseType == "json")
                {
                    data = JsonSerializer.Deserialize<EventJsonDTO>(responseString);
                }
                else
                {
                    Console.WriteLine("No Content Available For Public Viewing.");
                    return StatusCode(StatusCodes.Status403Forbidden);
                    // If User is authorized, then considering sending another request with more permissions
                    // and return a GeoJSON response.
                    
                    // var memStream = new MemoryStream(responseContentArray);
                    // using var stream = new StreamReader(memStream, Encoding.UTF8);
                    // using var csvReader = new CsvReader(stream, CultureInfo.InvariantCulture);
                    // data = null;
                }
                
                if (data is null)
                {
                    throw new Exception("Data was null");
                }
                if (geoJsonFormat is null)
                {

                    Console.WriteLine("Returning unprocessed json data");
                    return new JsonResult(data);
                }

                data.IndividualEvents.ForEach(l => l.Locations.Sort((x, y) => x.Timestamp.CompareTo(y.Timestamp)));
                Console.WriteLine($"Response has {data.IndividualEvents.Aggregate(0, (prev, val) => prev + val.Locations.Count)} events.");

                object collection;
                switch (geoJsonFormat.ToLower())
                {
                    case "linestring":
                        var lineCollections = LineStringFeatureCollection<LineStringProperties>
                            .CombineLineStringFeatures(data);
                        
                        collection = lineCollections;
                        break;

                    case "point":
                        var pointCollection = PointFeatureCollection<PointProperties>
                            .CombinePointFeatures(data, PropertyFunc);
                        
                        collection = pointCollection;
                        break;
                    
                    default:
                        throw new ArgumentException("GeoJSON parameter was passed an invalid value.");
                }
                
                return new JsonResult(collection);
                

                PointProperties PropertyFunc(LocationJsonDTO location) => new()
                {
                    Date = TimestampToDateTime(location.Timestamp), 
                    DateString = FormatTimestamp(location.Timestamp),
                    Timestamp = location.Timestamp
                };
            }
            catch (Exception error)
            {
                Console.WriteLine(error.Message);
                return StatusCode(StatusCodes.Status500InternalServerError);
            }
        }

        private static DateTime TimestampToDateTime(long timestamp)
        {
            return DateTimeOffset.FromUnixTimeMilliseconds(timestamp).LocalDateTime;
        }
        private static string FormatTimestamp(long timestamp)
        {
            var date = DateTimeOffset.FromUnixTimeMilliseconds(timestamp).LocalDateTime;
            return "Date: " + date.ToLongDateString() + " Time: " + date.ToLongTimeString();
        }


        private readonly Expression<Func<Studies, bool>> _validLicenseExp = study => study.LicenseType == "CC_0" || study.LicenseType == "CC_BY" || study.LicenseType == "CC_BY_NC";
        // private readonly Expression<Func<Studies, bool>> _hasDownloadAccess = study => study.IHaveDownloadAccess;
        // private readonly Expression<Func<StudyDTO, bool>> _validLicenseExpDto = study => study.LicenseType == "CC_0" || study.LicenseType == "CC_BY" || study.LicenseType == "CC_BY_NC";

        private static bool ValidLicense(Studies study)
        {
            string[] licenses = { "CC_0", "CC_BY", "CC_BY_NC" };
            return licenses.Contains(study.LicenseType.Trim());
        }

        private static bool ValidLicense(StudyDTO study)
        {
            if (study.LicenseType is null)
            {
                return false;
            }
            string[] licenses = { "CC_0", "CC_BY", "CC_BY_NC" };
            return licenses.Contains(study.LicenseType.Trim());
        }
    }
}
