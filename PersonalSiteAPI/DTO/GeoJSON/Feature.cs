using System.Text.Json.Serialization;

namespace PersonalSiteAPI.DTO.GeoJSON;

public class Feature<TProp, TGeometry>
{
    [JsonInclude]
    [JsonPropertyName(name: "type")] 
    public readonly string Type = "Feature";

    [JsonPropertyName(name: "geometry")] 
    public TGeometry Geometry { get; set; } = default!;

    [JsonPropertyName(name: "properties")]
    public TProp? Properties { get; set; }

    public Feature(TGeometry geometry, TProp? properties)
    {
        Geometry = geometry;
        Properties = properties;
    } 
}