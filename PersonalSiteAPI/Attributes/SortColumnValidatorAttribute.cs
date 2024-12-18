﻿using System.ComponentModel.DataAnnotations;

namespace PersonalSiteAPI.Attributes
{
    public class SortColumnValidatorAttribute : ValidationAttribute
    {
        public Type EntityType { get; set; }

        public SortColumnValidatorAttribute(Type entityType)
            : base("Value must match an existing column.") => EntityType = entityType;

        protected override ValidationResult? IsValid(
            object? value,
            ValidationContext validationContext)
        {
            // TODO: Test this validation attribute for wanted behavior
            bool isNullable(Type type) => Nullable.GetUnderlyingType(type) != null;
            if (isNullable(validationContext.ObjectType) && value is null)
            {
                return ValidationResult.Success;
            }
            
            var strValue = value as string;
            if (!string.IsNullOrEmpty(strValue)
                && EntityType.GetProperties()
                    .Any(p => p.Name == strValue))
                return ValidationResult.Success;
            
            return new ValidationResult(ErrorMessage);
        }
    }
}
