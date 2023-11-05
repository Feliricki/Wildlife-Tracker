import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { TaxaInfo } from './taxa-info';
import { Observable, retry } from 'rxjs';
import { TaxaSuggestion } from './suggestions-dto';

@Injectable({
  providedIn: 'root'
})
export class ENAAPIService {
  // Can be used with a scientific or common name
  EnaBaseUrl: string = "https://www.ebi.ac.uk/ena/taxonomy/rest/";
  generalTaxaUrl: string = "https://www.ebi.ac.uk/ena/taxonomy/rest/";
  suggestTaxaUrl: string = "https://www.ebi.ac.uk/ena/taxonomy/rest/suggest-for-submission/";


  constructor(
    private httpClient: HttpClient) { }

  getCommonName(scientificName: string): Observable<TaxaInfo[]> {
    let uri = this.EnaBaseUrl + "scientific-name/";
    uri = uri + encodeURIComponent(scientificName);
    return this.httpClient.get<TaxaInfo[]>(uri);
  }

  getScientificName(commonName: string): Observable<TaxaInfo[]> {
    let parameters = new HttpParams()
      .set("any-name", commonName);

    return this.httpClient.get<TaxaInfo[]>(this.EnaBaseUrl, { params: parameters })
  }

  suggestName(suggestion: string): Observable<TaxaSuggestion[]> {
    let parameters = new HttpParams()
      .set("suggest-for-submission", suggestion);

    return this.httpClient.get<TaxaSuggestion[]>(this.EnaBaseUrl, { params: parameters });
  }
}
