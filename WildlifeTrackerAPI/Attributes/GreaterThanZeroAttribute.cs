using System.ComponentModel.DataAnnotations;

namespace WildlifeTrackerAPI.Attributes {
    public class GreaterThanZeroAttribute : ValidationAttribute 
    {
        public GreaterThanZeroAttribute() : base("Value must be greater than zero"){}

        protected override ValidationResult? IsValid(object? value, ValidationContext validationContext)
        {
            bool isNullable (Type type) => Nullable.GetUnderlyingType(type) != null;
            if (isNullable(validationContext.ObjectType)){
                return ValidationResult.Success;
            }
            bool success;
            switch (value){
                case int intValue:
                    success = intValue > 0;
                    break;
                case float floatVal:
                    success = floatVal > 0;
                    break;
                case null:
                    success = true;
                    break;
                default:
                    return new ValidationResult(ErrorMessage);
            }

            if (success){
                return ValidationResult.Success;
            }
            else{
                return new ValidationResult(ErrorMessage);
            }
        }
    }
}
