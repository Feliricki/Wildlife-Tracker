using WildlifeTrackerAPI.DTO.MoveBankAttributes.JsonDTOs;
using System.ComponentModel.DataAnnotations;

namespace WildlifeTrackerAPI.Hubs
{
    public static class RequestHelpers
    {
        public record FeatureProperties
        {
            [Required]
            public string Content { get; set; } = default!;
            [Required]
            public float SourceTimestamp { get; set; }
            [Required]
            public float DestinationTimestamp { get; set; }
        }

        public static LocationJsonDTO ToLocationJson(DateTime timestamp, float locationLat, float locationLong)
        {
            return new LocationJsonDTO
            {
                LocationLat = locationLat,
                LocationLong = locationLong,
                Timestamp = new DateTimeOffset(timestamp).ToUnixTimeMilliseconds(),
            };
        }

        public static KeyValuePair<string, object>[] GetProperties(object properties)
        {
            KeyValuePair<string, object>[] props =
                [.. properties
                .GetType()
                .GetProperties()
                .Select(prop => KeyValuePair.Create(prop.Name, prop.GetValue(properties)!))];

            return props;
        }
    }
}
