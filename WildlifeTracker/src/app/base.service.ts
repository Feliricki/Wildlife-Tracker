import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';

@Injectable({
  providedIn: 'root'
})
export abstract class BaseService<T> {

  // displayedColumns = [];
  // defaultPageIndex: number = 0;
  // defaultPageSize: number = 10;

  constructor(protected httpClient: HttpClient) { }

  abstract getData(
    pageIndex: number,
    pageSize: number,
    sortColumn: string,
    sortOrder: string,
    filterColumn: string | undefined,
    filterQuery: string | undefined
  ): Observable<T>;

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
