import { HttpClient, HttpParams, HttpResponse, HttpStatusCode } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { EMPTY, Observable, of, catchError, tap, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { StudyDTO } from './study';
import { ApiResult } from '../ApiResult';
import { EventJsonDTO } from './JsonResults/EventJsonDTO';
// import { TagJsonDTO } from './JsonResults/TagJsonDTO';
import { EventOptions } from './EventOptions';
import { NonEmptyArray } from '../HelperTypes/NonEmptyArray';
// import { IndividualJsonDTO } from './JsonResults/IndividualJsonDTO';
// import { StudyJsonDTO } from './JsonResults/StudyJsonDTO';
import { JsonResponseData } from './JsonResults/JsonDataResponse';

@Injectable({
  providedIn: 'root'
})
export class StudyService {

  constructor(
    protected httpClient: HttpClient,
  ) {
    return;
  }

  getStudy(studyId: number): Observable<StudyDTO> {
    const url = environment.baseUrl + "api/MoveBank/GetStudy";
    const parameters = new HttpParams().set("studyId", studyId.toString());
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

    const url = environment.baseUrl + "api/MoveBank/GetStudies";
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
    const url = environment.baseUrl + "api/MoveBank/GetAllStudies";
    return this.httpClient.get<StudyDTO[]>(url);
  }

  // TODO: Test this function
  jsonRequest(entityType: "study" | "tag" | "individual", studyId: bigint):
    Observable<JsonResponseData[]> {
    const url = environment.baseUrl + "api/MoveBank/GetJsonData";
    const parameters = new HttpParams()
      .set("entityType", entityType)
      .set("studyId", studyId.toString());

    // NOTE: The Extract type will pick one type from a union type by matching the type attribute to one of "study", "individual", and "tag"
    let response = this.httpClient.get<(Extract<JsonResponseData, { type: typeof entityType }>)[]>(url, { params: parameters, observe: 'response' as const, responseType: 'json' as const });
    console.log(response);
    return response.pipe(
      tap(response => console.log(response)),
      map(response => {
        // Status Code 204
        if (response.status == HttpStatusCode.NoContent) {
          return [];
        }
        else if (response.status == 200){
          return response.body as JsonResponseData[];
        }
        else {
          console.log("unknown response from jsonRequest");
          return [];
        }
      }),

      catchError(() => {

        return of([]);
      })
    )
  }

  //TODO: Figure out how to properly pass an interface or object as an argument in query parameters
  // Get an autosave plugin
  getEventData(
    studyId: bigint,
    localIdentifiers: NonEmptyArray<string>,
    sensorType: string,
    options: EventOptions)
    : Observable<EventJsonDTO> {
    //  Create a new type excluding some fields such as array types
    const url = environment.baseUrl + "api/MoveBank/GetEventData";
    let parameters = new HttpParams()
      .set("studyId", studyId.toString())
      .set("sensorType", sensorType);

    for (const localIdentifier of localIdentifiers) {
      parameters = parameters.append("individualLocalIdentifiers", localIdentifier);
    }
    // if (options.attributes !== undefined) {
    //   parameters = parameters.set("attributes", options.attributes);
    // }
    // if (options.timestampStart !== undefined && options.timestampEnd) {
    //   parameters = parameters.set("timestampStart", options.timestampStart.toString());
    //   parameters = parameters.set("timestampEnd", options.timestampEnd.toString());
    // }
    // if (options.eventProfiles !== undefined && options.eventProfiles.length >= 1) {
    //   // parameters = parameters.set("eventProfiles", options.eventProfiles[0]);
    //   for (const profile of options.eventProfiles) {
    //     parameters = parameters.append("eventProfiles", profile);
    //   }
    // }
    // if (options.coordinateTrailingDigits !== undefined) {
    //   parameters = parameters.set("coordinateTrailingDigits", options.coordinateTrailingDigits);
    // }
    // if (options.maxDurationDays !== undefined) {
    //   parameters = parameters.set("maxDurationDays", options.maxDurationDays);
    // }
    // if (options.maxKmBetweenEvents !== undefined) {
    //   parameters = parameters.set("maxKmBetweenEvents", options.maxKmBetweenEvents);
    // }
    // if (options.milliBetweenEvents !== undefined) {
    //   parameters = parameters.set("milliBetweenEvents", options.milliBetweenEvents);
    // }
    // if (options.maxEventsPerIndividual !== undefined) {
    //   parameters = parameters.set("maxEventsPerIndividual", options.maxEventsPerIndividual);
    // }
    const keys = Object.keys(options);
    for (const key of keys) {
      const value = options[key as keyof EventOptions];
      if (value !== undefined && Array.isArray(value)) {
        value.forEach(elem => {
          parameters = parameters.append(key, elem);
        })
      }
      else if (value !== undefined) {
        parameters.set(key, value.toString());
      }
    }
    console.log(parameters);
    return this.httpClient.get<EventJsonDTO>(url, { params: parameters });
  }
}
