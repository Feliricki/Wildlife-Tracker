using System.Text.Json.Serialization;

namespace PersonalSiteAPI.DTO.GeoJSON;

public record LineStringProperties()
{
    [JsonPropertyName(name:"from")]
    public DateTime From { get; set; }
    
    [JsonPropertyName(name: "to")]
    public DateTime To { get; set; }
    
    [JsonPropertyName(name: "content")]
    public string Content { get; set; } = default!;
    
    [JsonPropertyName(name: "distance")]
    public double Distance { get; set; }
};
// var distance = Math.Sqrt(Math.Pow(to[0] - from[0], 2) + Math.Pow(to[1] - from[1], 2));
public record PointProperties()
{
    [JsonPropertyName(name: "date")] public DateTime Date { get; set; }

    public string DateString { get; set; } = default!;
}