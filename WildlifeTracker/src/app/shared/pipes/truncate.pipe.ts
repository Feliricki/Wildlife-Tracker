import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'truncate',
  standalone: true
})
export class TruncatePipe implements PipeTransform {

  transform(value: string, defaultSize = 75, truncate = true): string {
    if (!truncate) {
      return value;
    }
    if (!value || value === '' || value === 'N/A') {
      return value;
    }
    let subStr = value.slice(0, Math.min(value.length, defaultSize))
    if (subStr.length === value.length) {
      return value;
    }
    subStr = subStr.padEnd(subStr.length + 3, '...')
    return subStr;
  }

}
