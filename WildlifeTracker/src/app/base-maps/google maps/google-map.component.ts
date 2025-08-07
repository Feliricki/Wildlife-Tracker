import { Component, AfterViewInit, ChangeDetectionStrategy, Injector, inject, signal, DestroyRef } from '@angular/core';
import { distinctUntilChanged, forkJoin, from, Observable, skip } from 'rxjs';
import { StudyService } from '../../studies/study.service';
import { StudyDTO } from '../../studies/study';
import { Loader } from '@googlemaps/js-api-loader';

import { CustomRenderer1 } from './renderers';
import { MarkerClusterer, SuperClusterAlgorithm, SuperClusterOptions } from '@googlemaps/markerclusterer';
import { JsonResponseData } from '../../studies/JsonResults/JsonDataResponse';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { NgElement, WithProperties } from '@angular/elements';
import { InfoWindowComponent } from './info-window/info-window.component';
import { DeckOverlayController, StreamStatus } from '../../deckGL/DeckOverlayController';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { EventRequest } from "../../studies/EventRequest";
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SnackbarComponent } from '../snackbar.component';

// Import the new services
import { UIStateService } from '../../services/ui-state.service';
import { MapStateService } from '../../services/map-state.service';
import { DeckOverlayStateService } from '../../services/deck-overlay-state.service';

type MapState =
  'initial' |
  'loading' |
  'loaded' |
  'error' |
  'rate-limited';

