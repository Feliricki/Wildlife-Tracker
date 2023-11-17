﻿using CsvHelper;
using Mapster;
using MapsterMapper;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using MyBGList.Attributes;
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
//using Mapster.Models.
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

                // TODO: This service method might be in need of a refactor.
                // The method should convey what type is being returned in the response
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
                // This is the fallthrough if movebank's json endpoint is available
                if (responseContentArray.Length == 0)
                {
                    response = await _moveBankService.DirectRequest(
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

                object? data = null;
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
                    Console.WriteLine("csv: " + JsonConvert.SerializeObject(data));
                }
                else
                {
                    var responseString = Encoding.UTF8.GetString(responseContentArray);                    
                    data = entityType.ToLower() switch
                    {
                        "study" => JsonConvert.DeserializeObject<List<StudyJsonDTO>>(responseString),
                        "individual" => JsonConvert.DeserializeObject<List<IndividualJsonDTO>>(responseString),
                        "tag" => JsonConvert.DeserializeObject<List<TagJsonDTO>>(responseString), 
                        _ => null
                    };
                    Console.WriteLine("json: " + JsonConvert.SerializeObject(data));
                }

                if (data is not null)
                {
                    var jsonString = JsonConvert.SerializeObject(data);
                    return Ok(jsonString);
                }
                else
                {
                    return BadRequest("Invalid return type");
                }
                //if (gotPermission)
                //{
                //    Console.WriteLine("Returning CSV file.");
                //    var memStream = new MemoryStream(responseContentArray);
                //    using var stream = new StreamReader(memStream, Encoding.UTF8);
                //    using var csvReader = new CsvReader(stream, CultureInfo.InvariantCulture);

                //    switch (entityType.ToLower())
                //    {
                //        case "study":
                //            var studyRecords = csvReader.GetRecords<StudiesRecord>().Select(studyRecord => new StudyJsonDTO()
                //            {
                //                Id = studyRecord.Id,
                //                Name = studyRecord.Name ?? "",
                //                SensorTypeIds = studyRecord.SensorTypeIds
                //            });
                //            data = studyRecords.ToList();
                //            break;

                //        case "individual":
                //            var individualRecords = csvReader.GetRecords<IndividualRecord>().Select(individualRecord => new IndividualJsonDTO()
                //            {
                //                Id = individualRecord.Id,
                //                LocalIdentifier = individualRecord.LocalIdentifier ?? string.Empty
                //            });
                //            data = individualRecords.ToList();
                //            break;

                //        case "tag":
                //            // TODO - Look into the actual type returned movebank's api
                //            var tagRecords = csvReader.GetRecords<TagRecord>().Select(tagRecord => new TagJsonDTO()
                //            {
                //                Id = tagRecord.Id,
                //                LocalIdentifier = tagRecord.LocalIdentifier
                //            });
                //            data = tagRecords.ToList();
                //            break;

                //        default:
                //            return BadRequest("Invalid entity type.");
                //    }
                //}
                //else
                //{
                //    var responseString = Encoding.UTF8.GetString(responseContentArray);
                //    switch (entityType.ToLower())
                //    {
                //        case "study":
                //            data = JsonConvert.DeserializeObject<List<StudyJsonDTO>>(responseString);
                //            break;

                //        case "individual":
                //            data = JsonConvert.DeserializeObject<List<IndividualJsonDTO>>(responseString);
                //            break;

                //        case "tag":
                //            //data = await response.Content.ReadFromJsonAsync<List<TagJsonDTO>>();
                //            data = JsonConvert.DeserializeObject<List<TagJsonDTO>>(responseString);
                //            break;

                //        default:
                //            return BadRequest("Invalid entity type.");
                //    }
                //}

                //if (data is not null)
                //{
                //    var jsonString = JsonConvert.SerializeObject(data);
                //    Console.WriteLine("Final json string is " + jsonString);

                //    var cacheOptions = new MemoryCacheEntryOptions()
                //    {
                //        Size = 1,
                //        SlidingExpiration = TimeSpan.FromMinutes(2),
                //        AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5)
                //    };

                //    _memoryCache.Set(cacheKey, jsonString, cacheOptions);
                //    return Ok(jsonString);
                //}
                //else
                //{
                //    throw new InvalidOperationException();
                //}

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
