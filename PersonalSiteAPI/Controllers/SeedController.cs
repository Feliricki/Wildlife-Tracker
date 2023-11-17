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
using System.Security.Cryptography;
using System.Linq.Expressions;
using System.Linq.Dynamic.Core;
using System.Linq;

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
        //[Authorize(Roles = $"{RoleNames.Administrator}, {RoleNames.Moderator}")]
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

            if (await _userManager.FindByNameAsync(_configuration["DefaultUser:Username"]!) == null)
            {
                var adminUser = new ApplicationUser()
                {
                    SecurityStamp = Guid.NewGuid().ToString(),
                    UserName = _configuration["DefaultUser:Username"],
                    Email = _configuration["DefaultUser:Email"],
                };
                await _userManager.CreateAsync(adminUser, _configuration["DefaultUser:Password"]!);
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
        [HttpGet(Name="LongestName")]
        public async Task<IActionResult> LongestName()
        {
            try
            {
                using var response = await _moveBankService.DirectRequest(entityType: "study", parameters: null, headers: null, authorizedUser: true);
                if (response == null)
                {
                    throw new Exception("Response error");
                }
                using var stream = new StreamReader(await response.Content.ReadAsStreamAsync(), Encoding.UTF8);
                using var csvReader = new CsvReader(stream, CultureInfo.InvariantCulture);
                // TODO: Change this method to save the CSV locally in Models/Data
                // Then begin seeding the database
                var records = csvReader.GetRecords<StudiesRecord>();
                if (records is null)
                {
                    throw new Exception("error on parse");
                }

                var longestName = records
                    .Aggregate(Tuple.Create(0, ""), (acc, study) =>
                    {
                        if (study.Name?.Length > acc.Item1)
                        {
                            return Tuple.Create(study.Name.Length, study.Name);
                        }
                        else
                        {
                            return acc;
                        }
                    });

                return new JsonResult(new
                {
                    LongestNameCount = longestName.Item1,
                    LongestName = longestName.Item2
                });
            }
            catch (Exception err)
            {
                var exceptionDetails = new ProblemDetails
                {
                    Detail = err.Message,
                    Status = StatusCodes.Status500InternalServerError,
                    Type = "https://tools.ietf.org/html/rfc7231#section-6.6.1"
                };
                return StatusCode(StatusCodes.Status500InternalServerError, exceptionDetails);
            }
        }

        private readonly Expression<Func<Studies, bool>> ValidLicenseExp = study => study.LicenseType == "CC_0" || study.LicenseType == "CC_BY" || study.LicenseType == "CC_BY_NC";
        // Make sure this method requires proper authorization.
        [HttpPost(Name = "UpdateStudies")]
        public async Task<IActionResult> UpdateStudies()
        {
            try
            {
                using var response = await _moveBankService.DirectRequest(entityType: "study", parameters: null, headers: null, authorizedUser: true);
                if (response == null)
                {
                    throw new Exception("Response error");
                }
                using var stream = new StreamReader(await response.Content.ReadAsStreamAsync(), Encoding.UTF8);
                using var csvReader = new CsvReader(stream, CultureInfo.InvariantCulture);
                // TODO: Change this method to save the CSV locally in Models/Data
                // Then begin seeding the database
                var records = csvReader.GetRecordsAsync<StudiesRecord>();
                var existingStudies = _context.Studies.ToDictionary(o => o.Id);
                Console.WriteLine($"There are {await _context.Studies.CountAsync()} studies in the database");
                int rowsAdded = 0;
                int rowsSkipped = 0;
                int rowsFiltered = 0;
                var tagType = new TagTypes();
                await foreach (var record in records)
                {
                    // Filter invalid rows
                    if (record == null ||
                        existingStudies.ContainsKey(record.Id) ||
                        string.IsNullOrEmpty(record.Name))
                    {
                        rowsSkipped++;
                        continue;
                    }
                    // Filter rows that can't be displayed or downloaded
                    if (string.IsNullOrEmpty(record.SensorTypeIds) ||
                        !tagType.IsLocationSensor(record.SensorTypeIds) ||
                        !record.IHaveDownloadAccess ||
                        !record.ICanSeeData
                        )
                    {
                        rowsSkipped++;
                        rowsFiltered++;
                        continue;
                    }
                    var study = new Studies()
                    {
                        Acknowledgements = record.Acknowledgements ?? "",
                        Citation = record.Citation ?? "",
                        GoPublicDate = record.GoPublicDate ?? null,
                        GrantsUsed = record.GrantsUsed ?? "",
                        IAmOwner = record.IAmOwner,
                        Id = record.Id,
                        IsTest = record.IsTest,
                        LicenseTerms = record.LicenseTerms ?? "",
                        LicenseType = record.LicenseType ?? "",
                        MainLocationLat = record.MainLocationLat ?? "",
                        MainLocationLon = record.MainLocationLon ?? "",
                        Name = record.Name ?? "",
                        NumberOfDeployments = record.NumberOfDeployments ?? 0,
                        NumberOfIndividuals = record.NumberOfIndividuals ?? 0,
                        NumberOfTags = record.NumberOfTags ?? 0,
                        PrincipalInvestigatorAddress = record.PrincipalInvestigatorAddress ?? "",
                        PrincipalInvestigatorEmail = record.PrincipalInvestigatorEmail ?? "",
                        PrincipalInvestigatorName = record.PrincipalInvestigatorName ?? "",
                        StudyObjective = record.StudyObjective ?? "",
                        StudyType = record.StudyType ?? "",
                        SuspendLicenseTerms = record.SuspendLicenseTerms,
                        ICanSeeData = record.ICanSeeData,
                        ThereAreDataWhichICannotSee = record.ThereAreDataWhichICannotSee,
                        IHaveDownloadAccess = record.IHaveDownloadAccess,
                        IAmCollaborator = record.IAmCollaborator,
                        StudyPermission = record.StudyPermission ?? "",
                        TimeStampFirstDeployedLocation = record.TimeStampFirstDeployedLocation,
                        TimeStampLastDeployedLocation = record.TimeStampLastDeployedLocation,
                        NumberOfDeployedLocations = record.NumberOfDeployedLocations ?? 0,
                        TaxonIds = record.TaxonIds ?? "",
                        SensorTypeIds = record.SensorTypeIds ?? "",
                        ContactPersonName = record.ContactPersonName ?? "",
                    };
                    _context.Studies.Add(study);
                    rowsAdded++;
                }
                //_context.Database.SetCommandTimeout(60);
                using var transaction = _context.Database.BeginTransaction();
                _context.Database.ExecuteSqlRaw("SET IDENTITY_INSERT Studies ON");
                var dbChanges = await _context.SaveChangesAsync();
                Console.WriteLine($"{dbChanges} total database changes");
                _context.Database.ExecuteSqlRaw("SET IDENTITY_INSERT Studies OFF");
                transaction.Commit();

                return new JsonResult(new
                {
                    RowsAdded = rowsAdded,
                    RowsSkipped = rowsSkipped,
                    RowsFiltered = rowsFiltered,
                    CurrentStudiesCount = _context.Studies.Count()
                });
            }
            catch (Exception err)
            {
                var exceptionDetails = new ProblemDetails
                {
                    Detail = err.Message,
                    Status = StatusCodes.Status500InternalServerError,
                    Type = "https://tools.ietf.org/html/rfc7231#section-6.6.1"
                };
                return StatusCode(StatusCodes.Status500InternalServerError, exceptionDetails);
            }
        }
        // Not necessary
        [HttpPost(Name="GetPermissions")]
        [Authorize(Roles = $"{RoleNames.Administrator}, {RoleNames.Moderator}")]
        public async Task<IActionResult> GetPermissions()
        {

            int licenseTermsAccepted = 0;
            foreach (var study in _context.Studies)
            {
                try
                {
                    var study_param = new Dictionary<string, string?>() { { "study_id", study.Id.ToString() } };
                    using var response = await _moveBankService.DirectRequest(entityType: "individual", parameters: study_param, headers: null, authorizedUser: true);
                    if (response == null)
                    {
                        Console.WriteLine("Server response was null");
                        continue;
                    }
                    string response_content = await response.Content.ReadAsStringAsync();
                    if (response.StatusCode == System.Net.HttpStatusCode.OK && response_content.Contains("License Terms: "))
                    {
                        // Previous solution below. 
                        //var checkSum = md5.ComputeHash(await response.Content.ReadAsByteArrayAsync());
                        byte[] checkSum = await MD5.HashDataAsync(await response.Content.ReadAsStreamAsync(), new CancellationToken());
                        var md5_string = BitConverter.ToString(checkSum).Replace("-", String.Empty);

                        var licenseParam = new Dictionary<string, string?>() { { "study_id", study.Id.ToString() }, { "license-md5", md5_string } };
                        //(string, string)[] licenseHeaders = { ("Cookie", cookie.FirstOrDefault() ?? "") };

                        await _moveBankService.DirectRequest(entityType: "individual", parameters: licenseParam, headers: null, authorizedUser: true);
                        licenseTermsAccepted++;
                    }
                    response.Dispose();
                }
                catch
                {
                    Console.WriteLine("Encountered error");
                    continue;
                }

            }
            return new JsonResult(new
            {
                LicenseTermsAccepeted = licenseTermsAccepted,
            });
        }
    }
}
