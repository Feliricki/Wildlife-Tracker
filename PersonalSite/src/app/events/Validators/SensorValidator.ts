import { AbstractControl, FormControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export function sensorValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const formGroup = control.get("sensorForm") as FormControl<string | null>;
    return formGroup.value === null ? { noSensorSelected: true } : null;
  }
}
