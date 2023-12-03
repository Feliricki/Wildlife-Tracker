using CsvHelper.Configuration.Attributes;
using System.ComponentModel.DataAnnotations;

namespace PersonalSiteAPI.DTO.MoveBankAttributes.DirectReadDTOs
{
    [Delimiter(",")]
    public class IndividualRecord
    {
        [Optional]
        [Name("birth_hatch_latitude")]
        public double? BirthHatchLat { get; set; }
        [Optional]
        [Name("birth_hatch_longitude")]
        public double? BirthHatchLon { get; set; }
        [Optional]
        [Name("comments")]
        public string? Comments { get; set; }
        [Optional]
        [Name("death_comments")]
        public string? DeathComments { get; set; }
        [Optional]
        [Name("earliest_date_born")]
        public string? EarliestDateBorn { get; set; }
        [Optional]
        [Name("exact_date_of_birth")]
        public string? ExactDateOfBirth { get; set; }
        [Optional]
        [Name("group_id")]
        public string? GroupId { get; set; }
        [Required]
        [Name("id")]
        public long Id { get; set; }
        [Optional]
        [Name("latest_date_born")]
        public string? LatestDateBorn { get; set; }
        [Required]
        [Name("local_identifier")]
        public string? LocalIdentifier { get; set; }
        [Optional]
        [Name("marker_id")]
        public long? MarkerId { get; set; }
        [Optional]
        [Name("mates")]
        public string? Mates { get; set; }
        [Optional]
        [Name("mortality_date")]
        public string? MortalityDate { get; set; }
        [Optional]
        [Name("mortality_latitude")]
        public double? MortalityLat { get; set; }
        [Optional]
        [Name("mortality_longitude")]
        public double? MortalityLon { get; set; }
        [Optional]
        [Name("mortality_type")]
        public string? MortalityType { get; set; }
        [Optional]
        [Name("nick_name")]
        public string? NickName { get; set; }
        [Optional]
        [Name("offspring")]
        public string? Offspring { get; set; }
        [Optional]
        [Name("parents")]
        public string? Parents { get; set; }
        [Optional]
        [Name("ring_id")]
        public string? RingId { get; set; }
        [Optional]
        [Name("sex")]
        public string? Sex { get; set; }
        [Optional]
        [Name("siblings")]
        public string? Siblings { get; set; }
        [Optional]
        [Name("taxon_canonical_name")]
        public string? TaxonCanonicalName { get; set; }
        [Optional]
        [TypeConverter(typeof(DateTimeConverter))]
        [Name("timestamp_start")]
        public DateTime? TimeStampStart { get; set; }
        [Optional]
        [TypeConverter(typeof(DateTimeConverter))]
        [Name("timestamp_end")]
        public DateTime? TimeStampEnd { get; set; }
        [Optional]
        [Name("number_of_events")]
        public int? NumberOfEvents { get; set; }
        [Optional]
        [Name("number_of_deployments")]
        public int? NumberOfDeployements { get; set; }
        [Optional]
        [Name("sensor_type_ids")]
        public string? SensorTypeIds { get; set; }
        [Optional]
        [Name("taxon_detail")]
        public string? TaxonDetail { get; set; }
    }
}
