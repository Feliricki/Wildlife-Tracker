import { Pipe, PipeTransform } from '@angular/core';
import { TaxaInfo } from '../ENA-API/taxa-info';

@Pipe({
  name: 'getTaxa',
  standalone: true
})
export class GetTaxaPipe implements PipeTransform {

  transform(taxaDTO: TaxaInfo): string {
    return taxaDTO.commonName ?? "";
  }
}
