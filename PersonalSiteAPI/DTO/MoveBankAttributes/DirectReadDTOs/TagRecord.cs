using CsvHelper.Configuration.Attributes;
using System.ComponentModel.DataAnnotations;

namespace PersonalSiteAPI.DTO.MoveBankAttributes.DirectReadDTOs
{
    [Delimiter(",")]
    public class TagRecord
    {
        //[Required]
        //[]
        //[Optional]
        //[Name("name")]
        //public string? Name { get; set; }

        [Required]
        [Name("id")]
        public int Id { get; set; }

        [Required]
        [Name("local_identifier")]
        public string LocalIdentifier { get; set; } = string.Empty;

        [Optional]
        [Name("weight")]
        public float Weight { get; set; }

        [Optional]
        [TypeConverter(typeof(DateTimeConverter))]
        [Name("timestamp_start")]
        public string? TimestampStart { get; set; }

        [Optional]
        [TypeConverter(typeof(DateTimeConverter))]
        [Name("timestamp_end")]
        public string? TimestampEnd { get; set; }

        [Optional]
        [Name("number_of_events")]
        public int NumberOfEvents { get; set; } = 0;

        [Optional]
        [Name("number_of_deployments")]
        public int NumberOfDeployments { get; set; } = 0;

        [Optional]
        [Name("sensor_type_ids")]
        public string SensorTypeIds { get; set; } = string.Empty;        
    }
}
