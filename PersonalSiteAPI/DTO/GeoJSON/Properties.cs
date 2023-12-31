using System.Text.Json.Serialization;

namespace PersonalSiteAPI.DTO.GeoJSON;

public record LineStringProperties()
{
    [JsonPropertyName(name:"from")]
    public DateTime From { get; set; }
    
    [JsonPropertyName(name: "to")]
    public DateTime To { get; set; }
    [JsonPropertyName(name: "color")] public List<double> Color { get; set; } = new();

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
public record PointProperties()
{
    [JsonPropertyName(name: "date")] public DateTime Date { get; set; }

    public string DateString { get; set; } = default!;
    
    [JsonPropertyName(name:"color")]
    public List<double>? Color { get; set; }

    [JsonPropertyName(name: "timestamp")]
    public long Timestamp { get; set; }
}