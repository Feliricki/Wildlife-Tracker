using System.Text.Json.Serialization;

namespace PersonalSiteAPI.DTO.GeoJSON;

public class Feature<TProp, TGeometry>(TGeometry geometry, TProp properties)
{
    [JsonInclude]
    [JsonPropertyName(name: "type")] 
    public readonly string Type = "Feature";

    [JsonPropertyName(name: "geometry")]
    public TGeometry Geometry { get; set; } = geometry;

    [JsonPropertyName(name: "properties")]
    public TProp Properties { get; set; } = properties;
}