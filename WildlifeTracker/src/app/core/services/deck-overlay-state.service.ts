import { Injectable, signal, computed } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { LayerTypes } from '../deckGL/DeckOverlayController';
import {
  PointOverlayOptions,
  PathOverlayOptions,
  AggregationOverlayOptions,
  PointForms,
  PathForms,
  AggregationForms
} from '../tracker-view/OverlayOptions';
import { ControlChange } from '../events/animal-data-panel.component';
import { EventRequest } from '../studies/EventRequest';

export interface DeckOverlayState {
  currentLayer: LayerTypes;
  controlChange: ControlChange | null;
  pointOptions: PointOverlayOptions | null;
  pathOptions: PathOverlayOptions | null;
  aggregationOptions: AggregationOverlayOptions | null;
  eventRequest: EventRequest | null;
  activeIndividuals: string[];
  layerVisible: boolean;
  globalOpacity: number;
}

export interface LayerFormState {
  pointForms: Map<string, PointForms>;
  pathForms: Map<string, PathForms>;
  aggregationForms: Map<string, AggregationForms>;
}

@Injectable({
  providedIn: 'root'
})
export class DeckOverlayStateService {
  // TODO:Instantiate the deckGL Controller here instead of the map components?
  private readonly initialState: DeckOverlayState = {
    currentLayer: LayerTypes.ArcLayer,
    pointOptions: null,
    controlChange: null,
    pathOptions: null,
    aggregationOptions: null,
    eventRequest: null,
    activeIndividuals: [],
    layerVisible: true,
    globalOpacity: 1.0
  };

  private readonly initialFormState: LayerFormState = {
    pointForms: new Map(),
    pathForms: new Map(),
    aggregationForms: new Map()
  };

  private readonly stateSubject = new BehaviorSubject<DeckOverlayState>(this.initialState);
  private readonly formStateSubject = new BehaviorSubject<LayerFormState>(this.initialFormState);

  public readonly state$ = this.stateSubject.asObservable();
  public readonly formState$ = this.formStateSubject.asObservable();

  // Signals for reactive access
  private readonly _currentLayer = signal<LayerTypes>(this.initialState.currentLayer);
  private readonly _pointOptions = signal<PointOverlayOptions | null>(this.initialState.pointOptions);
  private readonly _pathOptions = signal<PathOverlayOptions | null>(this.initialState.pathOptions);
  private readonly _aggregationOptions = signal<AggregationOverlayOptions | null>(this.initialState.aggregationOptions);
  private readonly _activeIndividuals = signal<string[]>(this.initialState.activeIndividuals);
  private readonly _layerVisible = signal<boolean>(this.initialState.layerVisible);
  private readonly _globalOpacity = signal<number>(this.initialState.globalOpacity);

  // Form state signals
  private readonly _pointForms = signal<Map<string, PointForms>>(this.initialFormState.pointForms);
  private readonly _pathForms = signal<Map<string, PathForms>>(this.initialFormState.pathForms);
  private readonly _aggregationForms = signal<Map<string, AggregationForms>>(this.initialFormState.aggregationForms);

  // Read-only signals
  public readonly currentLayer = this._currentLayer.asReadonly();
  public readonly pointOptions = this._pointOptions.asReadonly();
  public readonly pathOptions = this._pathOptions.asReadonly();
  public readonly aggregationOptions = this._aggregationOptions.asReadonly();
  public readonly activeIndividuals = this._activeIndividuals.asReadonly();
  public readonly layerVisible = this._layerVisible.asReadonly();
  public readonly globalOpacity = this._globalOpacity.asReadonly();

  // Form signals
  public readonly pointForms = this._pointForms.asReadonly();
  public readonly pathForms = this._pathForms.asReadonly();
  public readonly aggregationForms = this._aggregationForms.asReadonly();

  // Computed signals
  public readonly isPathLayer = computed(() =>
    this._currentLayer() === LayerTypes.ArcLayer || this._currentLayer() === LayerTypes.LineLayer
  );

  public readonly isPointLayer = computed(() =>
    this._currentLayer() === LayerTypes.ScatterplotLayer
  );

  public readonly isAggregationLayer = computed(() =>
    this._currentLayer() === LayerTypes.HeatmapLayer ||
    this._currentLayer() === LayerTypes.ScreenGridLayer
  );

  public readonly hasActiveIndividuals = computed(() =>
    this._activeIndividuals().length > 0
  );

  public readonly currentOptions = computed(() => {
    if (this.isPathLayer()) return this._pathOptions();
    if (this.isPointLayer()) return this._pointOptions();
    if (this.isAggregationLayer()) return this._aggregationOptions();
    return null;
  });

  private get currentState(): DeckOverlayState {
    return this.stateSubject.value;
  }

