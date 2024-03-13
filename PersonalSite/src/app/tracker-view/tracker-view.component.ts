import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, ViewChild, WritableSignal, signal } from '@angular/core';
import { MapComponent } from '../base-maps/google maps/google-map.component';
import { SimpleSearchComponent } from '../simple-search/simple-search.component';
import { MatSidenav, MatSidenavModule } from '@angular/material/sidenav';
import { MatButtonModule } from '@angular/material/button';
import { EventsComponent } from '../events/events.component';
import { StudyDTO } from '../studies/study';
import { EventJsonDTO } from '../studies/JsonResults/EventJsonDTO';
import { MatIconModule } from '@angular/material/icon';
import { animate, style, transition, trigger, state } from '@angular/animations';
import { BreakpointObserver, BreakpointState, Breakpoints } from '@angular/cdk/layout';
import { Observable, firstValueFrom, map, tap } from 'rxjs';
import { HttpResponse } from '@angular/common/http';
import { LineStringFeatureCollection, LineStringPropertiesV1 } from "../deckGL/GeoJsonTypes";
import { EventRequest } from "../studies/EventRequest";
import { NgStyle, AsyncPipe } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { MatChipsModule } from '@angular/material/chips';
import { MatCheckboxChange, MatCheckboxModule } from '@angular/material/checkbox';
import { LayerTypes, StreamStatus } from '../deckGL/DeckOverlayController';
import { MatRippleModule } from '@angular/material/core';
import { EventMetaData } from '../events/EventsMetadata';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatRadioChange, MatRadioModule } from '@angular/material/radio';
import { FormsModule } from '@angular/forms';
import { MapboxComponent } from '../base-maps/mapbox/mapbox.component';

export type MapStyles =
  "roadmap" | "terrain" | "hybrid" | "satellite";

type BaseMaps = 'google' | 'mapbox' | 'arcgis';

@Component({
  selector: 'app-tracker-view',
  templateUrl: './tracker-view.component.html',
  styleUrls: ['./tracker-view.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    EventsComponent,
    MapboxComponent,
    MatSidenavModule,
    MatButtonModule,
    SimpleSearchComponent,
    MapComponent,
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

      state('true', style({ left: 'calc(400px - 2em)' })),
      state('false', style({ left: '0px' })),

      // INFO:Animation used on the toggling button for the left sidenav.
      transition('true => false', [
        animate('300ms cubic-bezier(0, 0, 0, 1)', style({ transform: 'translate(calc(-400px + 2em))' })),
      ]),

      // NOTE:This transition is used when opening the left sidenav.
      // Uses standard easing according to material design specs`
      // old cubic-bezier value is cubic-bezier(0.2, 0, 0, 1)
      transition('false => true', [
        animate('325ms cubic-bezier(0, 0, 0, 1)', style({ transform: 'translate(calc(400px - 2em))' })),
      ]),

    ]),
  ]
})
export class TrackerViewComponent implements OnInit, OnDestroy {
  options = {
    fixed: true,
    bottom: 0,
    top: 0
  };

  // TODO:Consider adding arcgis as a basemap.
  // activeMap: 'google' | 'mapbox' = 'google';
  activeMap: WritableSignal<BaseMaps> = signal('google');

  mapLoaded: WritableSignal<boolean> = signal(false);
  searchOpened: WritableSignal<boolean> = signal(false);


  // NOTE:This is currently unused
  currentEventLineData$?:
    Observable<HttpResponse<LineStringFeatureCollection<LineStringPropertiesV1>[] | null>>;
  currentEventRequest?: EventRequest;

  currentMarker?: bigint;
  currentStudies?: Map<bigint, StudyDTO>;

  // This determines the currrent layer for google maps.
  currentMapType: MapStyles = "roadmap";

  currentLayer: WritableSignal<LayerTypes> = signal(LayerTypes.ArcLayer);

  displayedEvents?: EventJsonDTO[];

  currentStudy?: StudyDTO;
  studyEventMessage?: StudyDTO;

  currentChunkInfo?: EventMetaData;
  currentStreamStatus?: StreamStatus;

  @ViewChild('sidenav', { static: true }) sidenav!: MatSidenav;
  @ViewChild('rightSidenav', { static: true }) rightNav!: MatSidenav;
  @ViewChild('eventComponent') event!: EventsComponent;

  leftButtonFlag: WritableSignal<boolean> = signal(false);
  rightButtonFlag: WritableSignal<boolean> = signal(true);

  leftPanelOpened: WritableSignal<boolean> = signal(true);

  radioGroupInitialized: WritableSignal<boolean> = signal(false);
  markersVisible: WritableSignal<boolean> = signal(true);
  // INFO:The following are dynamic styling which
  // changes depending on the current screen size.
  leftNavSmallStyle = {
    "min-width": "100px",
    "max-width": "400px",
    "width": "100%",
  }

  leftNavLargeStyle = {
    "width": "400px",
  }

  smallScreen$?: Observable<boolean>;
  XSmallScreen$?: Observable<boolean>;

  // NOTE:An ngModel binding in order to set a default value for the radio group.
  radioGroupValue: LayerTypes = LayerTypes.ArcLayer;
  readonly layerMenuOptions = [
    ["Arc Layer", LayerTypes.ArcLayer],
    ["Line Layer", LayerTypes.LineLayer],
    // ["Path Layer", LayerTypes.PathLayer], // Having both the line and path layer is redundant.
    ["Hexagon Layer", LayerTypes.HexagonLayer],
    ["Scatterplot Layer", LayerTypes.ScatterplotLayer],
    ["Screen Grid Layer", LayerTypes.ScreenGridLayer],
    ["Grid Layer", LayerTypes.GridLayer],
    // INFO:Currrently the heatmap layer uses the cpu for aggregation causing lag
    // ["Heatmap Layer", LayerTypes.HeatmapLayer],
  ] as Array<[string, LayerTypes]>;

