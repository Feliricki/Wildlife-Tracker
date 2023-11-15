using CsvHelper.Configuration.Attributes;
using System.ComponentModel.DataAnnotations;

namespace PersonalSiteAPI.DTO.MoveBankAttributes.DirectReadDTOs
{
    [Delimiter(",")]
    public class TagRecord
    {
        //[Required]
        //[]
        [Optional]
        [Name("name")]
        public string? Name { get; set; }

        [Required]
        [Name("id")]
        public int Id { get; set; }

        [Optional]
        [Name("timestamp_start")]
        public string? TimestampStart { get; set; }
        [Optional]
        [Name("timestamp_end")]
        public string? TimestampEnd { get; set; }

        [Optional]
        [Name("number_of_events")]
        public string? NumberOfEvents { get; set; }

        [Optional]
        [Name("number_of_deployments")]
        public string? NumberOfDeployments { get; set; }

        [Optional]
        [Name("sensor_type_ids")]
        public string? SensorTypeIds { get; set; }
    }
}
