import { Injectable, signal, computed } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { StudyDTO } from '../studies/study';
import { EventMetadata } from '../events/EventsMetadata';
import { StreamStatus } from '../deckGL/DeckOverlayController';
import { GoogleMapStyles } from '../tracker-view/tracker-view.component';

export interface MapState {
    studies: Map<bigint, StudyDTO>;
    currentStudy: StudyDTO | null;
    focusedStudyId: bigint | null;
    currentEventData: EventMetadata | null;
    streamStatus: StreamStatus;
    mapStyleGoogle: GoogleMapStyles;
    mapType: 'google' | 'mapbox';
    mapLoaded: boolean;
    pointsVisible: boolean;
}

@Injectable({
    providedIn: 'root'
})
export class MapStateService {
    private readonly initialState: MapState = {
        studies: new Map(),
        currentStudy: null,
        focusedStudyId: null,
        currentEventData: null,
        streamStatus: 'standby',
        mapStyleGoogle: "roadmap",
        mapType: 'mapbox',
        mapLoaded: false,
        pointsVisible: true
    };

    private readonly stateSubject = new BehaviorSubject<MapState>(this.initialState);
    public readonly state$ = this.stateSubject.asObservable();

    // Signals for reactive access
    private readonly _studies = signal<Map<bigint, StudyDTO>>(this.initialState.studies);
    private readonly _currentStudy = signal<StudyDTO | null>(this.initialState.currentStudy);
    private readonly _focusedStudyId = signal<bigint | null>(this.initialState.focusedStudyId);
    private readonly _currentEventData = signal<EventMetadata | null>(this.initialState.currentEventData);
    private readonly _streamStatus = signal<StreamStatus>(this.initialState.streamStatus);
    private readonly _mapStyleGoogle = signal<GoogleMapStyles>(this.initialState.mapStyleGoogle);
    private readonly _mapType = signal<'google' | 'mapbox'>(this.initialState.mapType);
    private readonly _mapLoaded = signal<boolean>(this.initialState.mapLoaded);
    private readonly _pointsVisible = signal<boolean>(this.initialState.pointsVisible);

    // Read-only signals
    public readonly studies = this._studies.asReadonly();
    public readonly currentStudy = this._currentStudy.asReadonly();
    public readonly focusedStudyId = this._focusedStudyId.asReadonly();
    public readonly currentEventData = this._currentEventData.asReadonly();
    public readonly streamStatus = this._streamStatus.asReadonly();
    public readonly mapStyleGoogle = this._mapStyleGoogle.asReadonly();
    public readonly mapType = this._mapType.asReadonly();
    public readonly mapLoaded = this._mapLoaded.asReadonly();
    public readonly pointsVisible = this._pointsVisible.asReadonly();

    // Computed signals
    public readonly hasStudies = computed(() => this._studies().size > 0);
    public readonly hasCurrentStudy = computed(() => this._currentStudy() !== null);
    public readonly hasEventData = computed(() => this._currentEventData() !== null);
    public readonly isStreaming = computed(() => this._streamStatus() === 'streaming');
    public readonly canRequestEvents = computed(() =>
        this._currentStudy() !== null && this._mapLoaded() && this._streamStatus() !== 'streaming'
    );

    private get currentState(): MapState {
        return this.stateSubject.value;
    }

    private updateState(updates: Partial<MapState>): void {
        const newState = { ...this.currentState, ...updates };
        this.stateSubject.next(newState);

        // Update signals
        if (updates.studies !== undefined) {
            this._studies.set(updates.studies);
        }
        if (updates.currentStudy !== undefined) {
            this._currentStudy.set(updates.currentStudy);
        }
        if (updates.focusedStudyId !== undefined) {
            this._focusedStudyId.set(updates.focusedStudyId);
        }
        if (updates.currentEventData !== undefined) {
            this._currentEventData.set(updates.currentEventData);
        }
        if (updates.streamStatus !== undefined) {
            this._streamStatus.set(updates.streamStatus);
        }
        if (updates.mapType !== undefined) {
            this._mapType.set(updates.mapType);
        }
        if (updates.mapLoaded !== undefined) {
            this._mapLoaded.set(updates.mapLoaded);
        }
        if (updates.pointsVisible !== undefined) {
            this._pointsVisible.set(updates.pointsVisible);
        }
    }

