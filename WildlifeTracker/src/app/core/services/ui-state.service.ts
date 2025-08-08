import { Injectable, signal, computed } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface UIState {
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  mapLoaded: boolean;
  isSmallScreen: boolean;
  isExtraSmallScreen: boolean;
  currentActiveTab: 'search' | 'events' | 'settings';
}

@Injectable({
  providedIn: 'root'
})
export class UIStateService {
  private readonly initialState: UIState = {
    leftPanelOpen: false,
    rightPanelOpen: false,
    mapLoaded: false,
    isSmallScreen: false,
    isExtraSmallScreen: false,
    currentActiveTab: 'search'
  };

  private readonly stateSubject = new BehaviorSubject<UIState>(this.initialState);
  public readonly state$ = this.stateSubject.asObservable();

  // Signals for reactive UI
  private readonly _leftPanelOpen = signal(this.initialState.leftPanelOpen);
  private readonly _rightPanelOpen = signal(this.initialState.rightPanelOpen);
  private readonly _mapLoaded = signal(this.initialState.mapLoaded);
  private readonly _isSmallScreen = signal(this.initialState.isSmallScreen);
  private readonly _isExtraSmallScreen = signal(this.initialState.isExtraSmallScreen);
  private readonly _currentActiveTab = signal(this.initialState.currentActiveTab);

  // Read-only signals
  public readonly leftPanelOpen = this._leftPanelOpen.asReadonly();
  public readonly rightPanelOpen = this._rightPanelOpen.asReadonly();
  public readonly mapLoaded = this._mapLoaded.asReadonly();
  public readonly isSmallScreen = this._isSmallScreen.asReadonly();
  public readonly isExtraSmallScreen = this._isExtraSmallScreen.asReadonly();
  public readonly currentActiveTab = this._currentActiveTab.asReadonly();

  // Computed signals
  public readonly bothPanelsOpen = computed(() => 
    this._leftPanelOpen() && this._rightPanelOpen()
  );

  public readonly anyPanelOpen = computed(() => 
    this._leftPanelOpen() || this._rightPanelOpen()
  );

  public readonly canShowBothPanels = computed(() => 
    !this._isSmallScreen() && this._mapLoaded()
  );

  private get currentState(): UIState {
    return this.stateSubject.value;
  }

  private updateState(updates: Partial<UIState>): void {
    const newState = { ...this.currentState, ...updates };
    this.stateSubject.next(newState);
    
    // Update signals
    if (updates.leftPanelOpen !== undefined) {
      this._leftPanelOpen.set(updates.leftPanelOpen);
    }
    if (updates.rightPanelOpen !== undefined) {
      this._rightPanelOpen.set(updates.rightPanelOpen);
    }
    if (updates.mapLoaded !== undefined) {
      this._mapLoaded.set(updates.mapLoaded);
    }
    if (updates.isSmallScreen !== undefined) {
      this._isSmallScreen.set(updates.isSmallScreen);
    }
    if (updates.isExtraSmallScreen !== undefined) {
      this._isExtraSmallScreen.set(updates.isExtraSmallScreen);
    }
    if (updates.currentActiveTab !== undefined) {
      this._currentActiveTab.set(updates.currentActiveTab);
    }
  }

  // Panel management
  openLeftPanel(): void {
    this.updateState({ leftPanelOpen: true });
  }

  closeLeftPanel(): void {
    this.updateState({ leftPanelOpen: false });
  }

  toggleLeftPanel(): void {
    this.updateState({ leftPanelOpen: !this.currentState.leftPanelOpen });
  }

  openRightPanel(): void {
    this.updateState({ rightPanelOpen: true });
  }

  closeRightPanel(): void {
    this.updateState({ rightPanelOpen: false });
  }

  toggleRightPanel(): void {
    this.updateState({ rightPanelOpen: !this.currentState.rightPanelOpen });
  }

  closeBothPanels(): void {
    this.updateState({ leftPanelOpen: false, rightPanelOpen: false });
  }

  // Screen size management
  setScreenSize(isSmall: boolean, isExtraSmall: boolean): void {
    this.updateState({ 
      isSmallScreen: isSmall, 
      isExtraSmallScreen: isExtraSmall 
    });

    // Auto-close panels on small screens
    if (isSmall && this.bothPanelsOpen()) {
      this.updateState({ rightPanelOpen: false });
    }
  }

  // Map state
  setMapLoaded(loaded: boolean): void {
    this.updateState({ mapLoaded: loaded });
  }

  // Tab management
  setActiveTab(tab: 'search' | 'events' | 'settings'): void {
    this.updateState({ currentActiveTab: tab });
  }

  // Observable getters for specific state slices
  get leftPanelOpen$(): Observable<boolean> {
    return new BehaviorSubject(this._leftPanelOpen()).asObservable();
  }

  get rightPanelOpen$(): Observable<boolean> {
    return new BehaviorSubject(this._rightPanelOpen()).asObservable();
  }

  get mapLoaded$(): Observable<boolean> {
    return new BehaviorSubject(this._mapLoaded()).asObservable();
  }
}