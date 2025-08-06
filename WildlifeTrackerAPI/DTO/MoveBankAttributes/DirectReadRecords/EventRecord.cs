using CsvHelper.Configuration.Attributes;
using WildlifeTrackerAPI.DTO.GeoJSON;
using System.ComponentModel.DataAnnotations;


// NOTE: This is the record returned by a direct request for event data. 
namespace WildlifeTrackerAPI.DTO.MoveBankAttributes.DirectReadRecords
{
    public class EventRecord
    {
        [Optional]
        [TypeConverter(typeof(DateTimeConverter))]
        [Name("timestamp")]
        public DateTime? Timestamp { get; set; }

        [Optional]
        [Name("location_lat")]
        public float? LocationLat { get; set; }

        [Optional]
        [Name("location_long")]
        public float? LocationLong { get; set; }

        [Optional]
        [Name("individual_id")]
        public long? IndividualId { get; set; }

        [Optional]
        [Name("tag_id")]
        public long? TagId { get; set; }

        // The following are additional attributes.        
        [Optional]
        [Name("individual_local_identifier")]
        public string? IndividualLocalIdentifier { get; set; } = null;

        [Optional]
        [Name("tag_local_identifier")]
        public string? TagLocalIdentifier { get ; set; } = null;

        [Optional]
        [Name("individual_taxon_canonical_name")]
        public string? IndividualTaxonCanonicalName { get; set; } = null;
    }
}
