import { AbstractControl, FormControl, FormGroup, ValidationErrors, ValidatorFn } from "@angular/forms";

export function dateRangeValidators(): ValidatorFn {
  return (control: AbstractControl):
    ValidationErrors | null => {
    // const formGroup = control as FormGroup<{checkboxes: FormArray<FormControl<boolean>>;}>;
    const dateRange = control.get("dateRange") as FormGroup<{
      start: FormControl<null | Date>,
      end: FormControl<null | Date>
    }>;

    const startValue = dateRange.controls.start.value;
    const endValue = dateRange.controls.end.value;

    if ((startValue === null && endValue !== null) || (startValue !== null && endValue === null)) {
      return { IncompleteSubmission: true };
    }

    if (startValue === null && endValue === null) {
      return null;
    }

    if (startValue! > endValue!) {
      return { InvalidDateRange: true };
    }

    return null;
  }
}