  private get currentFormState(): LayerFormState {
    return this.formStateSubject.value;
  }

  private updateState(updates: Partial<DeckOverlayState>): void {
    const newState = { ...this.currentState, ...updates };
    this.stateSubject.next(newState);

    // Update signals
    if (updates.currentLayer !== undefined) {
      this._currentLayer.set(updates.currentLayer);
    }
    if (updates.pointOptions !== undefined) {
      this._pointOptions.set(updates.pointOptions);
    }
    if (updates.pathOptions !== undefined) {
      this._pathOptions.set(updates.pathOptions);
    }
    if (updates.aggregationOptions !== undefined) {
      this._aggregationOptions.set(updates.aggregationOptions);
    }
    if (updates.activeIndividuals !== undefined) {
      this._activeIndividuals.set(updates.activeIndividuals);
    }
    if (updates.layerVisible !== undefined) {
      this._layerVisible.set(updates.layerVisible);
    }
    if (updates.globalOpacity !== undefined) {
      this._globalOpacity.set(updates.globalOpacity);
    }
  }

  private updateFormState(updates: Partial<LayerFormState>): void {
    const newState = { ...this.currentFormState, ...updates };
    this.formStateSubject.next(newState);

    // Update form signals
    if (updates.pointForms !== undefined) {
      this._pointForms.set(updates.pointForms);
    }
    if (updates.pathForms !== undefined) {
      this._pathForms.set(updates.pathForms);
    }
    if (updates.aggregationForms !== undefined) {
      this._aggregationForms.set(updates.aggregationForms);
    }
  }

  // Layer management
  setCurrentLayer(layer: LayerTypes): void {
    this.updateState({ currentLayer: layer });
  }

  // Options management
  setPointOptions(options: PointOverlayOptions): void {
    this.updateState({ pointOptions: options });
  }

  setPathOptions(options: PathOverlayOptions): void {
    this.updateState({ pathOptions: options });
  }

  setAggregationOptions(options: AggregationOverlayOptions): void {
    this.updateState({ aggregationOptions: options });
  }

  // Individual management
  setActiveIndividuals(individuals: string[]): void {
    this.updateState({ activeIndividuals: individuals });
  }

  setEventRequest(request: EventRequest): void {
    this.updateState({ eventRequest: request });
  }

  addIndividual(individual: string): void {
    const current = this.currentState.activeIndividuals;
    if (!current.includes(individual)) {
      this.updateState({ activeIndividuals: [...current, individual] });
    }
  }

  removeIndividual(individual: string): void {
    const current = this.currentState.activeIndividuals;
    this.updateState({
      activeIndividuals: current.filter(ind => ind !== individual)
    });
  }

  clearIndividuals(): void {
    this.updateState({ activeIndividuals: [] });
    this.clearAllForms();
  }

  // Form management
  addPointForm(individual: string, form: PointForms): void {
    const updatedForms = new Map(this.currentFormState.pointForms);
    updatedForms.set(individual, form);
    this.updateFormState({ pointForms: updatedForms });
  }

  addPathForm(individual: string, form: PathForms): void {
    const updatedForms = new Map(this.currentFormState.pathForms);
    updatedForms.set(individual, form);
    this.updateFormState({ pathForms: updatedForms });
  }

  addAggregationForm(individual: string, form: AggregationForms): void {
    const updatedForms = new Map(this.currentFormState.aggregationForms);
    updatedForms.set(individual, form);
    this.updateFormState({ aggregationForms: updatedForms });
  }

  removePointForm(individual: string): void {
    const updatedForms = new Map(this.currentFormState.pointForms);
    updatedForms.delete(individual);
    this.updateFormState({ pointForms: updatedForms });
  }

  removePathForm(individual: string): void {
    const updatedForms = new Map(this.currentFormState.pathForms);
    updatedForms.delete(individual);
    this.updateFormState({ pathForms: updatedForms });
  }

  removeAggregationForm(individual: string): void {
    const updatedForms = new Map(this.currentFormState.aggregationForms);
    updatedForms.delete(individual);
    this.updateFormState({ aggregationForms: updatedForms });
  }

  clearAllForms(): void {
    this.updateFormState({
      pointForms: new Map(),
      pathForms: new Map(),
      aggregationForms: new Map()
    });
  }

  // Control change handling
  applyControlChange(change: ControlChange): void {
    const { formType, field, change: valueChange } = change;

    switch (formType) {
      case 'point':
        this.updatePointControl(field, valueChange);
        break;
      case 'path':
        this.updatePathControl(field, valueChange);
        break;
      case 'aggregation':
        this.updateAggregationControl(field, valueChange);
        break;
    }

    this.updateState({
      controlChange: change
    });

  }

