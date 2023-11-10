import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
    name: 'default',
    standalone: true
})
export class DefaultPipe implements PipeTransform {

  transform(value?: string, arg?: string): string {
    const defaultStr = arg ?? 'N/A';
    if (!value || value === '') {
      return defaultStr || 'N/A';
    }
    return value;
  }

}
