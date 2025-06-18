import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { StudyDTO } from '../studies/study';
import { EventRequest } from '../studies/EventRequest';
import { EventJsonDTO } from '../studies/JsonResults/EventJsonDTO';
import { JsonResponseData } from '../studies/JsonResults/JsonDataResponse';

export interface MoveBankState {
  studies: Map<bigint, StudyDTO>;
  currentStudy: StudyDTO | null;
  isLoading: boolean;
  error: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class MoveBankService {
  private readonly httpClient = inject(HttpClient);

  private readonly stateSubject = new BehaviorSubject<MoveBankState>({
    studies: new Map(),
    currentStudy: null,
    isLoading: false,
    error: null
  });

  public readonly state$ = this.stateSubject.asObservable();

  private get currentState(): MoveBankState {
    return this.stateSubject.value;
  }

  private updateState(updates: Partial<MoveBankState>): void {
    this.stateSubject.next({
      ...this.currentState,
      ...updates
    });
  }

  getAllStudies(): Observable<StudyDTO[]> {
    this.updateState({ isLoading: true, error: null });

    const url = `${environment.baseUrl}api/MoveBank/GetAllStudies`;

    return this.httpClient.get<StudyDTO[]>(url).pipe(
      tap(studies => {
        const studiesMap = new Map<bigint, StudyDTO>();
        studies.forEach(study => studiesMap.set(study.id, study));

        this.updateState({
          studies: studiesMap,
          isLoading: false,
          error: null
        });
      }),
      catchError(error => {
        this.updateState({
          isLoading: false,
          error: error.message || 'Failed to load studies'
        });
        return throwError(() => error);
      })
    );
  }

  getAllStudiesGeoJSON<TProperties>(): Observable<GeoJSON.FeatureCollection<GeoJSON.Point, TProperties>> {
    this.updateState({ isLoading: true, error: null });

    const url = `${environment.baseUrl}api/MoveBank/GetAllStudies`;
    const params = new HttpParams().set('geojsonFormat', 'true');

    return this.httpClient.get<GeoJSON.FeatureCollection<GeoJSON.Point, TProperties>>(url, { params }).pipe(
      tap(() => {
        this.updateState({ isLoading: false, error: null });
      }),
      catchError(error => {
        this.updateState({
          isLoading: false,
          error: error.message || 'Failed to load studies as GeoJSON'
        });
        return throwError(() => error);
      })
    );
  }

  getStudy(studyId: bigint): Observable<StudyDTO> {
    this.updateState({ isLoading: true, error: null });

    const url = `${environment.baseUrl}api/MoveBank/GetStudy`;
    const params = new HttpParams().set('studyId', studyId.toString());

    return this.httpClient.get<StudyDTO>(url, { params }).pipe(
      tap(study => {
        const updatedStudies = new Map(this.currentState.studies);
        updatedStudies.set(study.id, study);

        this.updateState({
          studies: updatedStudies,
          currentStudy: study,
          isLoading: false,
          error: null
        });
      }),
      catchError(error => {
        this.updateState({
          isLoading: false,
          error: error.message || 'Failed to load study'
        });
        return throwError(() => error);
      })
    );
  }

  getJsonData(entityType: 'study' | 'tag' | 'individual', studyId: bigint, sortOrder: 'asc' | 'desc' = 'asc'): Observable<JsonResponseData[]> {
    const url = `${environment.baseUrl}api/MoveBank/GetJsonData`;
    const params = new HttpParams()
      .set('entityType', entityType)
      .set('studyId', studyId.toString())
      .set('sortOrder', sortOrder);

    return this.httpClient.get<JsonResponseData[]>(url, { params }).pipe(
      catchError(error => {
        console.error('Error fetching JSON data:', error);
        return throwError(() => error);
      })
    );
  }

  getEventData(request: EventRequest): Observable<EventJsonDTO> {
    const url = `${environment.baseUrl}api/MoveBank/GetEventData`;

    return this.httpClient.post<EventJsonDTO>(url, request).pipe(
      catchError(error => {
        console.error('Error fetching event data:', error);
        return throwError(() => error);
      })
    );
  }

  setCurrentStudy(study: StudyDTO | null): void {
    this.updateState({ currentStudy: study });
  }

  clearError(): void {
    this.updateState({ error: null });
  }

  // Getters for reactive access to state
  get studies$(): Observable<Map<bigint, StudyDTO>> {
    return this.state$.pipe(map(state => state.studies));
  }

  get currentStudy$(): Observable<StudyDTO | null> {
    return this.state$.pipe(map(state => state.currentStudy));
  }

  get isLoading$(): Observable<boolean> {
    return this.state$.pipe(map(state => state.isLoading));
  }

  get error$(): Observable<string | null> {
    return this.state$.pipe(map(state => state.error));
  }
}
