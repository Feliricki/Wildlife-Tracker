using System.ComponentModel.DataAnnotations;

namespace PersonalSiteAPI.Attributes.MoveBankAttributes
{
    public class EntityTypeValidatorAttribute : ValidationAttribute
    {
        public string[] AllowedValues { get; set; } = new string[] { 
            "study", "STUDY", "INDIVIDUAL", "TAG" ,"individual", "tag", string.Empty };

        public EntityTypeValidatorAttribute(): base("Value must be one of the following: {0}.") { }

        protected override ValidationResult? IsValid(object? value, ValidationContext validationContext)
        {
            var strValue = value as string;
            if (!string.IsNullOrEmpty(strValue) && AllowedValues.Contains(strValue))
            {
                return ValidationResult.Success;
            }
            return new ValidationResult(FormatErrorMessage(string.Join(",", AllowedValues)));
        }
    }
}
