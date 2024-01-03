using System.Text.Json.Serialization;
using PersonalSiteAPI.DTO.MoveBankAttributes.JsonDTOs;
using PersonalSiteAPI.Constants;
using PersonalSiteAPI.DTO.MoveBankAttributes.DirectReadRecords;
using GRPC = PersonalSiteAPI.gRPC;

namespace PersonalSiteAPI.DTO.GeoJSON;

public record EventRecordGroup
{
    public string? IndividualLocalIdentifier { get; set; }

    public IEnumerable<EventRecord>? Records { get; set; }
}

public record MetadataRecord
{
    [JsonPropertyName(name: "count")]
    public int Count { get; set; }
    public List<int> BufferSizes { get; set; } = new();    
    public List<double> TotalDistanceTravelled { get; set; } = new();
    public int? Pairs { get; set; } // To be used for LineStrings
    
    // public List<string>? LocalIdentifiers  { get; set; }
    [JsonPropertyName(name: "localIdentifier")]
    public string? LocalIdentifier  { get; set; }
    
    [JsonPropertyName(name: "sensorUsed")]
    public HashSet<string>? SensorsUsed { get; set; }
    [JsonPropertyName(name: "taxon")]
    public HashSet<string>? Taxon { get; set; }
}

// MetaData for a lineStringFeatureCollection.
public record LineStringMetadata
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
    public MetadataRecord? Metadata { get; set; }

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

        Metadata = new MetadataRecord()
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
            Metadata = new MetadataRecord
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
            pointCollection.Metadata.Count += newCount;
            pointCollection.Metadata.BufferSizes.Add(newCount);
            pointCollection.Metadata.Taxon.Add(individuals.IndividualTaxonCanonicalName);
            
            if (TagTypes.SensorIdToName(individuals.SensorTypeId) is not null)
            {
                pointCollection.Metadata.SensorsUsed.Add(TagTypes.SensorIdToName(individuals.SensorTypeId)!);
            }
            
        }

        return pointCollection;
    }
}

public class LineStringFeatureCollection<TProp, TGeometry>
{
    [JsonPropertyName(name:"type")]
    public string Type { get; set; } = "FeatureCollection";

    [JsonPropertyName(name: "metadata")]
    public LineStringMetadata? Metadata { get; set; }

    [JsonPropertyName(name: "features")]
    public List<Feature<LineStringProperties, TGeometry>> Features { get; set; } = default!;
    
    [JsonPropertyName(name: "id")]
    public long? Id { get; set; }

    
    public static LineStringFeatureCollection<LineStringProperties, LineString> CreateCollection(IndividualEventDTO events)
    {
        var collection = new LineStringFeatureCollection<LineStringProperties, LineString>();
        var totalCount = events.Locations.Count;

        var totalDistance = events.Locations.Aggregate(Tuple.Create<double, LocationJsonDTO>
            (0, events.Locations[0]), (prev, location) =>
            {
                var distance = double.IsNaN(EuclideanDistance(prev.Item2, location)) ? 0 : EuclideanDistance(prev.Item2, location);
                return Tuple.Create(prev.Item1 + distance, location);
            }).Item1;

        collection.Metadata = CreateLineStringMetadataHelper(events, totalDistance);

        collection.Features = new List<Feature<LineStringProperties, LineString>>();
        double runningDistance = 0;
        double runningDistanceKilometers = 0;
        double initialTimestamp = events.Locations.First().Timestamp;
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

            var distanceKilometers = DistanceHelper.Haversine(location.LocationLong, location.LocationLat, nextLocation.LocationLong, nextLocation.LocationLat);
            var distanceDelta = EuclideanDistance(location, nextLocation);

            runningDistance += distanceDelta;
            runningDistanceKilometers += distanceKilometers;

            var timestampDelta = TimeDelta(nextLocation.Timestamp, location.Timestamp);

            var lineString = new Feature<LineStringProperties, LineString>(
                geometry: new LineString(new List<List<float>> { from, to }),
                properties: new LineStringProperties
                {
                    From = TimestampToDateTime(location.Timestamp),
                    To = TimestampToDateTime(nextLocation.Timestamp),
                    Content = CreateContentHelper(events.IndividualLocalIdentifier, location, nextLocation, distanceKilometers, runningDistanceKilometers, timestampDelta),
                    Distance = distanceDelta,
                    DistanceTravelled = runningDistance,
                    Timestamp = location.Timestamp,
                });

            collection.Features.Add(lineString);
            i++;
        }

