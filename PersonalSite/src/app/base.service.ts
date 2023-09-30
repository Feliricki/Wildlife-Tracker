import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';
// This base service is meant for data to be paginated and sorted through a user interface
// Tentatively, being used to retrieve studies
@Injectable({
  providedIn: 'root'
})
export abstract class BaseService<T> {

  constructor(protected httpClient: HttpClient) {}

  abstract getData(
    pageIndex: number,
    pageSize: number,
    sortColumn: string,
    sortOrder: string,
    filterColumn: string | undefined,
    filterQuery: string | undefined
  ) : Observable<T>;

  abstract get(id: number): Observable<T>;

  protected getUrl(url: string) {
    return environment.baseUrl + url;
  }
}

export interface ApiResult<T> {
  data: T[];
  pageIndex: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  sortColumn: string;
  sortOrder: string;
  filterColumn: string;
  filterQuery: string;
}
