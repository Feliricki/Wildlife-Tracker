using WildlifeTrackerAPI.Constants;
using WildlifeTrackerAPI.DTO.MoveBankAttributes;
using System.ComponentModel.DataAnnotations;

namespace WildlifeTrackerAPI.Attributes
{
    public class EventRequestValidatorAttribute: ValidationAttribute
    {
        public string[] GeometryTypes = ["linestring", "point"];
        private readonly int maxIndividuals = 100;
        public EventRequestValidatorAttribute()
            : base("Event Request is invalid")
        {
        }

        protected override ValidationResult? IsValid(object? value, ValidationContext validationContext)
        {
            // TODO: This validation object is unfinished and untested.
            if (value is EventRequest request)
            {
                //Console.WriteLine(JsonCon);

                if (request.LocalIdentifiers is null || request.LocalIdentifiers.Count == 0)
                {
                    return new ValidationResult("No individual local identifier requested.");
                }

                if (request.GeometryType is not null && GeometryTypes.Contains(request.GeometryType.ToLower()))
                {
                    return new ValidationResult("Invalid geometry type. Must be linestring or point.");
                }

                if (request.SensorType is not null && !TagTypes.IsLocationSensor(request.SensorType))
                {
                    return new ValidationResult("Invalid sensor.");
                }

                if (request.Options is null || request.Options.EventProfile is null)
                {
                    //return ValidationResult.Success;
                    return new ValidationResult("Event profile must be provided.");
                }

                // TODO: Filter values that contains no filters of any kind. 

                if (request.Options.MaxEventsPerIndividual is not null && request.Options.MaxEventsPerIndividual < 0 || request.Options.MaxEventsPerIndividual > maxIndividuals)
                {
                    return new ValidationResult("Invalid number of individuals");
                }

                if (request.Options.TimestampStart is not null && request.Options.TimestampEnd is not null && request.Options.TimestampEnd < request.Options.TimestampStart)
                {
                    return new ValidationResult("Invalid timestamp");
                }

                return ValidationResult.Success;
            }

            return new ValidationResult("Invalid object.");
        }
    }
}
