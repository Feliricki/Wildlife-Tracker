import { ChangeDetectionStrategy, Component, OnInit, Signal, WritableSignal, signal, inject, DestroyRef } from '@angular/core';
import { GoogleMapViewComponent } from '../base-maps/google maps/google-map.component';
import { SimpleSearchComponent } from '../simple-search/simple-search.component';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatButtonModule } from '@angular/material/button';
import { ControlChange, AnimalDataPanelComponent } from '../events/animal-data-panel.component';
import { StudyDTO } from '../studies/study';
import { MatIconModule } from '@angular/material/icon';
import { animate, style, transition, trigger, state } from '@angular/animations';
import { BreakpointObserver, BreakpointState, Breakpoints } from '@angular/cdk/layout';
import { firstValueFrom, map } from 'rxjs';
import { NgStyle, AsyncPipe } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { MatChipsModule } from '@angular/material/chips';
import { MatCheckboxChange, MatCheckboxModule } from '@angular/material/checkbox';
import { LayerTypes, StreamStatus } from '../deckGL/DeckOverlayController';
import { MatRippleModule } from '@angular/material/core';
import { EventMetadata } from '../events/EventsMetadata';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatRadioChange, MatRadioModule } from '@angular/material/radio';
import { FormsModule } from '@angular/forms';
import { MapboxComponent } from '../base-maps/mapbox/mapbox.component';
import { Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';

// Import the new services
import { UIStateService } from '../services/ui-state.service';
import { MapStateService } from '../services/map-state.service';
import { DeckOverlayStateService } from '../services/deck-overlay-state.service';
import { MoveBankService } from '../services/movebank.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

export type GoogleMapStyles =
  "roadmap" | "terrain" | "hybrid" | "satellite";

type BaseMaps = 'google' | 'mapbox' | 'arcgis';

@Component({
    selector: 'app-tracker-view',
    templateUrl: './tracker-view.component.html',
    styleUrls: ['./tracker-view.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        AnimalDataPanelComponent,
        MapboxComponent,
        MatSidenavModule,
        MatButtonModule,
        SimpleSearchComponent,
        GoogleMapViewComponent,
        MatIconModule,
        NgStyle,
        AsyncPipe,
        MatToolbarModule,
        MatButtonToggleModule,
        MatMenuModule,
        MatDividerModule,
        MatChipsModule,
        MatCheckboxModule,
        MatRippleModule,
        MatTooltipModule,
        MatRadioModule,
        FormsModule,
    ],
    animations: [
        trigger('leftToggleClick', [
            transition('void => *', [
                style({ transform: 'translateX(-100%)' }),
                animate('.3s ease-in'),
            ]),
        ]),
        trigger('rightToggleClick', [
            transition('void => *', [
                style({ transform: 'translateX(100%)' }),
                animate('.3s ease-in'),
            ]),
        ]),
        trigger('leftPanelOpened', [
            state('true', style({ left: 'calc(400px - 1.5em)' })),
            state('false', style({ left: '.3em' })),
            transition('true => false', [
                animate('300ms cubic-bezier(0, 0, 0, 1)', style({ transform: 'translate(calc(-400px + 1.5em + .3em))' })),
            ]),
            transition('false => true', [
                animate('325ms cubic-bezier(0, 0, 0, 1)', style({ transform: 'translate(calc(400px - 1.5em - .3em))' })),
            ]),
        ]),
        trigger('rightPanelOpened', [
            state("true", style({ right: "calc(800px - 30px)" })), // Adjusted to move button further right
            state("false", style({ right: "0.3em" })), // Match left button's screen edge distance
            transition('true => false', [
                animate('300ms cubic-bezier(0, 0, 0, 1)')
            ]),
            transition('false => true', [
                animate('325ms cubic-bezier(0, 0, 0, 1)')
            ]),
        ])
    ]
})
export class MapDashboardComponent implements OnInit {
  // Inject services
  private readonly uiStateService = inject(UIStateService);
  private readonly mapStateService = inject(MapStateService);
  private readonly deckOverlayStateService = inject(DeckOverlayStateService);
  private readonly moveBankService = inject(MoveBankService);
  private readonly breakpointObserver = inject(BreakpointObserver);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  // UI State from service
  readonly leftPanelOpen = this.uiStateService.leftPanelOpen;
  readonly rightPanelOpen = this.uiStateService.rightPanelOpen;
  readonly mapLoaded = this.uiStateService.mapLoaded;
  readonly isSmallScreen = this.uiStateService.isSmallScreen;
  readonly isExtraSmallScreen = this.uiStateService.isExtraSmallScreen;

  // Map State from service
  readonly currentStudy = this.mapStateService.currentStudy;
  readonly studies = this.mapStateService.studies;
  readonly focusedStudyId = this.mapStateService.focusedStudyId;
  readonly currentEventData = this.mapStateService.currentEventData;
  readonly streamStatus = this.mapStateService.streamStatus;
  readonly pointsVisible = this.mapStateService.pointsVisible;

  // Deck Overlay State from service
  readonly currentLayer = this.deckOverlayStateService.currentLayer;
  readonly layerVisible = this.deckOverlayStateService.layerVisible;

  // Local component state
  readonly activeMap: WritableSignal<BaseMaps> = signal('mapbox');
  readonly currentMapType: WritableSignal<GoogleMapStyles> = signal("roadmap");
  readonly isAdmin: Signal<boolean> = this.authService.isAdmin;

  // Observables for responsive design
  readonly smallScreen$ = this.breakpointObserver
    .observe([Breakpoints.XSmall, Breakpoints.Small])
    .pipe(map((state: BreakpointState) => state.matches));

  readonly XSmallScreen$ = this.breakpointObserver
    .observe([Breakpoints.XSmall])
    .pipe(map((state: BreakpointState) => state.matches));

  // Styling objects
  readonly leftNavSmallStyle = {
    "min-width": "100px",
    "max-width": "400px",
    "width": "100%",
  };

  readonly leftNavLargeStyle = {
    "width": "400px",
  };

  readonly menuXSmallStyle = {
    "margin-top": "1.5em",
    "margin-right": "0.5em"
  };

  readonly menuNormalStyle = {
    "position": "fixed",
    "left": "1em",
    "margin-top": "0.5em"
  };

  readonly rightNavStyle = {
    "width": "800px",
    "margin-top": "13em",
    "height": "500px",
    "background-color": "rgba(0,0,0,0)",
  };

  // TODO:Refactor this to include the hexagon layer again
  readonly layerMenuOptions = [
    ["Arc Layer", LayerTypes.ArcLayer],
    ["Line Layer", LayerTypes.LineLayer],
    // ["Hexagon Layer", LayerTypes.HexagonLayer],
    ["Scatterplot Layer", LayerTypes.ScatterplotLayer],
    ["Screen Grid Layer", LayerTypes.ScreenGridLayer],
    ["Heatmap Layer", LayerTypes.HeatmapLayer],
  ] as Array<[string, LayerTypes]>;

  constructor() {
    // Set up responsive design handling
    this.smallScreen$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(isSmall => {
        this.uiStateService.setScreenSize(isSmall, false);
        if (isSmall && this.leftPanelOpen()) {
          this.uiStateService.closeLeftPanel();
        }
      });

    this.XSmallScreen$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(isExtraSmall => {
        this.uiStateService.setScreenSize(this.isSmallScreen(), isExtraSmall);
      });

    // Initialize studies when component loads
    this.moveBankService.getAllStudies()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(studies => {
        const studiesMap = new Map<bigint, StudyDTO>();
        studies.forEach(study => studiesMap.set(study.id, study));
        this.mapStateService.setStudies(studiesMap);
      });
  }

  ngOnInit(): void {
    // Ensure map type signals are synchronized (only for supported types)
    const activeMapType = this.activeMap();

    if (activeMapType === 'google' || activeMapType === 'mapbox') {
      this.mapStateService.setMapType(activeMapType);
    }

    // Handle initial responsive state
    firstValueFrom(this.smallScreen$).then(isSmall => {
      if (isSmall) {
        this.uiStateService.closeLeftPanel();
      }
    });
  }

    // Navigation methods
  gotoAdminPage(): void {
    this.router.navigate(["/admin-page"]);
  }

  gotoReferences(): void {
    this.router.navigate(['/references']);
  }

  gotoSuggestionsPage(): void {
    this.router.navigate(['/suggestions']);
  }

  gotoLoginPage(): void {
    this.router.navigate(['/login']);
  }

  // Layer selection
  layerOptionSelected(option: MatRadioChange): void {
    const selectedLayer = option.value as LayerTypes;
    this.deckOverlayStateService.setCurrentLayer(selectedLayer);
  }

  // Map state management
  updateMapState(loaded: boolean): void {
    this.uiStateService.setMapLoaded(loaded);
    this.mapStateService.setMapLoaded(loaded);
  }

  // Study management
  updateCurrentStudy(study: StudyDTO): void {
    if (!study) return;

    this.mapStateService.setCurrentStudy(study);
    this.uiStateService.openRightPanel();
  }

  updateCurrentStudies(studies: Map<bigint, StudyDTO>): void {
    this.mapStateService.setStudies(studies);
  }

  updateCurrentMarkers(studyId: bigint): void {
    if (!this.mapLoaded()) return;
    this.mapStateService.setFocusedStudy(studyId);
  }

  updateChunkMetadata(chunkInfo: EventMetadata): void {
    this.mapStateService.setEventData(chunkInfo);
  }

  updateStreamState(streamStatus: StreamStatus): void {
    this.mapStateService.setStreamStatus(streamStatus);
  }

  updateControlChanges(change: ControlChange): void {
    this.deckOverlayStateService.applyControlChange(change);
  }

  // Map controls
  setMapTypeGoogle(mapStyle: GoogleMapStyles): void {
    const current = this.currentMapType();

    if ((mapStyle === "roadmap" || mapStyle === "terrain") &&
        (current === "terrain" || current === "roadmap")) {
      return;
    }
    if ((mapStyle === "satellite" || mapStyle === "hybrid") &&
        (current === "hybrid" || current === "satellite")) {
      return;
    }

    this.currentMapType.set(mapStyle);
  }

  setMapTypeCheckbox(event: MatCheckboxChange): void {
    if (event.source.value === "roadmap") {
      this.currentMapType.set(event.checked ? "terrain" : "roadmap");
      return;
    }
    this.currentMapType.set(event.checked ? "hybrid" : "satellite");
  }

  setBaseMap(basemap: BaseMaps): void {
    if (this.activeMap() === basemap) return;

    this.resetGoogleMap();
    this.activeMap.set(basemap);

    // Keep both signals synchronized (only for supported types)
    if (basemap === 'google' || basemap === 'mapbox') {
      this.mapStateService.setMapType(basemap);
    }

    this.mapStateService.setPointsVisible(true);
    this.uiStateService.setMapLoaded(false);
    this.mapStateService.setMapLoaded(false);
  }

  resetGoogleMap(): void {
    this.currentMapType.set("roadmap");
  }

  // Panel controls - now using service methods
  closeRightNav(): void {
    this.uiStateService.closeRightPanel();
  }

  openRightNav(): void {
    this.uiStateService.openRightPanel();
  }

  closeSearchNav(): void {
    this.uiStateService.closeLeftPanel();
  }

  openSearchNav(): void {
    this.uiStateService.openLeftPanel();
  }

  toggleSearchNav(): void {
    this.uiStateService.toggleLeftPanel();
  }

  toggleEventNav(): void {
    this.uiStateService.toggleRightPanel();
  }

  // Marker visibility
  toggleMarkerVisibility(): boolean {
    this.mapStateService.togglePointsVisibility();
    return this.pointsVisible();
  }

  markerToggleLabel(): string {
    return this.pointsVisible() ? "Remove markers" : "Add markers";
  }

  // Template getters for backward compatibility
  get radioGroupValue(): LayerTypes {
    return this.currentLayer();
  }

  set radioGroupValue(value: LayerTypes) {
    this.deckOverlayStateService.setCurrentLayer(value);
  }
}
