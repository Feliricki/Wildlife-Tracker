import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { EMPTY, Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { StudyDTO } from './study';
import { ApiResult } from '../ApiResult';
import { EventJsonDTO } from './JsonResults/EventJsonDTO';

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

  jsonRequest(entityType: string, studyId: bigint): void {
    let url = environment.baseUrl + "api/MoveBank/GetJsonData";
    let parameters = new HttpParams()
      .set("entityType", entityType)
      .set("studyId", studyId.toString());

    // this.httpClient.get<>
  }

  getEventData(
    studyId: bigint, 
    localIdentifiers: string[], 
    sensorType:string, 
    eventProfile: string="",
    optionalParameters: string=""): Observable<EventJsonDTO> {
    let url = environment.baseUrl + "api/MoveBank/GetEventData";    
    let parameters = new HttpParams()
      .set("studyId", studyId.toString())
      .set("sensorType", sensorType);

    for (const localIdentifier of localIdentifiers){
      parameters = parameters.set("individualLocalIdentifiers", localIdentifier);
    }
    if (eventProfile) {
      parameters = parameters.set("eventProfile", eventProfile);
    }

    return EMPTY;    
  }
}
