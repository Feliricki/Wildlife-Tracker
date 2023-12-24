using System.Net;
using System.Text.Json.Serialization;
using PersonalSiteAPI.DTO.MoveBankAttributes.JsonDTOs;
using PersonalSiteAPI.Constants;

namespace PersonalSiteAPI.DTO.GeoJSON;

public record MetaDataRecord
{
    public int Count { get; set; }

    public List<int> BufferSizes { get; set; } = new();

    public List<double> TotalDistanceTravelled { get; set; } = new();
    public int? Pairs { get; set; } // To be used for LineStrings
    
    public List<string>? LocalIdentifiers  { get; set; }
    public HashSet<string>? SensorsUsed { get; set; }
    public HashSet<string>? Taxon { get; set; }
}

// MetaData for a lineStringFeatureCollection.
public record LineStringMetaData
{
    public int Count { get; set; }

    public double TotalDistanceTravelled { get; set; }

    public string LocalIdentifier { get; set; } = default!;

    public string SensorUsed { get; set; } = default!;

    public string Taxa { get; set; } = default!;

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

    private PointFeatureCollection(IndividualEventDTO? events, Func<LocationJsonDTO, TProp> propertyFunc)
    {
        if (events is null)
        {
            Features = new List<Feature<TProp, Point>>();
            return;
        }
        foreach (var location in events.Locations)
        {
            var point = new Point(new List<float> { location.LocationLong, location.LocationLat });
            var feature = new Feature<TProp, Point>(point, propertyFunc(location));
            Features.Add(feature);
        }

        MetaData = new MetaDataRecord()
        {
            Count = events.Locations.Count,
        };
    }

    public static PointFeatureCollection<TProp> Create(IndividualEventDTO events, Func<LocationJsonDTO, TProp> propertyFunc)
    {
        return new PointFeatureCollection<TProp>(events, propertyFunc);
    }

    public static PointFeatureCollection<TProp> CombinePointFeatures(EventJsonDTO events, Func<LocationJsonDTO, TProp> propertyFunc)
    {
        var pointCollection = new PointFeatureCollection<TProp>(null, propertyFunc)
        {
            MetaData = new MetaDataRecord()
            {
                Count = 0,
                BufferSizes = new List<int>(),
                SensorsUsed = new HashSet<string>(),
                Taxon = new HashSet<string>(),
            }
        };

        foreach (var individuals in events.IndividualEvents)
        {
            var collection = new PointFeatureCollection<TProp>(individuals, propertyFunc);
            var newCount = collection.Features.Count;
            
            pointCollection.Features.AddRange(collection.Features);
            pointCollection.MetaData.Count += newCount;
            pointCollection.MetaData.BufferSizes.Add(newCount);
            pointCollection.MetaData.Taxon.Add(individuals.IndividualTaxonCanonicalName);
            
            if (TagTypes.SensorIdToName(individuals.SensorTypeId) is not null)
            {
                pointCollection.MetaData.SensorsUsed.Add(TagTypes.SensorIdToName(individuals.SensorTypeId)!);
            }
            
        }

        return pointCollection;
    }
}

public class LineStringFeatureCollection<TProp>
{
    [JsonPropertyName(name:"type")]
    public string Type { get; set; } = "FeatureCollection";

    [JsonPropertyName(name: "metadata")]
    public LineStringMetaData? MetaData { get; set; }

    [JsonPropertyName(name: "features")] 
    public List<Feature<LineStringProperties, LineString>> Features { get; set; }
    
