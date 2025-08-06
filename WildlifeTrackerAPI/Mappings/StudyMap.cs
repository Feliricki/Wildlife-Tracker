using Microsoft.EntityFrameworkCore;
using WildlifeTrackerAPI.DTO.MoveBankAttributes;
using WildlifeTrackerAPI.Models;

namespace WildlifeTrackerAPI.Mappings
{
    public class StudyMapper
    {

        public StudyDTO EntityToDTO(Studies study)
        {
            var result = new StudyDTO()
            {
                Acknowledgements = study.Acknowledgements,
                Citation = study.Citation,
                GrantsUsed = study.GrantsUsed,
                Id = study.Id,
                LicenseType = study.LicenseType,
                MainLocationLat = FloatParser(study.MainLocationLat),
                MainLocationLon = FloatParser(study.MainLocationLon),
                Name = study.Name,
                NumberOfDeployments = study.NumberOfDeployments,
                NumberOfIndividuals = study.NumberOfIndividuals,
                NumberOfTags = study.NumberOfTags,
                StudyObjective = study.StudyObjective,
                TimestampFirstDeployedLocation = study.TimeStampFirstDeployedLocation,
                TimestampLastDeployedLocation = study.TimeStampLastDeployedLocation,
                NumberOfDeployedLocations = study.NumberOfDeployedLocations,
                TaxonIds = study.TaxonIds,
                SensorTypeIds = study.SensorTypeIds,
                ContactPersonName = study.ContactPersonName
            };

            return result;
        }

        public async Task<List<StudyDTO>> EntityListToDTOAsync(IQueryable<Studies> studyQuery)
        {
            var result = studyQuery.Select(study => new StudyDTO()
            {
                Acknowledgements = study.Acknowledgements,
                Citation = study.Citation,
                GrantsUsed = study.GrantsUsed,
                Id = study.Id,
                LicenseType = study.LicenseType,
                MainLocationLat = FloatParser(study.MainLocationLat),
                MainLocationLon = FloatParser(study.MainLocationLon),
                Name = study.Name,
                NumberOfDeployments = study.NumberOfDeployments,
                NumberOfIndividuals = study.NumberOfIndividuals,
                NumberOfTags = study.NumberOfTags,
                StudyObjective = study.StudyObjective,
                TimestampFirstDeployedLocation = study.TimeStampFirstDeployedLocation,
                TimestampLastDeployedLocation = study.TimeStampLastDeployedLocation,
                NumberOfDeployedLocations = study.NumberOfDeployedLocations,
                TaxonIds = study.TaxonIds,
                SensorTypeIds = study.SensorTypeIds,
                ContactPersonName = study.ContactPersonName
            });

            return await result.ToListAsync();
        }

        protected static float? FloatParser(string? num)
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
