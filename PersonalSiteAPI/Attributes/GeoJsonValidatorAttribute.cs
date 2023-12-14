using System.ComponentModel.DataAnnotations;

namespace PersonalSiteAPI.Attributes;

public class GeoJsonValidatorAttribute : ValidationAttribute
{
    private readonly string[] _allowedValues = { "point", "linestring" };
    
    public GeoJsonValidatorAttribute() : base("Value must be one of the following types: {0}") {}

    protected override ValidationResult? IsValid(object? value, ValidationContext validationContext)
    {
        if (value is null)
        {
            return ValidationResult.Success;
        }
        if (value is string strValue && !string.IsNullOrEmpty(strValue) && _allowedValues.Contains(strValue.ToLower()))
        {
            return ValidationResult.Success;
        }
        return new ValidationResult(FormatErrorMessage(string.Join(",", _allowedValues)));
    }
}