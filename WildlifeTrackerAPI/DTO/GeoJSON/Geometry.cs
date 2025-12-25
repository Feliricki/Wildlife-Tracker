using MessagePack;
using System.Text.Json.Serialization;

namespace WildlifeTrackerAPI.DTO.GeoJSON;

[Union(0, typeof(LineStringGeometry))]
[Union(1, typeof(Point))]
public abstract partial class Geometry<TCoord>
{
    [Key(0)]
    [JsonPropertyName(name: "type")]
    public string Type { get; set; } = default!;
    [Key(1)]
    [JsonPropertyName(name: "coordinates")]
    public List<TCoord> Coordinates { get; set; } = default!;
}

// TODO: This class may be a messagePack attribute.
[MessagePackObject]
public class LineStringGeometry : Geometry<List<float>>
{
    public LineStringGeometry() { }
    public LineStringGeometry(
        string type,
        List<List<float>> path)
    {
        Type = type;
        Coordinates = path;
    }
}


[MessagePackObject]
public class Point : Geometry<float>
{
    public Point() { }
    public Point(
        List<float> newCoordinate) 
    {
        Type = "Point";
        Coordinates = newCoordinate;
    }
}


// NOTE: The following collections are to be used in protobuf messages and services.
public record Position
{
    List<float> position { get; set; } = new();
    public Position(List<float> coordinates)
    {
        position = coordinates;
    }
}

