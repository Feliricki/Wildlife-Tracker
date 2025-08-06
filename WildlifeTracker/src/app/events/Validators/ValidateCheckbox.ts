import { AbstractControl, FormArray, FormControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export function checkboxOptionSelectedValidator(): ValidatorFn {
  return (control: AbstractControl):
    ValidationErrors | null => {
    // const formGroup = control as FormGroup<{checkboxes: FormArray<FormControl<boolean>>;}>;
    const formGroup = control.get("checkboxes") as FormArray<FormControl<boolean>>;
    const isValid = formGroup.value.some(val => val === true);
    // const isValid = formGroup.value.some(val => val === true);
    return isValid ? null : { noOptionSelected: true };
  }
}
