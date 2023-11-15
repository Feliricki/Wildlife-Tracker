using CsvHelper.Configuration.Attributes;
using System.ComponentModel.DataAnnotations;
using System.Globalization;

namespace PersonalSiteAPI.DTO.MoveBankAttributes
{
    [Delimiter(",")]
    public class SensorTypeRecord
    {
        [Name("description")]
        [Optional]
        public string? Description { get; set; }
        [Required]
        [Name("external_id")]
        public string? ExternalId { get; set; }
        [Required]
        [Name("id")]
        public long? Id { get; set; }
        [Required]
        [Name("is_location_sensor")]
        [BooleanTrueValues("true")]
        [BooleanFalseValues("false")]
        public bool? IsLocationSensor { get; set; }
        [Required]
        [Name("name")]
        public string? Name { get; set; }
    }

    
}
