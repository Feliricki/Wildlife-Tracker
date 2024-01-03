using System.Text.Json.Serialization;

namespace PersonalSiteAPI.DTO.GeoJSON;

public abstract class Geometry<TCoord>
{
    [JsonPropertyName(name: "type")]
    public string Type { get; set; }

    [JsonPropertyName(name: "coordinates")]
    public List<TCoord> Coordinates { get; set; }

    protected Geometry(string curType, List<TCoord> newCoordinates)
    {
        Type = curType;
        Coordinates = newCoordinates;
    }
}

public class Point : Geometry<float>
{
    public Point(List<float> newCoordinate): base("Point", newCoordinate) {}
}
public class LineString : Geometry<List<float>>
{
    public LineString(List<List<float>> newPath) : base("LineString", newPath) {}
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
public record LineStringGeometry
{
    public string type { get; set; } = "LineString";
    public List<Position> coordinates { get; set; } = new();
}

