using CsvHelper.Configuration.Attributes;
using System.ComponentModel.DataAnnotations;

namespace PersonalSiteAPI.DTO.MoveBankAttributes
{
    [Delimiter(",")]
    public class StudiesRecord
    {
        [Optional]
        [Name("acknowledgements")]
        public string? Acknowledgements { get; set; }
        [Optional]
        [Name("citation")]
        public string? Citation { get; set; }
        [Optional]
        [TypeConverter(typeof(DateTimeConverter))]
        [Name("go_public_date")]
        public DateTime? GoPublicDate { get; set; }
        [Optional]
        [Name("grants_used")]
        public string? GrantsUsed { get; set; }
        [Required]
        [BooleanTrueValues("true")]
        [BooleanFalseValues("false")]
        [Name("i_am_owner")]
        public bool IAmOwner { get; set; } 
        [Required]
        [Name("id")]
        public long Id { get; set; }
        [Required]
        [Name("is_test")]
        [BooleanTrueValues("true")]
        [BooleanFalseValues("false")]
        public bool IsTest { get; set; }
        [Optional]
        [Name("license_terms")]
        public string? LicenseTerms { get; set; }
        [Optional]
        [Name("license_type")]
        public string? LicenseType { get; set; }
        [Optional]
        [Name("main_location_lat")]
        public string? MainLocationLat { get; set; }
        [Optional]
        [Name("main_location_long")]
        public string? MainLocationLon { get; set; }
        [Required]
        [Name("name")]
        public string? Name { get; set; }
        [Optional]
        [Name("number_of_deployments")]
        public int? NumberOfDeployments { get; set; }
        [Optional]
        [Name("number_of_individuals")]
        public int? NumberOfIndividuals { get; set; }
        [Optional]
        [Name("number_of_tags")]
        public int? NumberOfTags { get; set; }
        [Optional]
        [Name("principal_investigator_address")]
        public string? PrincipalInvestigatorAddress { get; set; }
        [Optional]
        [Name("principal_investigator_email")]
        public string? PrincipalInvestigatorEmail { get; set; }
        [Optional]
        [Name("principle_investigator_name")]
        public string? PrincipalInvestigatorName { get; set; }
        [Optional]
        [Name("study_objective")]
        public string? StudyObjective { get; set; }
        [Optional]
        [Name("study_type")]
        public string? StudyType { get; set; }
        [Required]
        [Name("suspend_license_terms")]
        [BooleanTrueValues("true")]
        [BooleanFalseValues("false")]
        public bool SuspendLicenseTerms { get; set; }
        [Required]
        [BooleanTrueValues("true")]
        [BooleanFalseValues("false")]
        [Name("i_can_see_data")]
        public bool ICanSeeData { get; set; }
        [Required]
        [Name("there_are_data_which_i_cannot_see")]
        [BooleanTrueValues("true")]
        [BooleanFalseValues("false")]
        public bool ThereAreDataWhichICannotSee { get; set; }
        [Required]
        [Name("i_have_download_access")]
        [BooleanTrueValues("true")]
        [BooleanFalseValues("false")]
        public bool IHaveDownloadAccess { get; set; }
        [Required]
        [Name("i_am_collaborator")]
        public bool IAmCollaborator { get; set; }
        [Optional]
        [Name("study_permission")]
        public string? StudyPermission { get; set; }
        [Optional]
        [TypeConverter(typeof(DateTimeConverter))]
        [Name("timestamp_first_deployed_location")]
        public DateTime? TimeStampFirstDeployedLocation { get; set; } = null;
        [Optional]
        [TypeConverter(typeof(DateTimeConverter))]
        [Name("timestamp_last_deployed_location")]
        public DateTime? TimeStampLastDeployedLocation { get; set; } = null;
        [Optional]
        [Name("number_of_deployed_locations")]
        public int? NumberOfDeployedLocations { get; set; }
        [Optional]
        [Name("taxon_ids")]
        public string? TaxonIds { get; set; }
        [Optional]
        [Name("sensor_type_ids")]
        public string? SensorTypeIds { get; set; }
        [Optional]
        [Name("contact_person_name")]
        public string? ContactPersonName { get; set; }
    }
}
