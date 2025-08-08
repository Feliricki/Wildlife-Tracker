using Amazon.SecretsManager;
using Amazon.SecretsManager.Extensions.Caching;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.WebUtilities;
using WildlifeTrackerAPI.DTO;
using WildlifeTrackerAPI.Extensions;
using Amazon.SecretsManager.Model;
using System.Globalization;
using System.Security.Cryptography;
using System.Collections.Immutable;
using Microsoft.IdentityModel.Tokens;
using Mapster;
using System.Linq.Expressions;
using WildlifeTrackerAPI.Models;
using WildlifeTrackerAPI.DTO.GeoJSON;
using Microsoft.EntityFrameworkCore;
using CsvHelper;
using System.IO;
using System.Text;
using System.Globalization;
using WildlifeTrackerAPI.DTO.MoveBankAttributes.DirectReadRecords;
using WildlifeTrackerAPI.DTO.MoveBankAttributes.JsonDTOs;
using System.Text.Json;
using JsonSerializer = System.Text.Json.JsonSerializer;
using EventRequest = WildlifeTrackerAPI.DTO.MoveBankAttributes.EventRequest;
using WildlifeTrackerAPI.Enums;

namespace WildlifeTrackerAPI.Services
{
    public interface IMoveBankService
    {
        Task<ApiTokenResultDTO?> GetApiToken();
        Task<ApiResult<StudyDTO>> GetStudiesAsync(int pageIndex, int pageSize, string? sortColumn, string? sortOrder, string? filterColumn, string? filterQuery, bool isUserAdmin);
        Task<StudyDTO?> GetStudyAsync(long studyId, bool isUserAdmin);
        Task<object> GetAllStudiesAsync(bool isUserAdmin, bool geojsonFormat);
        Task<string> GetJsonDataAsync(MoveBankEntityType entityType, long studyId, string sortOrder, bool isUserAdmin);
        Task<object> GetEventDataAsync(EventRequest request);
        DateTime? GetDateTime(string? dateString);

        Task<HttpResponseMessage?> DirectRequestEvents(EventRequest request);

        Task<HttpResponseMessage?> DirectRequest(
            string entityType,
            long? studyId = null,
            Dictionary<string, string?>? parameters = null,
            (string, string)[]? headers = null,
            bool authorizedUser = false);

        Task<HttpResponseMessage> JsonRequest(
            long studyId,
            string entityType,
            Dictionary<string, string?>? parameters = null,
            (string, string)[]? headers = null,
            bool authorizedUser = false);
        
    }
    public class MoveBankService : IMoveBankService
    {
        private readonly HttpClient _httpClient;
        private readonly IConfiguration _configuration;
        private readonly ILogger<MoveBankService> _logger;
        private readonly IAmazonSecretsManager _amazonSecretsManager;
        private readonly IDataProtectionProvider _provider;
        private readonly ITimeLimitedDataProtector _protector;
        private readonly SecretsManagerCache _secretsCache;
        private readonly IAutoCompleteService _autoCompleteService;
        private readonly IStudyRepository _studyRepository;
        private readonly IApiCachingService _cachingService;

        public MoveBankService(
            HttpClient httpClient,
            IConfiguration configuration,
            ILogger<MoveBankService> logger,
            IAmazonSecretsManager amazonSecretsManager,
            IDataProtectionProvider provider,
            IAutoCompleteService autoCompleteService,
            IStudyRepository studyRepository,
            IApiCachingService cachingService)
        {
            _httpClient = httpClient;
            _configuration = configuration;
            _logger = logger;
            _amazonSecretsManager = amazonSecretsManager;
            _provider = provider;
            _autoCompleteService = autoCompleteService;
            _studyRepository = studyRepository;
            _cachingService = cachingService;
            
            _protector = _provider.CreateProtector("API Token").ToTimeLimitedDataProtector();
            uint durationMinutes = 1;
            _secretsCache = new SecretsManagerCache(
                _amazonSecretsManager,
                new SecretCacheConfiguration
                {
                    CacheItemTTL = durationMinutes,
                    MaxCacheSize = 1024,
                    VersionStage = "AWSCURRENT",
                    Client = _amazonSecretsManager,
                    CacheHook = new MySecretCacheHook(_protector, durationMinutes)
                });
        }
        
