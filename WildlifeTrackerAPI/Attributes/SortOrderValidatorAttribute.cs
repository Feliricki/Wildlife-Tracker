using System.ComponentModel.DataAnnotations;

namespace WildlifeTrackerAPI.Attributes
{
    public class SortOrderValidatorAttribute: ValidationAttribute
    {
        private string[] AllowedValues { get; set; } = { "asc", "desc", string.Empty };

        public SortOrderValidatorAttribute() : base("Value must be one of the following: {0}.") { }

        protected override ValidationResult? IsValid(object? value, ValidationContext validationContext)
        {
            var strValue = value as string;
            Console.WriteLine(validationContext.ObjectType.ToString());
            if (!string.IsNullOrEmpty(strValue) && AllowedValues.Contains(strValue.ToLower()))
            {
                return ValidationResult.Success;
            }
            return new ValidationResult(FormatErrorMessage(string.Join(",", AllowedValues)));            
        }
    }
}
