using MessagePack;
using System.Text.Json.Serialization;

namespace PersonalSiteAPI.DTO.GeoJSON;


//[MessagePackObject(keyAsPropertyName: true)]
[MessagePackObject]
public class Feature<TProp, TGeometry>()
{
    [Key(0)]
    [JsonPropertyName(name: "type")]
    public string Type { get; set; } =  "Feature";
    [Key(1)]
    [JsonPropertyName(name: "geometry")]
    public TGeometry Geometry { get; set; }
    [Key(2)]
    [JsonPropertyName(name: "properties")]
    public TProp Properties { get; set; }
}