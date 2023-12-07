using System.Reflection;
using Mapster;
using PersonalSiteAPI.DTO.MoveBankAttributes;
using PersonalSiteAPI.Models;

namespace PersonalSiteAPI.Mappings
{
    public static class MapsterConfig
    {
        public static void RegisterMapsterConfiguration(this IServiceCollection services)
        {
            // TSource = Studies 
            //TDestination = StudyDTO
            TypeAdapterConfig<Studies, StudyDTO>
                .NewConfig()
                .Map(studyDto => studyDto.MainLocationLat, source => FloatParser(source.MainLocationLat))
                .Map(studyDto => studyDto.MainLocationLon, source => FloatParser(source.MainLocationLon))
                .Map(studyDto => studyDto.TimestampFirstDeployedLocation, source => source.TimeStampFirstDeployedLocation)
                .Map(studyDto => studyDto.TimestampLastDeployedLocation, source => source.TimeStampLastDeployedLocation);

            TypeAdapterConfig.GlobalSettings.Scan(Assembly.GetExecutingAssembly());

        }

        private static float? FloatParser(string? num)
        {
            if (num == null)
            {
                return null;
            }
            if (float.TryParse(num, out var floatNum))
            {
                return floatNum;
            }
            else
            {
                return null;
            }
        }

    }
}
