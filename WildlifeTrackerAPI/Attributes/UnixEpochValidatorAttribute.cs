using System.ComponentModel.DataAnnotations;

namespace WildlifeTrackerAPI.Attributes
{
    public class UnixEpochValidatorAttribute : ValidationAttribute
    {
        public UnixEpochValidatorAttribute() : base("Value is invalid.") { }

        protected override ValidationResult? IsValid(object? value, ValidationContext validationContext)
        {
            if (value is long longValue)
            {
                return ValidationResult.Success;
            }
            else
            {
                return new ValidationResult(ErrorMessage);
            }
        }
    }
}
