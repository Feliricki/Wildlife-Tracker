using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace WildlifeTrackerAPI.Models
{
    [Table("RequestPermission")]
    [Index(nameof(ContactPersonName))]
    public class RequestPermission
    {
        [Required]
        [Key]
        public long Id { get; set; }
        public string Acknowledgements { get; set; } = string.Empty;
        public string Citation { get; set; } = string.Empty;
        public string LicenseTerms { get; set; } = string.Empty;
        [MaxLength(10)]
        public string LicenseType { get; set; } = string.Empty;
        public string MainLocationLat { get; set; } = string.Empty;
        public string MainLocationLon { get; set; } = string.Empty;
        public string PrincipalInvestigatorAddress { get; set; } = string.Empty;
        public string PrincipalInvestigatorEmail { get; set; } = string.Empty;
        public string PrincipalInvestigatorName { get; set; } = string.Empty;
        public bool ThereAreDataWhichICannotSee { get; set; }
        [Required]
        public bool IHaveDownloadAccess { get; set; }
        [Required]
        public bool IAmCollaborator { get; set; }
        public string StudyPermission { get; set; } = string.Empty;
        [Required]
        public string ContactPersonName { get; set; } = string.Empty;
    }
}
