using PersonalSiteAPI.DTO.MoveBankAttributes.JsonDTOs;

namespace PersonalSiteAPI.DTO.GeoJSON;

public static class HelperFunctions
{
    private const double RadiusKilometers = 6371;
    public static double GetTotalDistanceHelper(IndividualEventDTO events)
    {
        return events.Locations.Aggregate(Tuple.Create<double, LocationJsonDTO>
            (0, events.Locations[0]), (prev, location) =>
            {
                var distance = double.IsNaN(EuclideanDistance(prev.Item2, location)) ? 0 : EuclideanDistance(prev.Item2, location);
                return Tuple.Create(prev.Item1 + distance, location);
            }).Item1;
    }


    public static string CreateContentHelper(
        string localIdentifier, 
        LocationJsonDTO curLocation, 
        LocationJsonDTO nextLocation, 
        double curDistance, 
        double cumulativeDistance)
    {
        var timeDelta = TimeDelta(curLocation.Timestamp, nextLocation.Timestamp);        

        var content = $"<h5>Animal: {localIdentifier}</h5>"
                    + $"<h5>From:</h5>"
                    + $"<span>latitude: {curLocation.LocationLat}</span><br>"
                    + $"<span>longitude: {nextLocation.LocationLong}</span><br><br>"
                    + $"<h5>To:</h5>"
                    + $"<span>latitude: {nextLocation.LocationLat}</span><br>"
                    + $"<span>longitude: {nextLocation.LocationLong}</span><br><br>"
                    + $"<span>Distance This Event: {Math.Round(curDistance, 4)} kilometers.</span><br>"
                    + $"<span>Cumulative Distance: {Math.Round(cumulativeDistance, 4)} kilometers.</span><br><br>"                    
                    + $"<span>Start {FormatTimestamp(curLocation.Timestamp)}</span><br>"
                    + $"<span>End {FormatTimestamp(nextLocation.Timestamp)}</span><br><br>"
                    + $"<span>Time Elapsed: {TimeSpanFormatter(timeDelta)}</span><br><br>"
                    + $"<span>Speed: {Math.Round(curDistance / timeDelta.TotalHours, 4)} kilometers per hour</span><br>";
        return content;
    }    

    public static string TimeSpanFormatter(TimeSpan timeSpan)
    {
        List<string> ret = [];
        if (timeSpan.Days > 0) ret.Add($"{timeSpan.Days} days");
        if (timeSpan.Hours > 0) ret.Add($"{timeSpan.Hours} hours");
        if (timeSpan.Minutes > 0) ret.Add($"{timeSpan.Minutes} minutes");
        if (timeSpan.Seconds > 0) ret.Add($"{timeSpan.Seconds} seconds");
        return string.Join(" ", ret);
    }

    // These methods potentially return a NaN value.
    public static double EuclideanDistance(LocationJsonDTO point1, LocationJsonDTO point2)
    {
        var list1 = new List<double> { point1.LocationLong, point1.LocationLat };
        var list2 = new List<double> { point2.LocationLong, point2.LocationLat };
        return EuclideanDistance(list1, list2);
    }
    public static double EuclideanDistance(IReadOnlyList<double> point1, IReadOnlyList<double> point2)
    {
        return Math.Sqrt(Math.Pow(point1[0] - point2[0], 2) + Math.Pow(point1[1] - point2[1], 2));
    }

    public static TimeSpan TimeDelta(long currentTime, long nextTime)
    {
        var currentDate = DateTimeOffset.FromUnixTimeMilliseconds(currentTime);
        var nextDate = DateTimeOffset.FromUnixTimeMilliseconds(nextTime);

        return nextDate - currentDate;
    }

    public static DateTime TimestampToDateTime(long timestamp)
    {
        return DateTimeOffset.FromUnixTimeMilliseconds(timestamp).LocalDateTime;
    }
    public static string FormatTimestamp(long timestamp)
    {
        var date = DateTimeOffset.FromUnixTimeMilliseconds(timestamp).LocalDateTime;
        return "Date: " + date.ToLongDateString() + " Time: " + date.ToLongTimeString();
    }

    // This method calculates the distance between two given coordinates in WGS 84.
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
}