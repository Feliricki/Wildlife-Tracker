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
using System.Text.Json;
using System.Text.Json.Serialization;
using PersonalSiteAPI.DTO.GeoJSON;
using JsonSerializer = System.Text.Json.JsonSerializer;
using PersonalSiteAPI.DTO.MoveBankAttributes.DirectReadRecords;
using System.Diagnostics;

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

        // TODO:Include a parameters to format the data in geojson format.
        // In this case, the return type is either StudyDTO[] or a FeatureCollection of type of points with the appropriate properties set.
        [HttpGet(Name = "GetAllStudies")]
        [ResponseCache(CacheProfileName = "Any-60")]
        public async Task<IActionResult> GetAllStudies(bool geojsonFormat = false)
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
                
                var cacheKey = $"GetAllStudies:{User.IsInRole(RoleNames.Administrator)}-{geojsonFormat}";
                if (_memoryCache.TryGetValue<object>(cacheKey, out var result))
                {
                    Console.WriteLine($"Cache hit on GetAllStudies with key {cacheKey}");
                    return result != null ? Ok(result) : throw new Exception("Unexpected object placed in cache in GetAllStudies.");
                }
            
                // In this case the return type will be of type StudyDTO[].
                IQueryable<StudyDTO> dataSource = source.ProjectToType<StudyDTO>();

                if (geojsonFormat)
                {
                    // TODO: The conversion that needs to take place is from IEnumerable<StudyDTO> to FeatureCollection.
                    var studies = await dataSource.ToArrayAsync();
                    var collection = PointFeatureCollection<StudyDTO>.CreateFromStudies(studies, Func);

                    var cacheOptions = new MemoryCacheEntryOptions
                    {
                        Size = 1,
                        SlidingExpiration = TimeSpan.FromMinutes(2),
                        AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5)
                    };
                    _memoryCache.Set(cacheKey, collection, cacheOptions);
                    // Console.WriteLine(JsonConvert.SerializeObject(collection));
                    return Ok(collection);
                }
                else
                {
                    // TODO:Refactor to use default cache options? 
                    var cacheOptions = new MemoryCacheEntryOptions
                    {
                        Size = 1,
                        SlidingExpiration = TimeSpan.FromMinutes(2),
                        AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5)
                    };
                    result = await dataSource.ToArrayAsync();
                    // if (result is null)
                    // {
                    //     throw new Exception("Result from database is null");
                    // }
                    _memoryCache.Set(cacheKey, result, cacheOptions);
                    return Ok(result);    
                }
                StudyDTO Func(StudyDTO study) => study;
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

        // TODO: This method is in need of validation.
        [HttpPost(Name = "GetEventData")]
        [ResponseCache(CacheProfileName = "NoCache")]
        public async Task<ActionResult<EventJsonDTO>> GetEventData(
            [FromBody] EventRequest request)
        {
            try
            {
                Console.WriteLine(JsonConvert.SerializeObject(request, Formatting.Indented));

                Stopwatch stopwatch = new();
                stopwatch.Start();

                var response = await _moveBankService.DirectRequestEvents(request);

                stopwatch.Stop();
                Console.WriteLine($"Took {stopwatch.Elapsed / 1000} seconds to recieve a response.");

                if (response is null)
                {
                    throw new InvalidOperationException("Null response from movebank service");
                }
                
                // TODO: Time this operations.                
                var responseContentArray = await response.Content.ReadAsByteArrayAsync();

                stopwatch = new Stopwatch();
                stopwatch.Start();

                var memStream = new MemoryStream(responseContentArray);
                using var stream = new StreamReader(memStream, Encoding.UTF8);
                using var csvReader = new CsvReader(stream, CultureInfo.InvariantCulture);

                var records = new List<EventRecord>();
                while (await csvReader.ReadAsync())
                {
                    var record = csvReader.GetRecord<EventRecord>();
                    if (record?.Timestamp is null || record.LocationLat is null || record.LocationLong is null)
                    {
                        continue;
                    }
                    records.Add(record);
                }

                stopwatch.Stop();
                Console.WriteLine($"It took {stopwatch.Elapsed / 1000} seconds to process all records");


                stopwatch = new Stopwatch();
                stopwatch.Start();

                var data = LineStringFeatureCollection<LineStringPropertiesV1>.RecordToEventJsonDto(records, request.StudyId);
                stopwatch.Stop();

                Console.WriteLine($"Converted {records.Count} records to data with {data.IndividualEvents.Count} individuals and processed records to linestrings collections in {stopwatch.Elapsed / 1000} seconds.");
                
                if (data is null)
          {
                    throw new Exception("Data was null");
                }
                if (request.GeometryType is null)
                {
                    Console.WriteLine("Returning unprocessed json data");
                    return new JsonResult(data);
                }

                stopwatch = new Stopwatch();
                stopwatch.Start();

                data.IndividualEvents.ForEach(l => l.Locations.Sort((x, y) => x.Timestamp.CompareTo(y.Timestamp)));
                stopwatch.Stop();

                Console.WriteLine($"Response has {data.IndividualEvents.Aggregate(0, (prev, val) => prev + val.Locations.Count)} events. Sorted all events in {stopwatch.Elapsed / 1000} seconds");

                object collection;
                switch (request.GeometryType.ToLower())
                {
                    case "linestring":
                        stopwatch = new Stopwatch();
                        stopwatch.Start();

                        var lineCollections = LineStringFeatureCollection<LineStringPropertiesV1>
                            .CombineLineStringFeatures(data);
                        
                        stopwatch.Stop();
                        Console.WriteLine($"Time elapsed: {stopwatch.Elapsed / 1000} seconds to create line collection");

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

                // return new JsonResult(collection);
                
                var jsonString = JsonSerializer.Serialize(collection, new JsonSerializerOptions
                {
                    PropertyNamingPolicy = null,
                    NumberHandling = JsonNumberHandling.AllowNamedFloatingPointLiterals
                });
                return Ok(jsonString);

                static PointProperties PropertyFunc(LocationJsonDTO location) => new()
                {
                    Date = TimestampToDateTime(location.Timestamp), 
                    DateString = FormatTimestamp(location.Timestamp),
                    Timestamp = location.Timestamp
                };
            }
            catch(TimeoutException timeoutError)
            {
                return StatusCode(StatusCodes.Status408RequestTimeout, timeoutError);
            }            
            catch (Exception error)
            {
                return StatusCode(StatusCodes.Status500InternalServerError, error);
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