  constructor(private breakpointObserver: BreakpointObserver) { }

  // TODO:
  // 1) Fix the event forms. Or rewrite them scratch if its not possible to resize the input elements.
  // 2) Rework the UI more.
  // 3) Look up how to set multiple docker containers for deployment.
  ngOnInit(): void {
    const breakpointObserver = this.breakpointObserver
      .observe([Breakpoints.XSmall, Breakpoints.Small]).pipe(
        map((state: BreakpointState) => {
          return state.matches;
        }),
      );

    // INFO:Close the search component on smaller screens.
    firstValueFrom(breakpointObserver).then(value => {
      if (value) {
        this.closeSearchNav();
        this.leftPanelOpened.set(false);
      }
    });

    this.smallScreen$ = this.breakpointObserver
      .observe([Breakpoints.XSmall, Breakpoints.Small]).pipe(
        map((state: BreakpointState) => state.matches),
      );

    this.XSmallScreen$ = this.breakpointObserver
      .observe([Breakpoints.XSmall]).pipe(
        map((state: BreakpointState) => state.matches),
        tap(value => console.log(`Current state ${value} in track view component.`)),
      );

  }

  ngOnDestroy(): void {
    return;
  }

  loadMap(): void {
    if (this.mapLoaded()) return;

    switch (this.activeMap()) {
      case "google":
        break;

      default:
        return;
    }
  }

  layerOptionSelected(option: MatRadioChange) {
    const selectedLayer = option.value as LayerTypes;
    this.selectedLayer(selectedLayer);
  }
  // INFO:Overlay controls.
  selectedLayer(layer: LayerTypes) {
    //TODO:Perhaps another value should be emitted to reset the currentValue in the recieving component.
    // this.currentLayer.set(undefined);
    this.currentLayer.set(layer);
  }

  // INFO:Map and component state.
  updateMapState(state: boolean): void {
    console.log(`Setting map loaded state to ${state}`);
    this.mapLoaded.set(state);
  }

  initializeSearchNav(): void {
    this.searchOpened.set(true);
  }

  // INFO:Events messages from the google maps component.
  updateLineStringData(
    event: Observable<HttpResponse<LineStringFeatureCollection<LineStringPropertiesV1>[] | null>>): void {
    this.currentEventLineData$ = event;
  }

  updateCurrentEventRequest(request: EventRequest): void {
    console.log("Updating the fetch request in tracker view");
    this.currentEventRequest = request;
  }

  updateCurrentStudy(study: StudyDTO): void {
    if (study === undefined) {
      return;
    }
    this.openRightNav();
    this.currentStudy = study;
  }

  // NOTE: This message comes from the google maps component and is received in the search component
  // for it's autocomplete feature.
  updateCurrentStudies(studies: Map<bigint, StudyDTO>): void {
    this.currentStudies = studies;
  }

  updateCurrentMarkers(studyId: bigint): void {
    if (!this.mapLoaded()) {
      return;
    }
    this.currentMarker = studyId;
  }

  updateChunkMetadata(chunkInfo: EventMetaData) {
    // console.log(chunkInfo);
    this.currentChunkInfo = chunkInfo;
  }

  updateStreamState(streamStatus: StreamStatus) {
    this.currentStreamStatus = streamStatus;
  }

  // INFO: Map Controls
  setMapTypeGoogle(mapStyle: MapStyles) {
    if ((mapStyle === "roadmap" || mapStyle == "terrain") && (this.currentMapType == "terrain" || this.currentMapType == "roadmap")) {
      return;
    }
    if ((mapStyle === "satellite" || mapStyle === "hybrid") && (this.currentMapType === "hybrid" || this.currentMapType === "satellite")) {
      return;
    }
    this.currentMapType = mapStyle;
  }

  setMapTypeCheckbox(event: MatCheckboxChange) {
    if (event.source.value === "roadmap") {
      this.currentMapType = event.checked ? "terrain" : "roadmap";
      return;
    }
    this.currentMapType = event.checked ? "hybrid" : "satellite";
  }

  setBaseMap(basemap: BaseMaps): void {
    if (this.activeMap() === basemap) return;
    this.resetGoogleMap();
    this.activeMap.set(basemap);
    // NOTE:Certain other flags such as the rightButtonFlag and leftButtonFlag will need
    // to be looked at again to check if they do not break.
    this.mapLoaded.set(false);
  }

  resetGoogleMap(): void {
    this.currentMapType = "roadmap";
  }

  // INFO: Left and right sidenav controls.

  closeRightNav(): void {
    this.rightNav.close();
    this.rightButtonFlag.set(true);
  }

  openRightNav(): void {
    if (this.rightNav.opened) {
      return;
    }
    this.rightNav.open().then(() => {
      this.rightButtonFlag.set(false);
    });
  }

  closeSearchNav(): void {
    this.sidenav.close();
    this.leftButtonFlag.set(true);
    this.leftPanelOpened.set(false);
  }

  openSearchNav(): void {
    this.leftPanelOpened.set(true);
    this.sidenav.open().then(() => {
      this.leftButtonFlag.set(false);
    });
  }

  toggleSearchNav(): void {
    if (this.leftPanelOpened()) {
      this.closeSearchNav();
    } else {
      this.openSearchNav();
    }
  }

  toggleMarkerVisibility(): boolean {
    this.markersVisible.update(prev => !prev);
    return this.markersVisible();
  }

  markerToggleLabel(): string {
    if (this.markersVisible()) {
      return "Remove markers.";
    } else {
      return "Add markers.";
    }
  }

}
