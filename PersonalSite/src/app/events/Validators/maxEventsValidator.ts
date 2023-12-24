import { AbstractControl, FormControl, ValidationErrors, ValidatorFn } from "@angular/forms";

export const MAX_EVENTS = 500;

export function maxEventsValidator(): ValidatorFn {
  return (control: AbstractControl):
    ValidationErrors | null => {
    const maxEvents = control.get("maxEvents") as FormControl<number | null>;
    if (maxEvents.disabled) {
      return null;
    }
    const value = maxEvents.value;

    if (value === null || value < 0 || value > MAX_EVENTS) {
      return { InvalidNumber: true };
    }

    return null;
  }
}
