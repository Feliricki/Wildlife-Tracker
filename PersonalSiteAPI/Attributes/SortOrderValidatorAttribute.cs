using System.ComponentModel.DataAnnotations;

namespace PersonalSiteAPI.Attributes
{
    public class SortOrderValidatorAttribute: ValidationAttribute
    {
        public string[] AllowedValues { get; set; } = new string[] { "asc", "desc", string.Empty };

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