    // Studies management
    setStudies(studies: Map<bigint, StudyDTO>): void {
        this.updateState({ studies });
    }

    addStudy(study: StudyDTO): void {
        const updatedStudies = new Map(this.currentState.studies);
        updatedStudies.set(study.id, study);
        this.updateState({ studies: updatedStudies });
    }

    getStudy(studyId: bigint): StudyDTO | undefined {
        return this.currentState.studies.get(studyId);
    }

    // Current study management
    setCurrentStudy(study: StudyDTO | null): void {
        this.updateState({ currentStudy: study });
    }

    selectStudyById(studyId: bigint): void {
        const study = this.getStudy(studyId);
        if (study) {
            this.setCurrentStudy(study);
        }
    }

    clearCurrentStudy(): void {
        this.updateState({
            currentStudy: null,
            currentEventData: null,
            streamStatus: 'standby'
        });
    }

    // Focus management
    setFocusedStudy(studyId: bigint | null): void {
        this.updateState({ focusedStudyId: studyId });
    }

    focusOnCurrentStudy(): void {
        const currentStudy = this.currentState.currentStudy;
        if (currentStudy) {
            this.setFocusedStudy(currentStudy.id);
        }
    }

    // Event data management
    setEventData(eventData: EventMetadata | null): void {
        this.updateState({ currentEventData: eventData });
    }

    clearEventData(): void {
        this.updateState({
            currentEventData: null,
            streamStatus: 'standby'
        });
    }

    // Stream status management
    setStreamStatus(status: StreamStatus): void {
        this.updateState({ streamStatus: status });
    }

    // Map configuration
    setMapType(mapType: 'google' | 'mapbox'): void {
        this.updateState({ mapType });
    }

    setMapLoaded(loaded: boolean): void {
        this.updateState({ mapLoaded: loaded });
    }

    togglePointsVisibility(): void {
        this.updateState({ pointsVisible: !this.currentState.pointsVisible });
    }

    setPointsVisible(visible: boolean): void {
        this.updateState({ pointsVisible: visible });
    }

    // Observable getters for specific state slices
    get studies$(): Observable<Map<bigint, StudyDTO>> {
        return this.state$.pipe(map(state => state.studies));
    }

    get mapStyleGoogle$() {
        return this.state$.pipe(map(state => state.mapStyleGoogle));
    }

    get mapType$() {
        return this.state$.pipe(map(state => state.mapLoaded));
    }

    get currentStudy$(): Observable<StudyDTO | null> {
        return this.state$.pipe(map(state => state.currentStudy));
    }

    get focusedStudyId$(): Observable<bigint | null> {
        return this.state$.pipe(map(state => state.focusedStudyId));
    }

    get currentEventData$(): Observable<EventMetadata | null> {
        return this.state$.pipe(map(state => state.currentEventData));
    }

    get streamStatus$(): Observable<StreamStatus> {
        return this.state$.pipe(map(state => state.streamStatus));
    }

    get mapLoaded$(): Observable<boolean> {
        return this.state$.pipe(map(state => state.mapLoaded));
    }

    get pointsVisible$(): Observable<boolean> {
        return this.state$.pipe(map(state => state.pointsVisible));
    }

    // Utility methods
    reset(): void {
        this.stateSubject.next(this.initialState);
        this._studies.set(this.initialState.studies);
        this._currentStudy.set(this.initialState.currentStudy);
        this._focusedStudyId.set(this.initialState.focusedStudyId);
        this._currentEventData.set(this.initialState.currentEventData);
        this._streamStatus.set(this.initialState.streamStatus);
        this._mapType.set(this.initialState.mapType);
        this._mapLoaded.set(this.initialState.mapLoaded);
        this._pointsVisible.set(this.initialState.pointsVisible);
    }
}
