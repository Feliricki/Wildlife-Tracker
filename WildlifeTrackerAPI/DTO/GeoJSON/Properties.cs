using MessagePack;
using WildlifeTrackerAPI.DTO.MoveBankAttributes.JsonDTOs;
using System.Text.Json.Serialization;

namespace WildlifeTrackerAPI.DTO.GeoJSON;

public class LineStringPropertiesV1()
{
    [JsonPropertyName(name:"from")]
    public DateTime From { get; set; }
    
    [JsonPropertyName(name: "to")]
    public DateTime To { get; set; }

    [JsonPropertyName(name: "sourceColor")]
    public List<double> FromColor { get; set; } = [];
    
    [JsonPropertyName(name: "targetColor")]
    public List<double> TargetColor { get; set; } = [];
    
    // NOTE: The following properties are unused.
    [JsonPropertyName(name: "content")]
    public string Content { get; set; } = default!;

    [JsonPropertyName(name: "distance")]
    public double Distance { get; set; }

    [JsonPropertyName(name: "distanceTravelled")]
    public double DistanceTravelled { get; set; }

    [JsonPropertyName(name: "timestamp")]
    public long Timestamp { get; set; }
};

[MessagePackObject]
public class LineStringPropertiesV2()
{
    [Key(0)]
    [JsonPropertyName(name: "sourceTimestamp")]
    public long SourceTimestamp { get; set; }
    [Key(1)]
    [JsonPropertyName(name: "destinationTimestamp")]
    public long DestinationTimestamp { get; set; }
    [Key(2)]
    [JsonPropertyName(name: "content")]
    public string Content { get; set; } = default!;
    [Key(3)]
    [JsonPropertyName(name: "distanceKm")]
    public double DistanceKm { get; set; }
    [Key(4)]
    [JsonPropertyName(name: "distanceTravelledKm")]
    public double DistanceTravelledKm { get; set; }


    //public LineStringPropertiesV2(
    //    long _SourceTimestamp,
    //    long _DestinationTimestamp,
    //    string _Content,
    //    double _DistanceKm,
    //    double _DistanceTravelledKm)
    //{
    //    SourceTimestamp = _SourceTimestamp;
    //    DestinationTimestamp = _DestinationTimestamp;
    //    Content = _Content;
    //    DistanceKm = _DistanceKm;
    //    DistanceTravelledKm = _DistanceTravelledKm;
    //}
    public static LineStringPropertiesV2 Create(
        LocationJsonDTO prevLocation,
        LocationJsonDTO curLocation,
        string individualLocalIdentifier,
        double currentDistanceKilometers,
        double totalDistanceKilometers)
    {
        return new LineStringPropertiesV2()
        {
            SourceTimestamp = prevLocation.Timestamp,
            DestinationTimestamp = curLocation.Timestamp,
            Content = HelperFunctions.CreateContentHelper(
                localIdentifier: individualLocalIdentifier,
                curLocation: prevLocation,
                nextLocation: curLocation,
                curDistance: currentDistanceKilometers,
                cumulativeDistance: totalDistanceKilometers),
            DistanceKm = currentDistanceKilometers,
            DistanceTravelledKm = totalDistanceKilometers
        };
    }

}

public record PointProperties()
{
    [JsonPropertyName(name: "date")] public DateTime Date { get; set; }

    public string DateString { get; set; } = default!;
    
    [JsonPropertyName(name:"color")]
    public List<double>? Color { get; set; }

    [JsonPropertyName(name: "timestamp")]
    public long Timestamp { get; set; }
}

[MessagePackObject]
public class XClass
{
    //public int Num { get; set; }
}
