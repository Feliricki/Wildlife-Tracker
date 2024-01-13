using PersonalSiteAPI.DTO.MoveBankAttributes.JsonDTOs;

namespace PersonalSiteAPI.DTO.GeoJSON;


public static class ColorGradientGenerator
{
    private const int MaxVal = 255;
    // INFO: This method generates an color in RGBA format
    // This function is meant to generate a color gradient 
    // It's designed to be used to for lineStrings rather than points.
    // Take the number of pairs multiplied by two to get the size.
    
    // TODO: The following refactors need to be finished.
    // 1) The maximum alpha value is actually 255.
    // 2) Two colors needs to be made for each line string feature.
    public static void ColorGradientForLineString(
        double totalDistance,
        List<Feature<LineStringPropertiesV1, LineStringGeometry>> features)
    {
        var rand = new Random();
        
        var startColor = GetRandomColor(rand);
        var endColor = GetRandomColor(rand);

        double runningDistance = 0;
        double prevDistance = 0;
        foreach (var feature in features)
        {
            var distance = feature.Properties.Distance;
            runningDistance += distance;

            var prevRatio = double.IsNaN(prevDistance / totalDistance) ? 0 : prevDistance;
            var ratio = runningDistance / totalDistance;

            prevDistance = runningDistance;
            var sourceRed = Lerp(startColor[0], endColor[0], prevRatio);
            var sourceGreen = Lerp(startColor[1], endColor[1], prevRatio);
            var sourceBlue = Lerp(startColor[2], endColor[2], prevRatio);

            var targetRed = Lerp(startColor[0], endColor[0], ratio);
            var targetGreen = Lerp(startColor[1], endColor[1], ratio);
            var targetBlue = Lerp(startColor[2], endColor[2], ratio);

            feature.Properties.FromColor = [sourceRed, sourceGreen, sourceBlue];
            feature.Properties.TargetColor = [targetRed, targetGreen, targetBlue];
        }
    }
    public static IEnumerable<Tuple<List<double>, List<double>>> ColorGradientIterable(double totalDistance, IndividualEventDTO individuals)
    {
        if (individuals.Locations.Count == 0)
        {
            yield break;
        }

        var rand = new Random();

        var startColor = GetRandomColor(rand);
        var endColor = GetRandomColor(rand);

        double runningDistance = 0;
        double prevDistance = 0;

        var prevLocation = individuals.Locations.First();
        foreach (var location in individuals.Locations)
        {            
            var distance = double.IsNaN(HelperFunctions.EuclideanDistance(prevLocation, location)) ? 0 : HelperFunctions.EuclideanDistance(prevLocation, location);
            runningDistance += distance;

            var prevRatio = double.IsNaN(prevDistance / totalDistance) ? 0 : prevDistance;
            var ratio = runningDistance / totalDistance;

            prevDistance = runningDistance;
            var sourceRed = Lerp(startColor[0], endColor[0], prevRatio);
            var sourceGreen = Lerp(startColor[1], endColor[1], prevRatio);
            var sourceBlue = Lerp(startColor[2], endColor[2], prevRatio);

            var targetRed = Lerp(startColor[0], endColor[0], ratio);
            var targetGreen = Lerp(startColor[1], endColor[1], ratio);
            var targetBlue = Lerp(startColor[2], endColor[2], ratio);

            var fromColor = new List<double> { sourceRed, sourceGreen, sourceBlue }; 
            var toColor = new List<double> { targetRed, targetGreen, targetBlue };

            yield return Tuple.Create(fromColor, toColor);
        }
    }
    
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
        // foreach (var distance in collection.Select(accessorFunction))
        foreach (var elem in collection)
        {
            var distance = accessorFunction(elem);
            runningDistance += distance;

            // var ratio = totalDistance / runningDistance;
            var ratio = runningDistance / totalDistance;
            
            var newRed = Lerp(startColor[0], endColor[0], ratio);
            var newGreen = Lerp(startColor[1], endColor[1], ratio);
            var newBlue = Lerp(startColor[2], endColor[2], ratio);

            colors.Add([newRed, newGreen, newBlue, 1]);
        }
        return colors;
    }

    // NOTE: Not to be used tentatively.
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
            
            colors.Add([newRed, newGreen, newBlue, 1]);
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
        colors.Add(MaxVal);
        return colors;
    }
}