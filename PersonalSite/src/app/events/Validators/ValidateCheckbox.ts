import { AbstractControl, FormArray, FormControl, FormGroup, ValidationErrors, ValidatorFn } from '@angular/forms';

export function checkboxOptionSelectedValidator(): ValidatorFn {
  return (control: AbstractControl):
    ValidationErrors | null => {
    const formGroup = control as FormGroup<{checkboxes: FormArray<FormControl<boolean>>;}>;
    const isValid = formGroup.controls.checkboxes.value.some(val => val === true);
    return isValid ? null : { noOptionSelected: true };
  }
}
