using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace PersonalSiteAPI.Models
{
    // Creates a new index by name sorted in ascending order.
    //[Index(nameof(Name))]
    //[Index(nameof(LicenseType), nameof(IHaveDownloadAccess))]
    public class Studies
    {

        [JsonPropertyName("acknowledgements")]
        public string Acknowledgements { get; set; } = "";

        [JsonPropertyName("citation")]
        public string Citation { get; set; } = "";

        [JsonPropertyName("go_public_date")]
        public DateTime? GoPublicDate { get; set; } = null;
        
        [JsonPropertyName("grants_used")]
        public string GrantsUsed { get; set; } = "";
        [Required]                
        [JsonPropertyName("i_am_owner")]
        public bool IAmOwner { get; set; }
        [Required]
        [JsonPropertyName("id")]
        public long Id { get; set; }
        [Required]
        [JsonPropertyName("is_test")]                
        public bool IsTest { get; set; }
        
        [JsonPropertyName("license_terms")]
        public string LicenseTerms { get; set; } = "";
        [JsonPropertyName("license_type")]
        [MaxLength(10)]
        public string LicenseType { get; set; } = "";

        [JsonPropertyName("main_location_lat")]
        public string MainLocationLat { get; set; } = "";

        [JsonPropertyName("main_location_long")]
        public string MainLocationLon { get; set; } = "";
        [Required]
        [JsonPropertyName("name")]
        [MaxLength(200)]
        public string Name { get; set; } = "";

        [JsonPropertyName("number_of_deployments")]
        public int NumberOfDeployments { get; set; }
        
        [JsonPropertyName("number_of_individuals")]
        public int NumberOfIndividuals { get; set; }
        
        [JsonPropertyName("number_of_tags")]
        public int NumberOfTags { get; set; }
        
        [JsonPropertyName("principal_investigator_address")]
        public string PrincipalInvestigatorAddress { get; set; } = "";

        [JsonPropertyName("principal_investigator_email")]
        public string PrincipalInvestigatorEmail { get; set; } = "";

        [JsonPropertyName("principle_investigator_name")]
        public string PrincipalInvestigatorName { get; set; } = "";

        [JsonPropertyName("study_objective")]
        public string StudyObjective { get; set; } = "";

        [JsonPropertyName("study_type")]
        public string StudyType { get; set; } = "";
        [Required]
        [JsonPropertyName("suspend_license_terms")]                
        public bool SuspendLicenseTerms { get; set; }
        [Required]                
        [JsonPropertyName("i_can_see_data")]
        public bool ICanSeeData { get; set; }
        [Required]
        [JsonPropertyName("there_are_data_which_i_cannot_see")]                
        public bool ThereAreDataWhichICannotSee { get; set; }
        [Required]
        [JsonPropertyName("i_have_download_access")]                
        public bool IHaveDownloadAccess { get; set; }
        [Required]
        [JsonPropertyName("i_am_collaborator")]
        public bool IAmCollaborator { get; set; }
        
        [JsonPropertyName("study_permission")]
        public string StudyPermission { get; set; } = "";

        [JsonPropertyName("timestamp_first_deployed_location")]
        public DateTime? TimeStampFirstDeployedLocation { get; set; } = null;

        [JsonPropertyName("timestamp_last_deployed_location")]
        public DateTime? TimeStampLastDeployedLocation { get; set; } = null;

        [JsonPropertyName("number_of_deployed_locations")]
        public int NumberOfDeployedLocations { get; set; }
        
        [JsonPropertyName("taxon_ids")]
        public string TaxonIds { get; set; } = "";

        [JsonPropertyName("sensor_type_ids")]
        public string SensorTypeIds { get; set; } = "";

        [JsonPropertyName("contact_person_name")]
        public string ContactPersonName { get; set; } = "";
    }
}
