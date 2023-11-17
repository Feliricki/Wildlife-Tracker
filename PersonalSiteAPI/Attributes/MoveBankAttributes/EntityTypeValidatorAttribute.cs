using System.ComponentModel.DataAnnotations;

namespace PersonalSiteAPI.Attributes.MoveBankAttributes
{
    public class EntityTypeValidatorAttribute : ValidationAttribute
    {
        public string[] AllowedValues { get; set; } = new string[] { 
            "study","individual", "tag", string.Empty };

        public EntityTypeValidatorAttribute(): base("Invalid entity type.") { }

        protected override ValidationResult? IsValid(object? value, ValidationContext validationContext)
        {
            //var strValue = value as string;
            if (value is string strValue && !string.IsNullOrEmpty(strValue) && AllowedValues.Contains(strValue.ToLower()))
            {
                return ValidationResult.Success;
            }
            return new ValidationResult(ErrorMessage);
        }
    }
}
