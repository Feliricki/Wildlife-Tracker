namespace PersonalSiteAPI.DTO.GeoJSON;

public class DistanceHelper
{
    private const double RadiusKilometers = 6371;


    // public static double Haversine(double lat1, double lat2, double lon1, double lon2)
    // {
    //     const double r = 6378100; // meters
    //         
    //     var sdlat = Math.Sin((lat2 - lat1) / 2);
    //     var sdlon = Math.Sin((lon2 - lon1) / 2);
    //     var q = sdlat * sdlat + Math.Cos(lat1) * Math.Cos(lat2) * sdlon * sdlon;
    //     var d = 2 * r * Math.Asin(Math.Sqrt(q));
    //
    //     return d;
    // }
    // public static double Haversine(float lat1, float lat2, float lon1, float lon2)
    // {
    //     // const double r = 6378100; // meters
    //         
    //     var sdlat = Math.Sin((lat2 - lat1) / 2);
    //     var sdlon = Math.Sin((lon2 - lon1) / 2);
    //     var q = sdlat * sdlat + Math.Cos(lat1) * Math.Cos(lat2) * sdlon * sdlon;
    //     var d = 2 * RadiusKilometers * Math.Asin(Math.Sqrt(q));
    //
    //     return d;
    // }
    
    public static double Haversine(
        double lon1,
        double lat1,
        double lon2,
        double lat2)
    {
        double dlon = Radians(lon2 - lon1);
        double dlat = Radians(lat2 - lat1);

        double a = (Math.Sin(dlat / 2) * Math.Sin(dlat / 2)) + Math.Cos(Radians(lat1)) * Math.Cos(Radians(lat2)) * (Math.Sin(dlon / 2) * Math.Sin(dlon / 2));
        double angle = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
        return angle * RadiusKilometers;
    }
    
    public static double Radians(double x)
    {
        return x * Math.PI / 180;
    }
    // inputs: { LocationLong, LocationLat } 
    // public static double CoordinatesToKilometers(List<double> from, List<double> to)
    // {
    //     // var part1 = 2 * RadiusKilometers * Math.Asin
    //     var inner1 = Math.Pow(Math.Sin((to[1] - from[1]) / 2), 2);
    //     var inner2 = Math.Cos(from[1]) * Math.Cos(to[1]) * Math.Pow(Math.Sin((to[0] - from[0]) / 2), 2);
    //     return 2 * RadiusKilometers ;
    // }

    // public static double Haversine(double rad)
    // {
    //     return (1 - Math.Cos(rad)) / 2;
    // }
}