import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'processCollection',
  standalone: true
})
export class ProcessCollectionPipe implements PipeTransform {

  transform(collection: string, delimiter = ","): string[] {
    let splitList = collection.split(delimiter);
    console.log("Split collection is" + splitList.toString());
    return splitList
  }
}
