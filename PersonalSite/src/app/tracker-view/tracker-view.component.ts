import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, ViewChild, WritableSignal, signal } from '@angular/core';
import { MapComponent } from '../google-maps/google-map.component';
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
import { LayerTypes, StreamStatus } from '../deckGL/GoogleOverlay';
import { MatRippleModule } from '@angular/material/core';
import { EventMetaData } from '../events/EventsMetadata';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatRadioModule } from '@angular/material/radio';

export type MapStyles =
  "roadmap" | "terrain" | "hybrid" | "satellite";

@Component({
  selector: 'app-tracker-view',
  templateUrl: './tracker-view.component.html',
  styleUrls: ['./tracker-view.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    EventsComponent,
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
      state('false', style( { left: '0px' } )),

      // TODO:The closing speed needs to be adjusted.
      transition('true => false', [
        animate('250ms', style({ transform: 'translate(-400px)' })),
      ]),

      transition('false => true', [
        animate('250ms', style({ transform: 'translate(calc(400px - 2em))' })),
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

  activeMap: 'google' | 'mapbox' = 'google';

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

  readonly layerMenuOptions = [
    ["Arc Layer", LayerTypes.ArcLayer],
    ["Line Layer", LayerTypes.LineLayer],
    // ["Path Layer", LayerTypes.PathLayer], // Having both the line and path layer is redundant.
    ["Hexagon Layer", LayerTypes.HexagonLayer],
    ["Scatterplot Layer", LayerTypes.ScatterplotLayer],
    ["Screen Grid Layer", LayerTypes.ScreenGridLayer],
    ["Grid Layer", LayerTypes.GridLayer],
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
    if (this.mapLoaded()) {
      return;
    }
    switch (this.activeMap) {
      case "google":
        break;

      default:
        return;
    }
  }

  // INFO:Overlay controls.
  selectedLayer(layer: LayerTypes) {
    this.currentLayer.set(layer);
  }

  // INFO:Map and component state.
  updateMapState(state: boolean): void {
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
    console.log("Tracker Component: Current chunk info  is ");
    console.log(chunkInfo);
    this.currentChunkInfo = chunkInfo;
  }

  updateStreamState(streamStatus: StreamStatus) {
    this.currentStreamStatus = streamStatus;
  }

  // INFO: Map Controls
  setMapType(mapStyle: MapStyles) {
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
    if (this.leftPanelOpened()){
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