        private static readonly Expression<Func<Studies, bool>> _validLicenseExp = study => study.LicenseType == "CC_0" || study.LicenseType == "CC_BY" || study.LicenseType == "CC_BY_NC";

        private static bool IsLicenseValid(Studies study)
        {
            string[] validLicenses = { "CC_0", "CC_BY", "CC_BY_NC" };
            return study.LicenseType != null && validLicenses.Contains(study.LicenseType.Trim());
        }

        public async Task<StudyDTO?> GetStudyAsync(long studyId, bool isUserAdmin)
        {
            var cacheKey = $"GetStudy:{studyId}";
            return await _cachingService.GetOrCreateAsync(cacheKey, async () =>
            {
                var study = await _studyRepository.GetStudyByIdAsync(studyId);

                if (study == null || !study.IHaveDownloadAccess)
                {
                    return null; // Or throw a specific exception
                }

                if (!isUserAdmin && !IsLicenseValid(study))
                {
                    return null; // Or throw an unauthorized exception
                }

                return study.Adapt<StudyDTO>();
            });
        }

        public async Task<object> GetAllStudiesAsync(bool isUserAdmin, bool geojsonFormat)
        {
            var cacheKey = $"GetAllStudies:{isUserAdmin}-{geojsonFormat}";
            return await _cachingService.GetOrCreateAsync(cacheKey, async () =>
            {
                var query = _studyRepository.GetStudiesQuery()
                    .Where(s => s.IHaveDownloadAccess);

                if (!isUserAdmin)
                {
                    query = query.Where(_validLicenseExp);
                }

                var dtoArray = await query.ProjectToType<StudyDTO>().ToArrayAsync();

                if (geojsonFormat)
                {
                    return PointFeatureCollection<StudyDTO>.CreateFromStudies(dtoArray, s => s);
                }

                return dtoArray;
            });
        }

        public async Task<ApiResult<StudyDTO>> GetStudiesAsync(int pageIndex, int pageSize, string? sortColumn, string? sortOrder, string? filterColumn, string? filterQuery, bool isUserAdmin)
        {
            var cacheKey = $"GetStudies:{isUserAdmin}-{pageIndex}-{pageSize}-{sortColumn}-{sortOrder}-{filterColumn}-{filterQuery}";

            return await _cachingService.GetOrCreateAsync(cacheKey, async () =>
            {
                var query = _studyRepository.GetStudiesQuery()
                    .Where(s => s.IHaveDownloadAccess);

                if (!isUserAdmin)
                {
                    query = query.Where(_validLicenseExp);
                }

                var dtoQuery = query.ProjectToType<StudyDTO>();

                return await ApiResult<StudyDTO>.CreateAsync(
                    dtoQuery,
                    pageIndex,
                    pageSize,
                    sortColumn,
                    sortOrder,
                    filterColumn,
                    filterQuery);
            });
        }

