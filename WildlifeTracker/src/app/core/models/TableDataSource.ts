// import { _isNumberValue } from "@angular/cdk/coercion";
// import { AbstractControl, FormControl } from "@angular/forms";
// import { MatTableDataSource } from "@angular/material/table";
//
// const MAX_SAFE_INTEGER = 9007199254740991;
//
// class FormArrayDataSource extends MatTableDataSource<FormControl> {
//
//   override sortingDataAccessor: (data: FormControl<string | number | boolean>, sortHeaderId: string) => string | number = (
//     data: AbstractControl,
//     sortHeaderId: string,
//   ): string | number => {
//
//     const value = (data as unknown as Record<string, any>)[sortHeaderId];
//
//     if (_isNumberValue(value)){
//       const NumberValue = Number(value);
//       return NumberValue < MAX_SAFE_INTEGER ? NumberValue : value;
//     }
//     return 0;
//   };
//
// }
