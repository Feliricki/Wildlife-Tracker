using CsvHelper.Configuration.Attributes;
using System.ComponentModel.DataAnnotations;

namespace PersonalSiteAPI.DTO.MoveBankAttributes.DirectReadDTOs
{
    [Delimiter(",")]
    public class TagRecord
    {
        [Ignore]
        [Name("beacon_frequency")]
        public string? BeaconFrequency { get; set; }

        [Optional]
        [Name("comments")]
        public string? Comments { get; set; }


        [Required]
        [Name("id")]
        public long Id { get; set; }

        [Required]
        [Name("local_identifier")]
        public string LocalIdentifier { get; set; } = string.Empty;

        [Ignore]
        [Name("manufacturer_name")]
        public string? ManufacturerName { get; set; }

        [Optional]
        public string? Model { get; set; }

        [Ignore]
        [Name("processing_type")]
        public string? ProcessingType { get; set; }

        [Ignore]
        [Name("serial_no")]
        public string? SerialNo { get; set; }

        [Ignore]
        [Name("tag_failure_comments")]
        public string? TagFailureComments { get; set; }

        [Ignore]
        [Name("tag_production_date")]
        public string? TagProductionDate { get; set; }

        [Optional]
        [Name("weight")]
        public float? Weight { get; set; }

        [Optional]
        [TypeConverter(typeof(DateTimeConverter))]
        [Name("timestamp_start")]
        public DateTime? TimestampStart { get; set; }

        [Optional]
        [TypeConverter(typeof(DateTimeConverter))]
        [Name("timestamp_end")]
        public DateTime? TimestampEnd { get; set; }

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
