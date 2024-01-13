using PersonalSiteAPI.DTO.MoveBankAttributes.JsonDTOs;
using System.Text.Json.Serialization;

namespace PersonalSiteAPI.DTO.GeoJSON;

public class LineStringPropertiesV1()
{
    [JsonPropertyName(name:"from")]
    public DateTime From { get; set; }
    
    [JsonPropertyName(name: "to")]
    public DateTime To { get; set; }

    [JsonPropertyName(name: "sourceColor")]
    public List<double> FromColor { get; set; } = new();
    
    [JsonPropertyName(name: "targetColor")]
    public List<double> TargetColor { get; set; } = new();
    
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

public class LineStringPropertiesV2()
{
    [JsonPropertyName(name: "sourceTimestamp")]
    public long SourceTimestamp { get; set; }
    [JsonPropertyName(name: "destinationTimestamp")]
    public long DestinationTimestamp { get; set; }
    [JsonPropertyName(name: "content")]
    public string Content { get; set; } = default!;
    [JsonPropertyName(name: "distanceKm")]
    public double DistanceKm { get; set; }
    [JsonPropertyName(name: "distanceTravelledKm")]
    public double DistanceTravelledKm { get; set; }


    public static LineStringPropertiesV2 Create(
        LocationJsonDTO prevLocation, 
        LocationJsonDTO curLocation,
        string individualLocalIdentifier,
        double currentDistanceKilometers,
        double totalDistanceKilometers)
    {
        return new LineStringPropertiesV2
        {
            SourceTimestamp = prevLocation.Timestamp,
            DestinationTimestamp = curLocation.Timestamp,
            Content = HelperFunctions.CreateContentHelper(
                localIdentifier: individualLocalIdentifier, 
                curLocation: prevLocation, 
                nextLocation: curLocation, 
                curDistance: currentDistanceKilometers,
                cumulativeDistance: totalDistanceKilometers),
            //Content = HelperFunctions.CreateContentHelper(individualLocalIdentifier, prevLocation, curLocation, currentDistanceKilometers, totalDistanceKilometers),
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