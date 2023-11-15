using CsvHelper.Configuration.Attributes;
using PersonalSiteAPI.DTO.MoveBankAttributes;
using System.ComponentModel.DataAnnotations;

namespace PersonalSiteAPI.DTO
{
    [Delimiter(",")]
    public class DeploymentRecord
    {
        [Optional]
        [Name("animal_life_stage")]
        public string? AnimalLifeStage { get; set; }

        [Optional]
        [Name("animal_mass")]
        public string? AnimalMass { get; set; }

        [Optional]
        [Name("animal_reproductive_condition")]
        public string? AnimalReproductiveCondition { get; set; }

        [Optional]
        [Name("attachment_body_part")]
        public string? AtttachmenBodyPart { get; set; }

        [Optional]
        [Name("attachment_comments")]
        public string? AttachmentComments { get; set; }

        [Optional]
        [Name("attachment_type")]
        public string? AtachmentType { get; set; }

        [Optional]
        [Name("capture_latitude")]
        public string? latitude { get; set; }

        [Optional]
        [Name("capture_longitude")]
        public string? longitude { get; set; }

        [Optional]
        [Name("capture_timestamp")]
        public string? CaptureTimestamp { get; set; }


        [Optional]
        [Name("comments")]
        public string? Comments { get; set; }

        [Optional]
        [Name("deploy_on_latitude")]
        public string? DeployOnLatitude { get; set; }

        [Optional]
        [Name("deploy_on_longitude")]
        public string? DeployOnLongitude { get; set; }

        [Optional]
        [TypeConverter(typeof(DateTimeConverter))]
        [Name("deploy_on_timestamp")]
        public DateTime? DeployOnTimestamp { get; set; }

        [Optional]
        [Name("duty_cycle")]
        public string? DutyCycle { get; set; }

        [Required]
        [Name("id")]
        public long Id { get; set; }

        [Optional]
        [Name("local_identifier")]
        public string? LocalIdentifier { get; set; }

        [Optional]
        [Name("location_accuracy_comments")]
        public string? LocationAccuraryComments { get; set; }

        [Optional]
        [Name("outlier_comments")]
        public string? OutlierComments { get; set; }

        [Required]
        [Name("study_site")]
        public string? StudySite { get; set; }

        [Required]
        [TypeConverter(typeof(DateTimeConverter))]
        [Name("timestamp_start")]
        public DateTime? TimestampStart { get; set; }

        [Required]
        [TypeConverter(typeof(DateTimeConverter))]
        [Name("timestamp_end")]
        public DateTime? TimestampEnd { get; set; }

        [Required]
        [Name("number_of_events")]
        public int? NumberOfEvents { get; set; } = 0;

        [Required]
        [Name("sensor_type_ids")]
        public string SensorTypeIds { get; set; } = string.Empty;
    }
}

