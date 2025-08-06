import { formatDate } from '@angular/common';
import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
    name: 'timestamp',
    standalone: true
})
export class TimestampPipe implements PipeTransform {

  transform(value: Date, args: string): string {
    if (Date.now() > value.getTime()) {
      console.log("Invalid timestamp");
      return 'N/A';
    }
    const formatted = formatDate(value, args, 'en-US', 'CET');
    if (formatted) {  
      return formatted;
    } else {
      return 'N/A';
    }
  }

}
