import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'default'
})
export class DefaultPipe implements PipeTransform {

  transform(value?: string, arg?: string): string {
    let defaultStr = arg ?? 'N/A';
    if (!value || value === '') {
      return defaultStr || 'N/A';
    }
    return value;
  }

}
