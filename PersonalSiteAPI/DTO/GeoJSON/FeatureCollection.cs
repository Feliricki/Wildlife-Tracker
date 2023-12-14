using System.Text.Json.Serialization;
using Newtonsoft.Json;
using PersonalSiteAPI.DTO.MoveBankAttributes.JsonDTOs;
using Azure.Core.GeoJson;
using PersonalSiteAPI.Constants;

namespace PersonalSiteAPI.DTO.GeoJSON;

public record MetaDataRecord
{
    public int Count { get; set; }
    public int? Pairs { get; set; } // To be used for LineStrings
    public string? SensorsUsed { get; set; }
    public string? LocalIdentifier { get; set; }
    public string? Taxa { get; set; }
}

// TProp is likely to be an anonymous object holding data such as DateTime objects. 
public class PointFeatureCollection<TProp> 
    where TProp : class
{
    [JsonInclude]
    [JsonPropertyName(name:"type")]
    public readonly string Type = "FeatureCollection";
    
    [JsonPropertyName(name: "metadata")]
    public MetaDataRecord? MetaData { get; set; }

    [JsonPropertyName(name: "features")]
    public List<Feature<TProp, Point>> Features { get; set; } = new();
    
    [JsonPropertyName(name: "id")]
    public long? Id { get; set; }

    private PointFeatureCollection(IndividualEventDTO events, Func<LocationJsonDTO, TProp> propertyFunc)
    {
        
        foreach (var location in events.Locations)
        {
            var point = new Point(new List<float> { location.LocationLong, location.LocationLat });
            var feature = new Feature<TProp, Point>(point, propertyFunc(location));
            Features.Add(feature);
        }

        MetaData = new MetaDataRecord()
        {
            Count = events.Locations.Count,
            Taxa = events.IndividualTaxonCanonicalName,
            LocalIdentifier = events.IndividualLocalIdentifier,
        };
    }

    public static PointFeatureCollection<TProp> Create(IndividualEventDTO events, Func<LocationJsonDTO, TProp> propertyFunc)
    {
        return new PointFeatureCollection<TProp>(events, propertyFunc);
    }

    public static List<PointFeatureCollection<TProp>> CreateManyPointCollections(EventJsonDTO events, Func<LocationJsonDTO, TProp> propertyFunc)
    {
        var pointCollection = new List<PointFeatureCollection<TProp>>();
        foreach (var individuals in events.IndividualEvents)
        {
            pointCollection.Add(new PointFeatureCollection<TProp>(individuals, propertyFunc));
        }

        return pointCollection;
    }
}

public class LineStringFeatureCollection<TProp>
    where TProp : notnull
{
    [JsonPropertyName(name:"type")]
    public string Type { get; set; } = "FeatureCollection";

    [JsonPropertyName(name: "metadata")]
    public MetaDataRecord? MetaData { get; set; }

    [JsonPropertyName(name: "features")] 
    public List<Feature<TProp, LineString>> Features { get; set; }
    
    [JsonPropertyName(name: "id")]
    public long? Id { get; set; }

    private LineStringFeatureCollection(IndividualEventDTO events, Func<LocationJsonDTO, LocationJsonDTO, TProp> propertyFunc)
    {
        var totalCount = events.Locations.Count;

        Features = new List<Feature<TProp, LineString>>();
        var i = 0;
        foreach (var location in events.Locations)
        {
            if (i >= totalCount - 1 && totalCount % 2 == 1)
            {
                break;
            }

            if (i == totalCount - 1)
            {
                i++;
                continue;
            }
                
            // Format: [Longitude, Latitude, Altitude]
            var from = new List<float> { location.LocationLong, location.LocationLat, 10 };
            var nextLocation = events.Locations[i + 1];
            var to = new List<float> { nextLocation.LocationLong, nextLocation.LocationLat, 10 };

            var lineString = new Feature<TProp, LineString>(
                geometry: new LineString(new List<List<float>> { from, to }),
                properties: propertyFunc(location, nextLocation));
                
            Features.Add(lineString);
            i++;
        }

        MetaData = new MetaDataRecord()
        {
            Count = totalCount,
            Pairs = Features.Count,
            SensorsUsed = TagTypes.SensorIdToName(events.SensorId),
            Taxa = events.IndividualTaxonCanonicalName,
            LocalIdentifier = events.IndividualLocalIdentifier,
        };
    }

    public static LineStringFeatureCollection<TProp> Create(IndividualEventDTO events,
        Func<LocationJsonDTO, LocationJsonDTO, TProp> propertyFunc)
    {
        return new LineStringFeatureCollection<TProp>(events, propertyFunc);
    }

    public static List<LineStringFeatureCollection<TProp>> CreateManyLineStringsCollections(EventJsonDTO events,
        Func<LocationJsonDTO, LocationJsonDTO, TProp> propertyFunc)
    {
        var lineStringCollection = new List<LineStringFeatureCollection<TProp>>();
        foreach (var individual in events.IndividualEvents)
        {
            lineStringCollection.Add(new LineStringFeatureCollection<TProp>(individual, propertyFunc));
        }

        return lineStringCollection;
    }
}