        public async Task<string> GetJsonDataAsync(MoveBankEntityType entityType, long studyId, string sortOrder, bool isUserAdmin)
        {
            var cacheKey = $"GetJsonData:{entityType}-{studyId}";
            return await _cachingService.GetOrCreateAsync(cacheKey, async () =>
            {
                Dictionary<string, string?> parameters = [];
                var response = await JsonRequest(
                    studyId: studyId,
                    entityType: entityType.ToString().ToLower(),
                    parameters: parameters,
                    headers: null,
                    authorizedUser: isUserAdmin);

                if (response == null) throw new Exception("Json request yielded a null response");

                string? returnType = "json";
                byte[] responseContentArray = await response.Content.ReadAsByteArrayAsync();
                if (responseContentArray.Length == 0)
                {
                    response = await DirectRequest(
                        studyId: studyId,
                        entityType: entityType,
                        parameters: parameters,
                        headers: null,
                        authorizedUser: isUserAdmin);

                    if (response == null) throw new Exception("Null return value on DirectRequest.");
                    responseContentArray = await response.Content.ReadAsByteArrayAsync();
                    returnType = responseContentArray.Length > 0 ? "csv" : null;
                }
                if (returnType == null)
                {
                    throw new UnauthorizedAccessException("GetJsonData: Did not receive a valid response from external api.");
                }

                object? data;
                if (returnType == "csv")
                {
                    using var memStream = new MemoryStream(responseContentArray);
                    using var stream = new StreamReader(memStream, Encoding.UTF8);
                    using var csvReader = new CsvReader(stream, CultureInfo.InvariantCulture);

                    data = entityType switch
                    {
                        MoveBankEntityType.Study => csvReader.GetRecords<StudiesRecord>().AsQueryable().ProjectToType<StudyJsonDTO>().ToList(),
                        MoveBankEntityType.Individual => csvReader.GetRecords<IndividualRecord>().AsQueryable().ProjectToType<IndividualJsonDTO>().ToList(),
                        MoveBankEntityType.Tag => csvReader.GetRecords<TagRecord>().AsQueryable().ProjectToType<TagJsonDTO>().ToList(),
                        _ => null
                    };
                }
                else
                {
                    data = entityType switch
                    {
                        MoveBankEntityType.Study => JsonSerializer.Deserialize<List<StudyJsonDTO>>(responseContentArray),
                        MoveBankEntityType.Individual => JsonSerializer.Deserialize<List<IndividualJsonDTO>>(responseContentArray),
                        MoveBankEntityType.Tag => JsonSerializer.Deserialize<List<TagJsonDTO>>(responseContentArray),
                        _ => null
                    };
                }

                if (data == null)
                {
                    throw new InvalidOperationException("Invalid return type");
                }

                var sorted = SortObjects(sortOrder, data);
                if (sorted == null)
                {
                    throw new Exception("Invalid object passed to SortObjects method.");
                }

                return JsonSerializer.Serialize(sorted);
            });
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

        public async Task<object> GetEventDataAsync(EventRequest request)
        {
            var response = await DirectRequestEvents(request);

            if (response is null)
            {
                throw new InvalidOperationException("Null response from movebank service");
            }

            var responseContentArray = await response.Content.ReadAsByteArrayAsync();

            using var memStream = new MemoryStream(responseContentArray);
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

            var data = LineStringFeatureCollection<LineStringPropertiesV1>.RecordToEventJsonDto(records, request.StudyId);

            if (data is null)
            {
                throw new Exception("Data was null");
            }
            if (request.GeometryType is null)
            {
                // Return unprocessed json data
                return data;
            }

            data.IndividualEvents.ForEach(l => l.Locations.Sort((x, y) => x.Timestamp.CompareTo(y.Timestamp)));

            object collection;
            switch (request.GeometryType.ToLower())
            {
                case "linestring":
                    var lineCollections = LineStringFeatureCollection<LineStringPropertiesV1>
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

            return collection;

            static PointProperties PropertyFunc(LocationJsonDTO location) => new()
            {
                Date = TimestampToDateTime(location.Timestamp),
                DateString = FormatTimestamp(location.Timestamp),
                Timestamp = location.Timestamp
            };
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

        public async Task<ApiTokenResultDTO?> GetApiToken()
        {
            SecretCacheItem? secretCache = _secretsCache.GetCachedSecret(_configuration["ConnectionStrings:AWSKeyVault2ARN"]);
            GetSecretValueResponse? secretValue = await secretCache.GetSecretValue(new CancellationToken());


            var secretObj = JsonSerializer.Deserialize<ApiTokenResultDTO>(secretValue.SecretString);
            DateTime? expirationDate = GetDateTime(secretObj?.ExpirationDate!);

            if (expirationDate != null && expirationDate > DateTime.Now)
            {
                return secretObj;
            }            

            var rotationRequest = new RotateSecretRequest()
            {
                SecretId = "MoveBankSecrets",
                RotateImmediately = true,                
            };

            await _amazonSecretsManager.RotateSecretAsync(rotationRequest);            

            secretCache = _secretsCache.GetCachedSecret(_configuration["ConnectionStrings:AWSKeyVault2ARN"]);
            secretValue = await secretCache.GetSecretValue(new CancellationToken());

            secretObj = JsonSerializer.Deserialize<ApiTokenResultDTO>(secretValue.SecretString)!;

            return secretObj;
        }
                
        // TODO: This method assumes the timezone is CET/CEST and will not work correctly for other timezones.
        // It needs to be updated to handle timezones dynamically.
        public DateTime? GetDateTime(string? dateString)
        {
            if (dateString is null)
            {
                return null;
            }
            // This method is still hardcoded.
            // The default timezone is CET.
            var tokens = dateString.Split(' ');
            var timeZone = tokens[4];
            var offset = "+1";
            if (timeZone == "CEST")
            {
                offset = "+2";
            }

            //var newDataString = dateString.Replace(timeZone, "+1");
            var newDateString = dateString.Replace(timeZone, offset);
            const string formatString = $"ddd MMM dd HH:mm:ss z yyyy";
            if (DateTime.TryParseExact(newDateString, formatString, null, DateTimeStyles.None, out var result))
            {
                return result;
            }
            else
            {
                return null;
            }
        }

        public async Task<HttpResponseMessage?> DirectRequestEvents(EventRequest request)
        {
            var parameters = new Dictionary<string, string?>();
            var eventOptions = request.Options;

            if (eventOptions.MaxEventsPerIndividual is not null)
            {
                parameters.Add("max_events_per_individual", eventOptions.MaxEventsPerIndividual.ToString());
            }

            const string additionalAttributes = "individual_local_identifier,tag_local_identifier,timestamp,location_long,location_lat,individual_taxon_canonical_name";
            parameters.Add("attributes", additionalAttributes);

            if (!string.IsNullOrEmpty(eventOptions.EventProfile))
            {
                parameters.Add("event_reduction_profile", eventOptions.EventProfile);
            }

            // These timestamp as given in Unix Epoch time
            if (eventOptions.TimestampStart >= eventOptions.TimestampEnd)
            {
                parameters.Add("timestamp_start", eventOptions.TimestampStart.ToString());
                parameters.Add("timestamp_end", eventOptions.TimestampEnd.ToString());
            }

            // If this request has no parameters then movebank will return all publiclly available event data.
            if (request.LocalIdentifiers is not null && request.LocalIdentifiers.Count > 0)
            {
                parameters.Add("individual_local_identifier", string.Join(",", request.LocalIdentifiers));
            }
            
            var response = await DirectRequest(
                entityType: "event",
                studyId: request.StudyId,
                parameters: parameters,
                headers: null,
                authorizedUser: false);

            return response;
        }


        // NOTE: This method is also used as a fallthrough for json request are empty
        public async Task<HttpResponseMessage?> DirectRequest(
            string entityType,
            long? studyId = null,
            Dictionary<string, string?>? parameters = null,
            (string, string)[]? headers = null,
            bool authorizedUser = false)
        {
            var secretObj = await GetApiToken();
            var uri = _httpClient.BaseAddress!.OriginalString + "direct-read";

            // Adding Parameters
            uri = QueryHelpers.AddQueryString(uri, "entity_type", entityType);
            if (studyId is long studyIdLong && (parameters is null || !parameters.ContainsKey("study_id")))
            {
                uri = QueryHelpers.AddQueryString(uri, "study_id", studyIdLong.ToString());
            }

            if (parameters is not null)
            {
                uri = QueryHelpers.AddQueryString(uri, parameters);
            }

            if (secretObj != null && !string.IsNullOrEmpty(secretObj.ApiToken))
            {
                uri = QueryHelpers.AddQueryString(uri, "api-token", secretObj.ApiToken);
            }

            using var request = new HttpRequestMessage()
            {
                RequestUri = new Uri(uri),
                Method = HttpMethod.Get,                
            };
            
            // Headers get set here
            if (headers is not null)
            {
                foreach (var header in headers)
                {
                    request.Headers.Add(header.Item1, header.Item2);
                }
            }

            // Timeout after 20 seconds.
            var cancellationToken = new CancellationTokenSource();
            cancellationToken.CancelAfter(1000 * 20);

            var response = await _httpClient.SendAsync(request, cancellationToken.Token);

            response.EnsureSuccessStatusCode();

            //var responseContentBytes = await response.Content.ReadAsByteArrayAsync();
            // The following method works by checking the headers of the response and thus avoids reading the stream unnecessarily.
            if (!HasLicenseTerms(response) || studyId is null)
            {
                Console.WriteLine("Returning the http response without sending another request asking for permissions.");
                return response;
            } 
            Console.WriteLine("Requesting permission for direct read response");

            // INFO: In this case, the another request is sent asking for permission and the study is stored in my database to credit at another time.                
            response = await GetPermissionForDirectRead(request, response);
            var study = await _studyRepository.GetStudyByIdAsync(studyId.Value);
            //if (await SaveStudy(study))
            //{
            //    Console.WriteLine("Successfully saved study to RequestPermission table");
            //}
            //else
            //{
            //    Console.WriteLine("Did not save study to database.");
            //}
                         
            return response;
        }

        public async Task<HttpResponseMessage> JsonRequest(
            long studyId,
            string entityType,
            Dictionary<string, string?>? parameters = null,
            (string, string)[]? headers = null,
            bool authorizedUser = false)
        {
            var secretObj = await GetApiToken();
            var uri = _httpClient.BaseAddress!.OriginalString;

            if (!authorizedUser)
            {
                uri += "public/json";
            }
            else
            {
                uri += "json-auth";
            }

            uri = QueryHelpers.AddQueryString(uri, "entity_type", entityType);
            uri = QueryHelpers.AddQueryString(uri, "study_id", studyId.ToString());
            if (parameters != null)
            {
                uri = QueryHelpers.AddQueryString(uri, parameters);
            }
            // Keep if this is enough to handle all requests
            if (secretObj != null && !string.IsNullOrEmpty(secretObj.ApiToken))
            {
                uri = QueryHelpers.AddQueryString(uri, "api-token", secretObj.ApiToken);
            }

            using var request = new HttpRequestMessage()
            {
                RequestUri = new Uri(uri),
                Method = HttpMethod.Get,
            };
            // Headers get set here
            if (headers is not null)
            {
                foreach (var header in headers)
                {
                    request.Headers.Add(header.Item1, header.Item2);
                }
            }
            // If permission is not granted then the content length is empty
            var response = await _httpClient.SendAsync(request);
            response.EnsureSuccessStatusCode();

            return response;
        }

        private static bool HasLicenseTerms(HttpResponseMessage? response)
        {
            if (response is null)
            {
                return false;
            }
            var headers = response.Headers;
            if ((headers.TryGetValues("accept-license", out var result) && result.FirstOrDefault() is "true")
                || (headers.TryGetValues("Accept-License", out var result2) && result2.FirstOrDefault() is "true"))
            {
                return true;
            }
            return false;
        }

        private async Task<HttpResponseMessage> GetPermissionForDirectRead(
            HttpRequestMessage oldRequest,
            HttpResponseMessage oldResponse)
        {
            var uri = oldRequest.RequestUri!.AbsoluteUri;
            var checkSum = MD5.HashData(await oldResponse.Content!.ReadAsByteArrayAsync());
            var md5_string = BitConverter.ToString(checkSum).Replace("-", string.Empty);

            uri = QueryHelpers.AddQueryString(uri, "license-md5", md5_string);

            var request = new HttpRequestMessage()
            {
                RequestUri = new Uri(uri),
                Method = HttpMethod.Get,
            };
            var response = await _httpClient.SendAsync(request);
            response.EnsureSuccessStatusCode();
            return response;
        }

    }
}
