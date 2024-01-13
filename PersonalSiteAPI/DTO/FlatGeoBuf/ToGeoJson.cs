//using TopSuiteGeometries = NetTopologySuite.Geometries;
//using TopSuiteFeatures = NetTopologySuite.Features;
using PersonalSiteAPI.DTO.MoveBankAttributes.JsonDTOs;
using PersonalSiteAPI.DTO.GeoJSON;
//using FlatGeobuf.Index;

namespace PersonalSiteAPI.DTO.FlatGeoBuf
{
    //public static readonly KeyValuePair<string, object>

    public record LineStringPropertiesFlatGeoBuf
    {
        public required string Content { get; set; }
        public long SourceTimestamp { get; set; }
        public long DestinationTimestamp { get; set; }
    }
    //public static class ToGeoJson
    //{
    //    public static TopSuiteGeometries.LineString ToLineStringGeometry(
    //        LocationJsonDTO location,
    //        LocationJsonDTO nextLocation)
    //    {
    //        var factory = new TopSuiteGeometries.GeometryFactory();
    //        var coordinates = new[] {
    //            new TopSuiteGeometries.Coordinate(location.LocationLong, location.LocationLat),
    //            new TopSuiteGeometries.Coordinate(nextLocation.LocationLong, location.LocationLat)
    //        };

    //        var linestring = factory.CreateLineString(coordinates);
    //        return linestring;
    //    }

    //    public static TopSuiteGeometries.LineString ToLineStringGeometry(
    //        Tuple<float, float> location,
    //        Tuple<float, float> prevLocation)
    //    {   
    //        var factory = new TopSuiteGeometries.GeometryFactory();
    //        var coordinates = new[] {
    //            new TopSuiteGeometries.Coordinate(prevLocation.Item1, prevLocation.Item2),
    //            new TopSuiteGeometries.Coordinate(location.Item1, location.Item2)
    //        };

    //        return factory.CreateLineString(coordinates);
    //    }

    //    // NOTE: The geometry needs to be created before the feature.
    //    public static TopSuiteFeatures.Feature ToLineStringFeature(
    //        TopSuiteGeometries.Geometry geometry,
    //        params KeyValuePair<string, object>[] properties)
    //    {
    //        var feature = new TopSuiteFeatures.Feature
    //        {
    //            Geometry = geometry
    //        };

    //        TopSuiteFeatures.AttributesTable attributeTable = [];
    //        foreach (var property in properties)
    //        {
    //            attributeTable.Add(property.Key, property.Value);
    //        }
    //        feature.Attributes = attributeTable;

    //        return feature;
    //    }

    //    //public static TopSuiteFeatures.Feature ToLineStringFeature(
    //    //    TopSuiteGeometries.Geometry geometry, 
    //    //    params KeyValuePair<string, object>[] properties)
    //    //{
    //    //    var feature = new TopSuiteFeatures.Feature
    //    //    {
    //    //        Geometry = geometry
    //    //    };

    //    //    TopSuiteFeatures.AttributesTable attributeTable = [];
    //    //    foreach (var property in properties)
    //    //    {
    //    //        attributeTable.Add(property.Key, property.Value);
    //    //    }
    //    //    feature.Attributes = attributeTable;
    //    //    return feature;
    //    //}

    //    public static IEnumerable<TopSuiteFeatures.Feature> ToLineStringFeatureEnumerable(
    //        IndividualEventDTO events)
    //    {
    //        if (events.Locations.Count is 0 or 1)
    //        {
    //            yield break;
    //        }
    //        var i = 0;
    //        double runningDistanceKilometers = 0;
    //        foreach (var location in events.Locations)
    //        {
    //            if (i == events.Locations.Count - 1) yield break;

    //            var nextLocation = events.Locations[i + 1];
    //            double curDistanceKilometers = HelperFunctions.Haversine(location.LocationLong, location.LocationLat, nextLocation.LocationLong, nextLocation.LocationLat);
    //            runningDistanceKilometers += curDistanceKilometers;

    //            var properties = new LineStringPropertiesFlatGeoBuf
    //            {
    //                Content = HelperFunctions.CreateContentHelper(events.IndividualLocalIdentifier, location, nextLocation, curDistanceKilometers, runningDistanceKilometers),
    //                SourceTimestamp = location.Timestamp,
    //                DestinationTimestamp = nextLocation.Timestamp
    //            };

    //            var linestringGeometry = ToLineStringGeometry(location, nextLocation);
    //            var linestringFeature = ToLineStringFeature(linestringGeometry, GetProperties(properties));
                
    //            yield return linestringFeature;
    //        }
    //    }
        
    //    // NOTE: This method can only see public properties.
    //    public static KeyValuePair<string,object>[] GetProperties(object properties)
    //    {
    //        KeyValuePair<string, object>[] props =
    //            properties
    //            .GetType()
    //            .GetProperties()
    //            .Select(prop => KeyValuePair.Create(prop.Name, prop.GetValue(properties)!))
    //            .ToArray();

    //        return props;
    //    }

    //    public static IEnumerable<TopSuiteGeometries.LineString> ToLineStringEnumerable(
    //        IndividualEventDTO events)
    //    {
    //        if (events.Locations.Count is 0 or 1)
    //        {
    //            yield break;
    //        }

    //        var i = 0;
    //        double runningDistanceKilometers = 0;
    //        foreach (var location in events.Locations)
    //        {
    //            if (i == events.Locations.Count - 1) yield break;

    //            var nextLocation = events.Locations[i+1];
    //            double curDistanceKilometers = HelperFunctions.Haversine(location.LocationLong, location.LocationLat, nextLocation.LocationLong, nextLocation.LocationLat);
    //            runningDistanceKilometers += curDistanceKilometers;

    //            var properties = new LineStringPropertiesFlatGeoBuf
    //            {
    //                Content = HelperFunctions.CreateContentHelper(events.IndividualLocalIdentifier, location, nextLocation, curDistanceKilometers, runningDistanceKilometers),
    //                SourceTimestamp = location.Timestamp,
    //                DestinationTimestamp = nextLocation.Timestamp
    //            };

    //            var linestring = ToLineStringGeometry(location, nextLocation);

    //            yield return linestring;
    //        }
    //    }



    //    public static TopSuiteFeatures.FeatureCollection ToLineStringFeatureCollection(IndividualEventDTO events)
    //    {
    //        var factory = new TopSuiteGeometries.GeometryFactory();
    //        var lineStrings = ToLineStringEnumerable(events);
    //        var collection = factory.CreateGeometryCollection(lineStrings.ToArray());

    //        var featureCollection = new TopSuiteFeatures.FeatureCollection();

    //        return featureCollection;
    //    }

    //    //public static async Task<byte[]> SerializeIndividualEventsAsync(IndividualEventDTO events)
    //    //{
    //    //    var featureCollection = ToLineStringFeatureCollection(events);
    //    //    return await Geobuf.FeatureCollectionConversions.SerializeAsync(
    //    //        fc: featureCollection, 
    //    //        geometryType: FlatGeobuf.GeometryType.LineString, 
    //    //        dimensions: 2);
    //    //}

    //    //public static async Task<byte[][]> SerializeAllEventsAsync(EventJsonDTO allEvents)
    //    //{
    //    //    var tasks = allEvents.IndividualEvents.Select(async events => await SerializeIndividualEventsAsync(events));
    //    //    return await Task.WhenAll(tasks);
    //    //}
    //}
}