        collection.Metadata.Count = collection.Features.Count;
        ColorGradientGenerator.ColorGradientForLineString(totalDistance: totalDistance, collection.Features);

        return collection;
    }

    public static GRPC.LineStringFeatureCollection CreategRPCCollection(IndividualEventDTO events)
    {
        var collection = new GRPC.LineStringFeatureCollection
        {
            Type = "FeatureCollection"
        };

        var totalCount = events.Locations.Count;

        var totalDistance = events.Locations.Aggregate(Tuple.Create<double, LocationJsonDTO>
            (0, events.Locations[0]), (prev, location) =>
            {
                var distance = double.IsNaN(EuclideanDistance(prev.Item2, location)) ? 0 : EuclideanDistance(prev.Item2, location);
                return Tuple.Create(prev.Item1 + distance, location);
            }).Item1;

        collection.Metadata = CreateLineStringMetadata(events, totalDistance, totalCount);        

        double runningDistance = 0;
        double runningDistanceKilometers = 0;
        double initialTimestamp = events.Locations.First().Timestamp;

        var i = 0;      
        var colorEnumerable = ColorGradientGenerator.ColorGradientIterable(totalDistance, events).GetEnumerator();                
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

            var distanceKilometers = DistanceHelper.Haversine(location.LocationLong, location.LocationLat, nextLocation.LocationLong, nextLocation.LocationLat);
            var distanceDelta = EuclideanDistance(location, nextLocation);

            runningDistance += distanceDelta;
            runningDistanceKilometers += distanceKilometers;

            var timestampDelta = TimeDelta(nextLocation.Timestamp, location.Timestamp);
          
            // NOTE: Setting values of for the positions, linestringfeatures, metadata and properties
            var fromPosition = new GRPC.Position();
            fromPosition.Position_.AddRange(from);

            var toPosition = new GRPC.Position();
            toPosition.Position_.AddRange(to);

            var lineStringFeature = new GRPC.LineStringGeometry
            {
                Type = "LineString"
            };
            lineStringFeature.Coordinates.AddRange(new[] { fromPosition, toPosition });

            var metadata = CreateLineStringMetadata(events, runningDistanceKilometers, totalCount);

            var properties = new GRPC.LineStringProperties
            {
                From = TimestampToDateTime(location.Timestamp).ToString(),
                To = TimestampToDateTime(nextLocation.Timestamp).ToString(),
                Content = CreateContentHelper(events.IndividualLocalIdentifier, location, nextLocation, distanceKilometers, runningDistanceKilometers, timestampDelta),
                Distance = distanceKilometers,
                DistanceTravelled = runningDistanceKilometers,
                Timestamp = location.Timestamp // Consider sending the timestamps instead of the date objects serialized to strings
            };

            if (colorEnumerable.MoveNext())
            {
                var (sourceColor, targetColor) = colorEnumerable.Current;
                properties.FromColor.AddRange(sourceColor);
                properties.ToColor.AddRange(targetColor);
            }

            var linestring = new GRPC.LineStringFeature
            {
                Type = "Feature",
                Properties = properties,
                Geometry = lineStringFeature
            };

            collection.Features.Add(linestring);

            i++;
        }

        return collection;
    }

    // TODO: The following called after preprocessing involving the sorting of LocationJsonDTOs by timestamp.
    // TODO: Consider a complete redesign involving the direct processing of event records.
    public static IEnumerable<GRPC.LineStringFeatureCollection> StreamLineStringFeatureCollection(EventJsonDTO allEvents)
    {
        foreach (var individualEvents in allEvents.IndividualEvents)
        {
            var collection = CreategRPCCollection(individualEvents);
            yield return collection;
        }
    }

    public static LineStringMetadata CreateLineStringMetadataHelper(IndividualEventDTO events, double distanceTravelled)
    {
        return new LineStringMetadata
        {
            LocalIdentifier = events.IndividualLocalIdentifier,
            SensorUsed = TagTypes.SensorIdToName(events.SensorTypeId) ?? "N/A",
            Taxa = events.IndividualTaxonCanonicalName,
            TotalDistanceTravelled = distanceTravelled,
        };
    } 

    public static GRPC.LineStringMetadata CreateLineStringMetadata(IndividualEventDTO events, double distanceTravelled, int count)
    {
        var metadata = new GRPC.LineStringMetadata
        {
            Count = count,
            LocalIdentifier = events.IndividualLocalIdentifier,
            SensorUsed = TagTypes.SensorIdToName(events.SensorTypeId) ?? "N/A",
            Taxa = events.IndividualTaxonCanonicalName,
            TotalDistanceTravelled = distanceTravelled
        };

        return metadata;
     }
         
    public static string CreateContentHelper(string localIdentifier, LocationJsonDTO curLocation, LocationJsonDTO nextLocation, double curDistance, double cumulativeDistance, TimeSpan timeDelta)
    {
        var content = $"<h5>Animal: {localIdentifier}</h5>"
                    + $"<h5>From:</h5>"
                    + $"<span>latitude: {curLocation.LocationLat}</span><br>"
                    + $"<span>longitude: {nextLocation.LocationLong}</span><br><br>"
                    + $"<h5>To:</h5>"
                    + $"<span>latitude: {nextLocation.LocationLat}</span><br>"
                    + $"<span>longitude: {nextLocation.LocationLong}</span><br><br>"
                    + $"<span>Distance This Event: {Math.Round(curDistance, 4)} kilometers.</span><br>"
                    + $"<span>Cumulative Distance: {Math.Round(cumulativeDistance, 4)} kilometers.</span><br><br>"
                    + $"<span>Start {FormatTimestamp(curLocation.Timestamp)}</span><br>"
                    + $"<span>End {FormatTimestamp(nextLocation.Timestamp)}</span><br><br>"
                    + $"<span>Speed: {Math.Round(cumulativeDistance / timeDelta.TotalHours, 4)} kilometers per hour</span><br>";
        return content;
    }

    public static IEnumerable<EventRecordGroup> GroupRecordsByIndividual(IEnumerable<EventRecord> records)
    {
        var eventDto = new EventJsonDTO();
        var groups = records.GroupBy(record => record.IndividualLocalIdentifier,
            (localIdentifier, groupedRecords) => new EventRecordGroup
            {
                IndividualLocalIdentifier = localIdentifier,
                Records = groupedRecords
            });
        return groups;
    }

    public static EventJsonDTO RecordToEventJsonDTO(IEnumerable<EventRecord> records, long studyId)
    {
        var eventDto = new EventJsonDTO();
        var groups = GroupRecordsByIndividual(records);

        foreach (var group in groups)
        {
            var events = ToIndividualJsonDTO(group, studyId);
            if (events is null)
            {
                continue;
            }
            eventDto.IndividualEvents.Add(events);
        }

        return eventDto;
    }

    public static IndividualEventDTO? ToIndividualJsonDTO(EventRecordGroup? recordGroup, long studyId)
    {
        var events = new IndividualEventDTO();        
        if (recordGroup?.Records is null || recordGroup.IndividualLocalIdentifier is null)
        {
            return null;
        }

        events.IndividualLocalIdentifier = recordGroup.IndividualLocalIdentifier;
        events.StudyId = studyId;

        foreach(var record in recordGroup.Records)
        {
            if (record.IndividualTaxonCanonicalName is not null && events.IndividualTaxonCanonicalName is null)
            {
                events.IndividualTaxonCanonicalName = record.IndividualTaxonCanonicalName;
            }       

            var unixTimestamp = new DateTimeOffset(record.Timestamp ?? DateTime.UtcNow).ToUnixTimeMilliseconds();
            float locationLat = record.LocationLat ?? 0;
            float locationLong = record.LocationLong ?? 0;

            var location = new LocationJsonDTO
            {
                LocationLat = locationLat,
                LocationLong = locationLong,
                Timestamp = unixTimestamp
            };
            events.Locations.Add(location);
        }
        return events;
    }

    // Combine a eventJsonDTO into a list of events.
    public static List<LineStringFeatureCollection<LineStringProperties, LineString>> CombineLineStringFeatures(EventJsonDTO events)
    {        
        return events.IndividualEvents.Select(CreateCollection).ToList();
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

    private static TimeSpan TimeDelta(long latest, long earliest)
    {
        var timestamp1 = DateTimeOffset.FromUnixTimeMilliseconds(earliest);
        var timestamp2 = DateTimeOffset.FromUnixTimeMilliseconds(latest);

        return timestamp2 - timestamp1;
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
