using System.ComponentModel.DataAnnotations;

namespace WildlifeTrackerAPI.DTO.MoveBankAttributes
{
    public class StudyDTO
    {
        public string? Acknowledgements { get; set; } = string.Empty;
        public string? Citation { get; set; } = string.Empty;
        public string? GrantsUsed { get; set; } = string.Empty;
        [Required]
        public long Id { get; set; }
        public string? LicenseType { get; set; } = string.Empty;
        public float? MainLocationLat { get; set; } = null;
        public float? MainLocationLon { get; set; } = null;
        [Required]
        public string Name { get; set; } = string.Empty;
        public int NumberOfDeployments { get; set; } = 0;
        public int NumberOfIndividuals { get; set; } = 0;
        public int NumberOfTags { get; set; } = 0;
        public string? StudyObjective { get; set; } = string.Empty;
        // DateTimes get serialized to ISO8601 formatted string
        public DateTime? TimestampFirstDeployedLocation { get; set; } = null;
        public DateTime? TimestampLastDeployedLocation { get; set; } = null;
        public int NumberOfDeployedLocations { get; set; } = 0;
        public string TaxonIds { get; set; } = string.Empty;
        public string SensorTypeIds { get; set; } = string.Empty;
        public string? ContactPersonName { get; set; } = string.Empty;
    }
}
