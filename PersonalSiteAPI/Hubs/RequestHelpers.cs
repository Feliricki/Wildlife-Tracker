//using PersonalSiteAPI.DTO.MoveBankAttributes.DirectReadRecords;
using PersonalSiteAPI.DTO.MoveBankAttributes.JsonDTOs;
//using TopsSuiteGeometries = NetTopologySuite.Geometries;
using PersonalSiteAPI.DTO.FlatGeoBuf;
using PersonalSiteAPI.DTO.GeoJSON;
using System.ComponentModel.DataAnnotations;

namespace PersonalSiteAPI.Hubs
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

        // This method outputs an enumerable of linestring features that all share the same individual.
        //public static IEnumerable<TopSuiteFeatures.Feature> EventGroupToLineStringFeature(EventRecordGroup records)
        //{
        //    if (records.Records is null) yield break;

        //    var localIdentifier = records.IndividualLocalIdentifier;
        //    LocationJsonDTO? prevLocation = null;
        //    var enumerator = records.Records.GetEnumerator();
        //    var i = 0;

        //    double runningDistanceKilometers = 0;
        //    while (enumerator.MoveNext())
        //    {
        //        var record = enumerator.Current;
        //        // This checks for a valid record but should be unnecessary.
        //        if (record.LocationLat is null || record.LocationLong is null 
        //            || record.Timestamp is null || record.IndividualLocalIdentifier is null) throw new InvalidOperationException("Record had null fields");

        //        if (prevLocation is null)
        //        {
        //            prevLocation = ToLocationJson((DateTime)record.Timestamp, (float)record.LocationLat, (float)record.LocationLong);
        //            i++;
        //            continue;
        //        }
        //        var curLocation = ToLocationJson((DateTime)record.Timestamp, (float)record.LocationLat, (float)record.LocationLong);
        //        double curDistanceKilometers = HelperFunctions.Haversine(prevLocation.LocationLong, prevLocation.LocationLat, (float)record.LocationLong, (float)record.LocationLat);
        //        runningDistanceKilometers += curDistanceKilometers;
                
        //        var lineStringGeometry = ToGeoJson.ToLineStringGeometry(
        //            location: prevLocation,
        //            nextLocation: curLocation
        //            );

        //        var props = GetProperties(new FeatureProperties
        //        {
        //            Content = HelperFunctions.CreateContentHelper(localIdentifier!, prevLocation, curLocation, curDistanceKilometers, runningDistanceKilometers),
        //            SourceTimestamp = prevLocation.Timestamp,
        //            DestinationTimestamp = curLocation.Timestamp,
        //        });
                
        //        var lineStringFeature = ToGeoJson.ToLineStringFeature(lineStringGeometry, props);
        //        yield return lineStringFeature;
        //        i++;
        //    }
        //}
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
                properties
                .GetType()
                .GetProperties()
                .Select(prop => KeyValuePair.Create(prop.Name, prop.GetValue(properties)!))
                .ToArray();

            return props;
        }
    }
}