  private updatePointControl(field: string, valueChange: ControlChange['change']): void {
    const currentOptions = this.currentState.pointOptions;
    if (!currentOptions) return;

    const updatedOptions = { ...currentOptions };

    switch (field) {
      case 'opacity':
        if (valueChange.type === 'number') {
          updatedOptions.opacity = valueChange.value;
        }
        break;
      case 'getRadius':
        if (valueChange.type === 'number') {
          updatedOptions.getRadius = valueChange.value;
        }
        break;
      case 'getFillColor':
        if (valueChange.type === 'color') {
          updatedOptions.getFillColor = valueChange.value;
        }
        break;
      case 'getLineColor':
        if (valueChange.type === 'color') {
          updatedOptions.getLineColor = valueChange.value;
        }
        break;
    }

    this.setPointOptions(updatedOptions);
  }

  private updatePathControl(field: string, valueChange: ControlChange['change']): void {
    const currentOptions = this.currentState.pathOptions;
    if (!currentOptions) return;

    const updatedOptions = { ...currentOptions };

    switch (field) {
      case 'opacity':
        if (valueChange.type === 'number') {
          updatedOptions.opacity = valueChange.value;
        }
        break;
      case 'widthScale':
        if (valueChange.type === 'number') {
          updatedOptions.widthScale = valueChange.value;
        }
        break;
      case 'getSourceColor':
        if (valueChange.type === 'color') {
          updatedOptions.getSourceColor = valueChange.value;
        }
        break;
      case 'getTargetColor':
        if (valueChange.type === 'color') {
          updatedOptions.getTargetColor = valueChange.value;
        }
        break;
    }

    this.setPathOptions(updatedOptions);
  }

  private updateAggregationControl(field: string, valueChange: ControlChange['change']): void {
    const currentOptions = this.currentState.aggregationOptions;
    if (!currentOptions) return;

    const updatedOptions = { ...currentOptions };

    switch (field) {
      case 'radius':
        if (valueChange.type === 'number') {
          updatedOptions.radius = valueChange.value;
        }
        break;
      case 'elevationScale':
        if (valueChange.type === 'number') {
          updatedOptions.elevationScale = valueChange.value;
        }
        break;
    }

    this.setAggregationOptions(updatedOptions);
  }

  // Visibility and global controls
  toggleLayerVisibility(): void {
    this.updateState({ layerVisible: !this.currentState.layerVisible });
  }

  setLayerVisible(visible: boolean): void {
    this.updateState({ layerVisible: visible });
  }

  setGlobalOpacity(opacity: number): void {
    const clampedOpacity = Math.max(0, Math.min(1, opacity));
    this.updateState({ globalOpacity: clampedOpacity });
  }

  // Observable getters
  get currentLayer$(): Observable<LayerTypes> {
    return this.state$.pipe(map(state => state.currentLayer));
  }

  get controlChange$() {
    return this.state$.pipe(map(state => state.controlChange));
  }

  get activeIndividuals$(): Observable<string[]> {
    return this.state$.pipe(map(state => state.activeIndividuals));
  }

  get layerVisible$(): Observable<boolean> {
    return this.state$.pipe(map(state => state.layerVisible));
  }

  get globalOpacity$(): Observable<number> {
    return this.state$.pipe(map(state => state.globalOpacity));
  }

  get eventRequest$() {
    return this.state$.pipe(map(state => state.eventRequest));
  }

  // Utility methods
  reset(): void {
    this.stateSubject.next(this.initialState);
    this.formStateSubject.next(this.initialFormState);

    // Reset signals
    this._currentLayer.set(this.initialState.currentLayer);
    this._pointOptions.set(this.initialState.pointOptions);
    this._pathOptions.set(this.initialState.pathOptions);
    this._aggregationOptions.set(this.initialState.aggregationOptions);
    this._activeIndividuals.set(this.initialState.activeIndividuals);
    this._layerVisible.set(this.initialState.layerVisible);
    this._globalOpacity.set(this.initialState.globalOpacity);

    this._pointForms.set(this.initialFormState.pointForms);
    this._pathForms.set(this.initialFormState.pathForms);
    this._aggregationForms.set(this.initialFormState.aggregationForms);
  }

  // Helper methods for layer type checking
  isCurrentLayerPath(): boolean {
    return this.isPathLayer();
  }

  isCurrentLayerPoint(): boolean {
    return this.isPointLayer();
  }

  isCurrentLayerAggregation(): boolean {
    return this.isAggregationLayer();
  }

  // Get form for specific individual
  getPointFormForIndividual(individual: string): PointForms | undefined {
    return this.currentFormState.pointForms.get(individual);
  }

  getPathFormForIndividual(individual: string): PathForms | undefined {
    return this.currentFormState.pathForms.get(individual);
  }

  getAggregationFormForIndividual(individual: string): AggregationForms | undefined {
    return this.currentFormState.aggregationForms.get(individual);
  }
}
