import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Pages, SearchResult } from './wikipedia-responses';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class WikipediaSearchService {

  baseUrl = 'https://api.wikimedia.org/core/v1/wikipedia/';
  endpoint = '/search/page';

  openSearchUrl = 'https://en.wikipedia.org/w/api.php';

  constructor(
    private httpClient: HttpClient
  ) {
    return;
  }

  search(searchQuery: string, numberOfResults = 2, languageCode = "en"): Observable<Pages> {
    const url = this.baseUrl + languageCode + this.endpoint;
    const parameters = new HttpParams()
      .set('q', searchQuery)
      .set('limit', numberOfResults);

    return this.httpClient.get<Pages>(url, { params: parameters });
  }

  searchTitles(query: string, reqLimit = 2): Observable<SearchResult> {
    const url = this.openSearchUrl;
    const parameters = new HttpParams()
      .set('action', 'opensearch')
      .set('namespace', '0')
      .set('limit', reqLimit.toString())
      .set('search', query)
      .set('origin', '*')
      .set('format', 'json');

    return this.httpClient.get<SearchResult>(url, { params: parameters });
  }

}