@Component({
    selector: 'app-google-map',
    templateUrl: './google-map.component.html',
    styleUrls: ['./google-map.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        MatButtonModule, MatProgressBarModule,
        MatIconModule, MatProgressSpinnerModule,
    ]
})
export class GoogleMapViewComponent implements  AfterViewInit {
  // Inject services
  private readonly uiStateService = inject(UIStateService);
  private readonly mapStateService = inject(MapStateService);
  private readonly deckOverlayStateService = inject(DeckOverlayStateService);
  private readonly studyService = inject(StudyService);
  private readonly snackbar = inject(MatSnackBar);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);

  mapState = signal<MapState>('initial');

  defaultMapOptions: google.maps.MapOptions = {
    center: {
      lat: 40,
      lng: -100,
    },
    zoom: 4,
    tilt: 30,
    mapId: "ccfbcc384aa699ff", // Vector map
    gestureHandling: "auto", // This needs to be set manually.
  };

  defaultAlgorithmOptions: SuperClusterOptions = {
    radius: 160,
  }

  // this api key is restricted
  loader = new Loader({
    apiKey: "AIzaSyB3YlH9v4TYdeP8Qc3x-HA6jRNYiHJKz1s",
    version: "weekly",
    libraries: ['marker']
  });

  map?: google.maps.Map;
  studies?: Map<bigint, StudyDTO>;
  markers: Map<bigint, google.maps.marker.AdvancedMarkerElement> | undefined;
  mapCluster: MarkerClusterer | undefined;
  infoWindow: google.maps.InfoWindow | undefined;
  deckOverlay?: DeckOverlayController;

  constructor() {

    this.mapStateService.focusedStudyId$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: studyId => {
          if (studyId){
            this.panToMarker(studyId);
          }
        }
      })

    // Subscribe to map type changes
    this.mapStateService.mapStyleGoogle$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(mapType => {
        this.map?.setMapTypeId(mapType);
      });

    // Subscribe to marker visibility changes
    this.mapStateService.pointsVisible$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(visible => {
        this.toggleMarkerVisibility(visible);
      });

    // Subscribe to layer changes
    this.deckOverlayStateService.currentLayer$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(layer => {
        this.deckOverlay?.changeActiveLayer(layer);
      });

    // Subscribe to control changes
    // { change: ColorChange | NumberChange | StringChange | BooleanChange, field: string, formType: ActiveForm }
    this.deckOverlayStateService.controlChange$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(change => {
        if (change) {
          this.deckOverlay?.setLayerAttributes(change);
        }
      });

    this.deckOverlayStateService.eventRequest$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(request => {
        if (request && this.mapStateService.mapType() === 'google'){
          this.handleEventRequest(request);
        }
      });
  }

  ngAfterViewInit(): void {
    // Initialize map after view is ready
    this.initMap();
  }

  async toggleMarkerVisibility(visible: boolean): Promise<void> {
    if (!this.mapCluster || !this.markers) return;

    const cluster = this.mapCluster;
    const currentMarkers: google.maps.marker.AdvancedMarkerElement[] = [];

    for await (const marker of this.markers.values()) {
      marker.map = visible ? this.map : undefined;
      currentMarkers.push(marker);
    }

    if (!visible) {
      cluster.clearMarkers();
    } else {
      this.mapCluster = new MarkerClusterer({
        map: this.map,
        markers: currentMarkers,
        renderer: new CustomRenderer1(),
        algorithm: new SuperClusterAlgorithm(this.defaultAlgorithmOptions),
      });
    }
  }

  handleEventRequest(request: EventRequest) {
    if (!this.map) {
      console.error("Map not set before handling event request.");
      return;
    }
    if (!this.deckOverlay) {
      console.error("DeckOverlay not instantiated before calling loadData method.");
      return;
    }
    this.deckOverlay.loadData(request, { type: "google", map: this.map });
  }

  async initMap(): Promise<boolean> {
    if (this.map !== undefined) {
      return true;
    }

    this.mapState.set('loading');

    const mapRes$ = from(this.loader.importLibrary('maps'));
    const markerRes$ = from(this.loader.importLibrary('marker'));
    const studies$ = this.studyService.getAllStudies();

    forkJoin({
      map: mapRes$,
      marker: markerRes$,
      studies: studies$,
    })
    .pipe(takeUntilDestroyed(this.destroyRef))
    .subscribe({
      next: (objRes) => {
        this.mapState.set('loading');

        console.log("Successfully loaded google maps markers and map.")
        const mapEl = document.getElementById("map");

        this.defaultMapOptions.mapTypeControl = false;
        this.defaultMapOptions.mapTypeControlOptions = {
          style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
          position: google.maps.ControlPosition.TOP_CENTER,
        };

        this.defaultMapOptions.fullscreenControl = true;
        this.defaultMapOptions.fullscreenControlOptions = {
          position: google.maps.ControlPosition.BOTTOM_RIGHT,
        };

        this.map = new google.maps.Map(mapEl as HTMLElement, this.defaultMapOptions);
        this.map.controls[google.maps.ControlPosition.LEFT_BOTTOM].push(this.hintControl());
        this.infoWindow = new google.maps.InfoWindow({
          disableAutoPan: true,
        });

        this.infoWindow.set("toggle", false);
        this.infoWindow.set("studyId", -1n);

        const studyDTOs = objRes.studies;
        const mappings = new Map<bigint, StudyDTO>();
        studyDTOs.forEach(studyDTO => {
          mappings.set(studyDTO.id, studyDTO);
        });
        this.studies = mappings;

        // Use service instead of emitting
        this.mapStateService.setStudies(this.studies);

        const markers = new Map<bigint, google.maps.marker.AdvancedMarkerElement>();
        const coordinates = new Set<string>();

        for (const studyDTO of this.studies.values()) {
          if (studyDTO.mainLocationLon === undefined || studyDTO.mainLocationLat === undefined) {
            continue;
          }

          // Prevent markers from overlapping too much
          let key = `${studyDTO.mainLocationLon.toString()},${studyDTO.mainLocationLat.toString()}`;
          while (coordinates.has(key)) {
            studyDTO.mainLocationLon += 0.002;
            key = `${studyDTO.mainLocationLon.toString()},${studyDTO.mainLocationLat.toString()}`;
          }
          coordinates.add(key);

          const imageIcon = document.createElement('img');
          imageIcon.src = '../../assets/location-pin2-small.png';

          const marker = new google.maps.marker.AdvancedMarkerElement({
            map: this.map,
            content: imageIcon,
            position: {
              lat: studyDTO.mainLocationLat,
              lng: studyDTO.mainLocationLon
            },
            title: studyDTO.name,
          });

          marker.addListener("click", () => {
            if (this.infoWindow === undefined) {
              return;
            }

            if (this.infoWindow.get("studyId") !== undefined
                && this.infoWindow.get("studyId") === studyDTO.id
                && this.infoWindow.get("toggle") === true) {
              this.infoWindow.close();
              this.infoWindow.set("toggle", false);
              return;
            }

            this.infoWindow.close();
            this.infoWindow.setContent(this.buildInfoWindowContent(studyDTO));
            this.infoWindow.set("toggle", !this.infoWindow.get("toggle"));
            this.infoWindow.set("studyId", studyDTO.id);
            this.infoWindow.open(this.map, marker);
          });

          markers.set(studyDTO.id, marker);
        }

        this.markers = markers;
        this.mapCluster = new MarkerClusterer({
          map: this.map,
          markers: Array.from(markers.values()),
          renderer: new CustomRenderer1(),
          algorithm: new SuperClusterAlgorithm(this.defaultAlgorithmOptions),
        });

        this.initializeDeckOverlay(this.map);
        this.mapState.set('loaded');

        // Use service instead of emitting
        this.uiStateService.setMapLoaded(true);
        this.mapStateService.setMapLoaded(true);
      },
      error: err => {
        console.error(err);
        this.mapState.set('error');
      }
    });

    return true;
  }

  hintControl(): HTMLButtonElement {
    const button = document.createElement('button');
    button.textContent = "Hold shift to rotate";
    return button;
  }

  initializeDeckOverlay(map: google.maps.Map) {
    this.deckOverlay = new DeckOverlayController(map, this.deckOverlayStateService.currentLayer());

    const streamStatus$ = toObservable(this.deckOverlay.StreamStatus, {
      injector: this.injector
    });

    const onChunkLoad$ = toObservable(this.deckOverlay.currentMetaData, {
      injector: this.injector
    });

    // Subscribe to chunk loading
    onChunkLoad$.pipe(
      skip(1),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: chunk => this.mapStateService.setEventData(chunk),
      error: err => console.error(err),
    });

    // Subscribe to stream status changes
    streamStatus$.pipe(
      skip(1),
      distinctUntilChanged(),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (status: StreamStatus) => {
        const numIndividuals = this.deckOverlay?.CurrentIndividuals().size ?? 0;

        switch (status) {
          case "standby":
            this.mapStateService.setStreamStatus("standby");
            if (numIndividuals === 0) {
              this.openSnackBar("No Events Found.");
              break;
            }
            this.openSnackBar(`Events found for ${numIndividuals} animal(s).`);
            break;

          case "error":
            this.mapStateService.setStreamStatus("error");
            this.openSnackBar("Error retrieving events.");
            break;

          case "streaming":
            this.mapStateService.setStreamStatus("streaming");
            break;

          default:
            return;
        }
      },
      error: err => console.error(err)
    });
  }

  openSnackBar(message: string, timeLimit: number = 2) {
    this.snackbar.openFromComponent(SnackbarComponent, {
      duration: timeLimit * 1000,
      data: message
    });
  }

  buildInfoWindowContent(studyDTO: StudyDTO): HTMLElement {
    const infoWindowEl = document.createElement('info-window-el') as NgElement & WithProperties<InfoWindowComponent>;
    infoWindowEl.currentStudy = studyDTO;
    infoWindowEl.mapStateService = this.mapStateService;
    return infoWindowEl;
  }

  getJsonData(entityType: "study" | "individual" | "tag", studyId: bigint): Observable<JsonResponseData[]> {
    return this.studyService.jsonRequest(entityType, studyId);
  }

  panToMarker(studyId: bigint): void {
    const curMarker = this.markers?.get(studyId);
    if (!curMarker || !this.infoWindow || !this.map) return;

    const markerPos = curMarker.position;
    if (!markerPos) return;

    this.map.panTo(markerPos);
    this.map.setZoom(10);
    google.maps.event.trigger(curMarker, "click");
  }
}
