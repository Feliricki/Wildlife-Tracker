namespace PersonalSiteAPI.DTO.GeoJSON;


public static class ColorGradientGenerator
{
    private const int MaxVal = 255;
    
    // INFO: This method generates an color in RGBA format
    // This function is meant to generate a color gradient 
    // It's designed to be used to for lineStrings rather than points.
    // Take the number of pairs multiplied by two to get the size.
    public static List<List<double>> GenerateColorsGradientByDistance<T>(
        double totalDistance, 
        IEnumerable<T> collection,
        Func<T, double> accessorFunction)
    {
        var rand = new Random();
        
        var colors = new List<List<double>>();
        var startColor = GetRandomColor(rand);
        var endColor = GetRandomColor(rand);

        double runningDistance = 0;
        foreach (var distance in collection.Select(accessorFunction))
        {
            runningDistance += distance;

            // var ratio = totalDistance / runningDistance;
            var ratio = runningDistance / totalDistance;
            
            var newRed = Lerp(startColor[0], endColor[0], ratio);
            var newGreen = Lerp(startColor[1], endColor[1], ratio);
            var newBlue = Lerp(startColor[2], endColor[2], ratio);
            colors.Add(new List<double> { newRed, newGreen, newBlue, 1 });
        }
        return colors;
    }
    // NOTE: Not to be used tentatively
    public static List<List<double>> GenerateColorGradientUniform(int totalIndices)
    {
        var rand = new Random();
        
        var colors = new List<List<double>>();
        var startColor = GetRandomColor(rand);
        var endColor = GetRandomColor(rand);

        for (var i = 0; i < totalIndices; i++)
        {
            var newRed = Lerp(startColor[0], endColor[0], (1 / (double)totalIndices) * i);
            var newGreen = Lerp(startColor[1], endColor[1], (1 / (double)totalIndices) * i);
            var newBlue = Lerp(startColor[2], endColor[2], (1 / (double)totalIndices) * i);
            
            colors.Add(new List<double> { newRed, newGreen, newBlue, 1 });
        }

        return colors;
    }
    
    private static double Lerp(double firstFloat, double secondFloat, double by)
    {
        return firstFloat * (1 - by) + secondFloat * by;
    }
    private static List<double> GetRandomColor(Random rand)
    {
        var colors = new List<double>();
        for (var i = 0; i < 3; i++)
        {
            colors.Add(rand.NextDouble() * MaxVal);
        }
        colors.Add(1);
        return colors;
    }
}