    [JsonPropertyName(name: "id")]
    public long? Id { get; set; }

    
    private LineStringFeatureCollection(IndividualEventDTO events)
    {
        var totalCount = events.Locations.Count;
        
        var totalDistance = events.Locations.Aggregate(Tuple.Create<double, LocationJsonDTO>
            (0, events.Locations[0]), (prev, location) =>
        {
            var distance = EuclideanDistance(prev.Item2, location);
            return Tuple.Create(prev.Item1 + distance, location);
        }).Item1;

        MetaData = new LineStringMetaData
        {
            LocalIdentifier = events.IndividualLocalIdentifier,
            SensorUsed = TagTypes.SensorIdToName(events.SensorTypeId) ?? "N/A",
            Taxa = events.IndividualTaxonCanonicalName,
            TotalDistanceTravelled = totalDistance,
        };
        
        Features = new List<Feature<LineStringProperties, LineString>>();
        double runningDistance = 0;
        var i = 0;
        foreach (var location in events.Locations.TakeWhile(location => i < totalCount - 1))
        {
            if (i == totalCount - 1)
            {
                i++;
                continue;
            }

            var nextLocation = events.Locations[i + 1];
            // Format: [Longitude, Latitude, Altitude]
            var from = new List<float> { location.LocationLong, location.LocationLat, 10 };
            var to = new List<float> { nextLocation.LocationLong, nextLocation.LocationLat, 10 };

            var distanceDelta = EuclideanDistance(location, nextLocation);
            runningDistance += distanceDelta;

            var lineString = new Feature<LineStringProperties, LineString>(
                geometry: new LineString(new List<List<float>> { from, to }),
                properties: new LineStringProperties
                {
                    From = TimestampToDateTime(location.Timestamp),
                    To = TimestampToDateTime(nextLocation.Timestamp),
                    Content = $"From: {FormatTimestamp(location.Timestamp)} - To: {FormatTimestamp(nextLocation.Timestamp)}",
                    Distance = distanceDelta,
                    DistanceTravelled = runningDistance,
                    Timestamp = location.Timestamp,
                });
                
            Features.Add(lineString);
            i++;
        }
        
        MetaData.Count = Features.Count;

        var colors = ColorGradientGenerator.GenerateColorsGradientByDistance(
            totalDistance: totalDistance,
            collection: Features,
            accessorFunction: feature => feature.Properties.DistanceTravelled);

        for (i = 0; i < Features.Count; i++)
        {
            Features[i].Properties.Color = colors[i];
        }
    }
    
    // Combine a eventJsonDTO into a list of events.
    public static List<LineStringFeatureCollection<TProp>> CombineLineStringFeatures(EventJsonDTO events)
    {
        return events.IndividualEvents.Select(individual => new LineStringFeatureCollection<TProp>(individual)).ToList();
    }

    private static Tuple<List<double>, double> GetDistancesHelper(IndividualEventDTO events)
    {
        // Returns a list of distances and the total distance travelled.
        if (events.Locations.Count is 0 or 1)
        {
            return Tuple.Create(new List<double>(), (double)0);
        }

        var currentDistances = new List<double>();
        double totalDistance = 0;

        for (var i = 0; i < events.Locations.Count; i++)
        {
            if (i == 0)
            {
                continue;
            }

            var point1 = new List<double> { events.Locations[i].LocationLong, events.Locations[i].LocationLat };
            var point2 = new List<double> { events.Locations[i-1].LocationLong, events.Locations[i-1].LocationLat };

            var distance = EuclideanDistance(point1, point2);
            currentDistances.Add(distance);
            totalDistance += distance;
        }
        return Tuple.Create(currentDistances, totalDistance);
    }

    private static double EuclideanDistance(IReadOnlyList<double> point1, IReadOnlyList<double> point2)
    {
        return Math.Sqrt(Math.Pow(point1[0] - point2[0], 2) + Math.Pow(point1[1] - point2[1], 2));
    }
    private static double EuclideanDistance(LocationJsonDTO point1, LocationJsonDTO point2)
    {
        var list1 = new List<double> { point1.LocationLong, point1.LocationLat };
        var list2 = new List<double> { point2.LocationLong, point2.LocationLat };
        return EuclideanDistance(list1, list2);
    }
    
    private static DateTime TimestampToDateTime(long timestamp)
    {
        return DateTimeOffset.FromUnixTimeMilliseconds(timestamp).LocalDateTime;
    }
    private static string FormatTimestamp(long timestamp)
    {
        var date = DateTimeOffset.FromUnixTimeMilliseconds(timestamp).LocalDateTime;
        return "Date: " + date.ToLongDateString() + " Time: " + date.ToLongTimeString();
    }

}
