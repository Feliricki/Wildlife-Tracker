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

// NOTE: This type requires pairs which necessitates duplicate points to form a path.
public class LineString : Geometry<List<float>>
{
    public LineString(List<List<float>> newPath) : base("LineString", newPath) {}
}

