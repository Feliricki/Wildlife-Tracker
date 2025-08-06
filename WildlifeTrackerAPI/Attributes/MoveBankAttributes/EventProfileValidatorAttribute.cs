using System.ComponentModel.DataAnnotations;

namespace WildlifeTrackerAPI.Attributes.MoveBankAttributes
{
    public class EventProfileValidatorAttribute : ValidationAttribute
    {
        public string[] AllowedValues { get; set; } = ["EURING_01" , "EURING_02", "EURING_03", "EURING_04"];

        public EventProfileValidatorAttribute(): base("Every value must be one of the following: {0}.") { }

        protected override ValidationResult? IsValid(object? value, ValidationContext validationContext)
        {
            if (value is List<string> strList && strList.All(strElem => AllowedValues.Contains(strElem))){
                return ValidationResult.Success;
            }
            else {
                return new ValidationResult(ErrorMessage);
            }
        }
    }
}
