import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { EMPTY, Observable, of, map, catchError } from 'rxjs';
import { environment } from '../../environments/environment';
import { StudyDTO } from './study';
import { ApiResult } from '../ApiResult';
import { EventJsonDTO } from './JsonResults/EventJsonDTO';
import { IndividualDTO } from './JsonResults/IndividualDTO';
import { TagDTO } from './JsonResults/TagDTO';
import { EventRequest } from './EventRequest';

@Injectable({
  providedIn: 'root'
})
export class StudyService {

  constructor(
    protected httpClient: HttpClient,
  ) {
    ;
  }

  getStudy(studyId: number): Observable<StudyDTO> {
    let url = environment.baseUrl + "api/MoveBank/GetStudy";
    let parameters = new HttpParams().set("studyId", studyId.toString());
    return this.httpClient.get<StudyDTO>(url, { params: parameters });
  }

  getStudies(
    pageIndex: number,
    pageSize: number,
    sortColumn: string,
    sortOrder: string,
    filterColumn?: string,
    filterQuery?: string
  ): Observable<ApiResult<StudyDTO>> {

    let url = environment.baseUrl + "api/MoveBank/GetStudies";
    let parameters = new HttpParams()
      .set("pageIndex", pageIndex.toString())
      .set("pageSize", pageSize.toString())
      .set("sortColumn", sortColumn)
      .set("sortOrder", sortOrder);

    if (filterColumn && filterQuery) {
      parameters = parameters
        .set("filterColumn", filterColumn)
        .set("filterQuery", filterQuery);
    }
    console.log(parameters.toString());
    return this.httpClient.get<ApiResult<StudyDTO>>(url, { params: parameters });
  }

  getAllStudies(): Observable<StudyDTO[]> {
    let url = environment.baseUrl + "api/MoveBank/GetAllStudies";
    return this.httpClient.get<StudyDTO[]>(url);
  }

  jsonRequest(entityType: "study" | "tag" | "individual", studyId: bigint):
    Observable<(IndividualDTO | StudyDTO | TagDTO)[]> {
    let url = environment.baseUrl + "api/MoveBank/GetJsonData";
    let parameters = new HttpParams()
      .set("entityType", entityType)
      .set("studyId", studyId.toString());

    let response: Observable<(IndividualDTO | StudyDTO | TagDTO)[]> = EMPTY;
    switch (entityType) {
      case "study": {
        response = this.httpClient.get<StudyDTO[]>(url, { params: parameters });
        break;
      }
      case "tag": {
        response = this.httpClient.get<TagDTO[]>(url, { params: parameters });
        break;
      }
      case "individual": {
        response = this.httpClient.get<IndividualDTO[]>(url, { params: parameters });
        break;
      }
      default: {
        return EMPTY;
      }
    }
    return response.pipe(
      catchError(_ => {
        console.error("Error retrieving jsonData");
        return of([]);
      })
    )
  }

  getEventData(request: EventRequest): Observable<EventJsonDTO> {
    let url = environment.baseUrl + "api/MoveBank/GetEventData";
    let parameters = new HttpParams({ fromString: JSON.stringify(request) });

    return this.httpClient.get<EventJsonDTO>(url, { params: parameters });
  }
}
