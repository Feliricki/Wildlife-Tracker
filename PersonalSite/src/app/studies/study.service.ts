import { HttpClient, HttpErrorResponse, HttpParams, HttpStatusCode } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, of, catchError, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { StudyDTO } from './study';
import { ApiResult } from '../ApiResult';
import { EventJsonDTO } from './JsonResults/EventJsonDTO';
import { EventOptions } from './EventOptions';
import { NonEmptyArray } from '../HelperTypes/NonEmptyArray';
import { JsonResponseData } from './JsonResults/JsonDataResponse';
import { EventRequest } from './EventRequest';

// type PointFeature<TProp> = GeoJSON.Feature<GeoJSON.Point, TProp>;
type PointFeatureCollection<TProp> = GeoJSON.FeatureCollection<GeoJSON.Point, TProp>;

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
    return this.httpClient.get<ApiResult<StudyDTO>>(url, { params: parameters });
  }

  getAllStudies(): Observable<StudyDTO[]> {
    const url = environment.baseUrl + "api/MoveBank/GetAllStudies";
    return this.httpClient.get<StudyDTO[]>(url);
  }

  getAllStudiesGeoJSON<TProp>(): Observable<PointFeatureCollection<TProp>> {
    const url = environment.baseUrl + "api/MoveBank/GetAllStudies";
    const params = new HttpParams()
      .set("geojsonFormat", "true");

    return this.httpClient.get<PointFeatureCollection<TProp>>(url, { params: params });
  }

  // TODO: Test this function
  jsonRequest(entityType: "study" | "tag" | "individual", studyId: bigint, sortOrder: "asc" | "desc" = "asc"):
    Observable<JsonResponseData[]> {

    const url = environment.baseUrl + "api/MoveBank/GetJsonData";
    const parameters = new HttpParams()
      .set("entityType", entityType)
      .set("studyId", studyId.toString())
      .set("sortOrder", sortOrder);

    // NOTE: The Extract type will pick one type from a union type by matching the type attribute to one of "study", "individual", and "tag"
    const opts = { params: parameters, observe: 'response' as const, responseType: 'json' as const };
    const response = this.httpClient.get<(Extract<JsonResponseData, { type: typeof entityType }>)[]>(url, opts);

    return response.pipe(

      map(response => {
        // Status Code 204
        if (response.status == HttpStatusCode.NoContent) {
          return [];
        }
        else if (response.status == 200) {
          return response.body as JsonResponseData[];
        }
        else {
          // TODO:The way this is being handle will result in error being caught here
          // which prevents the table state from being properly updating into the 'error' state.
          // Find a way to capture 200 response from the server and also handle actual errors.
          return [];
        }
      }),
    )
  }

  getEventData(
    studyId: bigint,
    localIdentifiers: NonEmptyArray<string>,
    sensorType: string,
    options: EventOptions)
    : Observable<EventJsonDTO> {
    //  Create a new type excluding some fields such as array types
    const url = environment.baseUrl + "api/MoveBank/GetEventData";
    const parameters = this.eventHelper(studyId, localIdentifiers, sensorType, options);

    console.log(parameters);
    return this.httpClient.get<EventJsonDTO>(url, { params: parameters });
  }
  // NOTE: Validation should occur on the form and on the backend.
  // TODO: Consider sending the request using the given load function
  // to pass the parameters to the body instead of the url (to avoid URL too long responses)
  // and in an attempt to implement batched responses from the backend.
  getGeoJsonFetchRequest(request: EventRequest): Request {

    const url = environment.baseUrl + "api/MoveBank/GetEventData";

    const fetchRequest = new Request(url, {
      method: "POST",
      body: JSON.stringify(request),
    });

    return fetchRequest;
  }

  eventHelper(
    studyId: bigint,
    localIdentifiers: NonEmptyArray<string>,
    sensorType?: string,
    options?: EventOptions): HttpParams {

    let parameters = new HttpParams()
      .set("studyId", studyId.toString());

    for (const localIdentifier of localIdentifiers) {
      parameters = parameters.append("individualLocalIdentifiers", localIdentifier);
    }

    if (sensorType !== undefined) {
      parameters = parameters.set("sensorType", sensorType);
    }

    if (options === undefined) {
      return parameters;
    }

    const keys = Object.keys(options);
    for (const key of keys) {
      const value = options[key as keyof EventOptions];
      if (value !== undefined && Array.isArray(value)) {
        value.forEach(elem => {
          parameters = parameters.append(key, elem);
        })
      }
      else if (value !== undefined && value !== null) {
        parameters = parameters.set(key, value.toString());
      }
    }

    return parameters;
  }

  // INFO: Currently not being used.
  autoComplete(prefix: string, maxCount: number): Observable<string[]> {
    const url = environment.baseUrl + "api/MoveBank/AutoComplete";
    const parameters = new HttpParams()
      .set("prefix", prefix)
      .set("maxCount", maxCount.toString());

    return this.httpClient.get<string[]>(url, { params: parameters }).pipe(
      catchError((err: HttpErrorResponse) => {
        console.error(err.message);
        return of([]);
      })
    )
  }
// getGeoJsonEventData<TGeo extends GeoJSON.Geometry, TProp, TMeta>(request: EventRequest) {
//   const url = environment.baseUrl + "api/MoveBank/GetEventData";
//
//   const opts = {
//     observe: 'response' as const,
//     responseType: 'json' as const,
//     headers: new HttpHeaders({ 'Content-Type': 'application/json' }),
//   };
//
//   const body = {
//     studyId: request.StudyId,
//     localIdentifiers: request.LocalIdentifiers,
//     sensorType: request.SensorType,
//     geometryType: request.GeometryType,
//     options: request.Options,
//   };
//
//   // NOTE: Error responses should be handled by the caller.
//   return this.httpClient
//     .post<Array<{ metadata: TMeta } & GeoJSON.FeatureCollection<TGeo, TProp>> | null>
//     (url, JSON.stringify(body), opts).pipe(
//       tap(res => console.log(res.url))
//     );
// }


}
