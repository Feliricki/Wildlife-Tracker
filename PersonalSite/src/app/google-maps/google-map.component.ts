import { Component, OnInit, OnChanges, SimpleChanges, Input, Output, EventEmitter, WritableSignal, signal, AfterViewInit, OnDestroy, ChangeDetectionStrategy, Injector, inject, Inject } from '@angular/core';
import { distinctUntilChanged, forkJoin, from, Observable, skip, Subscription } from 'rxjs';
import { StudyService } from '../studies/study.service';
import { StudyDTO } from '../studies/study';
import { Loader } from '@googlemaps/js-api-loader';
import { NgIf, AsyncPipe } from '@angular/common';
import { CustomRenderer1 } from './renderers';
import { MarkerClusterer, SuperClusterAlgorithm, SuperClusterOptions } from '@googlemaps/markerclusterer';
import { JsonResponseData } from '../studies/JsonResults/JsonDataResponse';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { NgElement, WithProperties } from '@angular/elements';
import { InfoWindowComponent } from './info-window/info-window.component';
import { GoogleMapOverlayController, LayerTypes, StreamStatus } from '../deckGL/GoogleOverlay';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { HttpResponse } from '@angular/common/http';
import { LineStringFeatureCollection, LineStringPropertiesV1 } from "../deckGL/GeoJsonTypes";
import { EventRequest } from "../studies/EventRequest";
import { MapStyles } from '../tracker-view/tracker-view.component';
import { toObservable } from '@angular/core/rxjs-interop';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import {
  MAT_SNACK_BAR_DATA,
  MatSnackBar,
  MatSnackBarAction,
  MatSnackBarActions,
  MatSnackBarLabel,
  MatSnackBarRef,
} from '@angular/material/snack-bar';
import { EventMetaData } from '../events/EventsMetadata';

type MapState =
  'initial' |
  'loading' |
  'loaded' |
  'error' |
  'rate-limited';

type EventState =
  "initial" |
  "loaded" |
  "loading" |
  "time out" |
  "error";

export type EventResponse = Observable<HttpResponse<LineStringFeatureCollection<LineStringPropertiesV1>[] | null>>;

@Component({
  selector: 'app-google-map',
  templateUrl: './google-map.component.html',
  styleUrls: ['./google-map.component.css'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgIf, AsyncPipe, MatButtonModule, MatProgressBarModule,
    MatIconModule, MatProgressSpinnerModule,
  ]
})
export class MapComponent implements OnInit, AfterViewInit, OnChanges, OnDestroy {
  mainSubscription$?: Subscription;
  mapState: WritableSignal<MapState> = signal('initial');
  eventState: WritableSignal<EventState> = signal("initial");

  @Input() focusedMarker?: bigint;
  @Input() pathEventData$?: EventResponse;
  @Input() eventRequest?: EventRequest;

  // INFO:Map Controls
  @Input() mapType: MapStyles = "roadmap";
  @Input() markersVisible: boolean = true;

  // INFO:Overlay controls
  @Input() selectedLayer: LayerTypes = LayerTypes.ArcLayer;

  @Output() JsonDataEmitter = new EventEmitter<Observable<JsonResponseData[]>>();
  @Output() componentInitialized = new EventEmitter<true>;
  // INFO:This where event info. gets sent to the track and then the events component.
  @Output() eventMetaData = new EventEmitter<EventMetaData>();

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
    radius: 150,
  }

  defaultMarkerOptions: google.maps.MarkerOptions = {
    clickable: true,
  };

  defaultPinOptions: google.maps.marker.PinElementOptions = {
    scale: 1, // default = 1
  }

  defaultInfoWindowOptions: google.maps.InfoWindowOptions = {
  };

  defaultInfoWindowOpenOptions: google.maps.InfoWindowOpenOptions = {
  };

  // this api key is restricted
  loader = new Loader({
    apiKey: "AIzaSyB3YlH9v4TYdeP8Qc3x-HA6jRNYiHJKz1s",
    version: "weekly",
    libraries: ['marker']
  });

  map?: google.maps.Map;
  studies?: Map<bigint, StudyDTO>;

  @Output() studiesEmitter = new EventEmitter<Map<bigint, StudyDTO>>();
  @Output() studyEmitter = new EventEmitter<StudyDTO>();
  @Output() mapStateEmitter = new EventEmitter<boolean>();

  // INFO:Section for changing overlay display options;
  // Decide on a more specific type.
  @Output() chunkInfoEmitter = new EventEmitter<EventMetaData>();
  @Output() streamStatusEmitter = new EventEmitter<StreamStatus>();

  markers: Map<bigint, google.maps.marker.AdvancedMarkerElement> | undefined;
  mapCluster: MarkerClusterer | undefined;

  infoWindow: google.maps.InfoWindow | undefined;

  deckOverlay?: GoogleMapOverlayController;
  streamStatus$?: Observable<StreamStatus>;
  streamStatusSubscription?: Subscription;
  chunkLoadSubscription?: Subscription;

  // NOTE: New event data in some form will come from the events component.
  // lineDataStream: BehaviorSubject<Observable<LineStringSource>>;
  // lineSource: Subscription<>;

  constructor(
    private studyService: StudyService,
    private snackbar: MatSnackBar,
    private injector: Injector) {
    // console.log("Constructing deckOverlayController.");
  }

  ngOnInit(): void {
    return;
  }

  ngAfterViewInit(): void {
    this.componentInitialized.emit(true);
  }

  // NOTE: This method listens to values received from tracker view component
  //  Only new values (actual changes) make it to this method.
  //  Subscribe to the event data message here to handle the map controller
  //  and forbidden responses correctly.
  ngOnChanges(changes: SimpleChanges): void {
    for (const propertyName in changes) {
      const currentValue = changes[propertyName].currentValue;
      if (currentValue === undefined) {
        continue;
      }

      switch (propertyName) {
        // NOTE:Unused
        case "pathEventData$":
          console.log(`Received event observable in google maps component.`);
          this.pathEventData$ = currentValue as EventResponse;
          break;

        // This case sends a message that is received in the event component
        case "focusedMarker":
          console.log(`Panning to ${currentValue}`);
          this.panToMarker(currentValue);
          break;

        case "eventRequest":
          console.log("Received event fetch request in google maps component.");
          this.eventRequest = currentValue as EventRequest;
          this.handleEventRequest(currentValue as EventRequest);
          break;

        // INFO: Map controls section.
        case "mapType":
          console.log(`Changing style into ${currentValue}`);
          this.mapType = currentValue as MapStyles;
          this.map?.setMapTypeId(this.mapType);
          break;

        // BUG:Not all markers get their visiblity toggled
        // Recheck how the markers are instantiated and associated with the map clusterer.
        case "markersVisible":
          this.markersVisible = currentValue as boolean;
          this.toggleMarkerVisibility(this.markersVisible).then(() => console.log("Toggled markers asynchronously."));
          console.log(`markersVisible value = ${this.markersVisible}`);
          break;

        // INFO: Overlay controls sections
        case "selectedLayer":
          this.selectedLayer = currentValue as LayerTypes;
          console.log(`Changing selected layer to ${this.selectedLayer}`);
          this.deckOverlay?.changeActiveLayer(this.selectedLayer);
          break;

        // TODO: Implement this.
        case "overlayOptions":
          break;

        default:
          break;
      }
    }
  }

  ngOnDestroy(): void {
    this.mainSubscription$?.unsubscribe();
    this.streamStatusSubscription?.unsubscribe();
    this.chunkLoadSubscription?.unsubscribe();
  }

  // TODO: this implemention may cause a memory leak if repeatly toggled.
  // Lookup if the documentation has a builtin way to
  // toggle visibility without wasting resources.
  //BUG:Currently adding markers incur a significant performance penalty.
  // Consider storing the marker in an array or otherwise toggle the visibility some other way.
  async toggleMarkerVisibility(visible: boolean): Promise<void> {
    if (!this.mapCluster) return;
    if (!this.markers) return;

    const cluster = this.mapCluster;
    // console.log(this.mapCluster);
    // console.log(`There are ${this.markers?.size ?? 0} elements in markers collection.`);

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
      console.error("Map not set before setting overlay.");
      return;
    }
    this.deckOverlay?.loadData(request);
  }

  coordinateToLatLng(coordinates: GeoJSON.Position): google.maps.LatLng {
    return new google.maps.LatLng(coordinates[0], coordinates[1]);
  }

  sendMapState(loaded: boolean): void {
    this.mapStateEmitter.emit(loaded);
  }

  async initMap(): Promise<boolean> {
    if (this.map !== undefined) {
      return true;
    }

    this.mapState.set('loading');

    const mapRes$ = from(this.loader.importLibrary('maps'));
    const markerRes$ = from(this.loader.importLibrary('marker'));
    const studies$ = this.studyService.getAllStudies();


    this.mainSubscription$ = forkJoin({

      map: mapRes$,
      marker: markerRes$,
      studies: studies$,

    }).subscribe({
      next: (objRes) => {
        this.mapState.set('loading');

        console.log("Successfully loaded google maps markers and map.")
        const mapEl = document.getElementById("map");

        // NOTE:Write a custom controller to prevent excessively flickering.
        this.defaultMapOptions.mapTypeControl = false;
        this.defaultMapOptions.mapTypeControlOptions = {
          style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
          position: google.maps.ControlPosition.TOP_CENTER,
        };

        this.defaultMapOptions.fullscreenControl = true;
        this.defaultMapOptions.fullscreenControlOptions = {
          position: google.maps.ControlPosition.BOTTOM_RIGHT,
        };

        // this.defaultMapOptions.zoomControl = true;
        // this.defaultMapOptions.zoomControlOptions = {
        //   // position: google.maps.ControlPosition.BLOCK_END_INLINE_CENTER,
        //   position: google.maps.ControlPosition.BLOCK_START_INLINE_CENTER
        // }


        // this.defaultMapOptions.streetViewControl = true;
        // this.defaultMapOptions.streetViewControlOptions = {
        //   position: google.maps.ControlPosition.INLINE_START_BLOCK_CENTER,
        // };

        this.map = new google.maps.Map(mapEl as HTMLElement, this.defaultMapOptions);

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

        this.emitStudies(this.studies);
        const markers = new Map<bigint, google.maps.marker.AdvancedMarkerElement>();

        for (const studyDTO of this.studies.values()) {

          if (studyDTO.mainLocationLon === undefined || studyDTO.mainLocationLat === undefined) {
            continue;
          }

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

          // NOTE: This is where the info window logic is handled.
          marker.addListener("click", () => {

            if (this.infoWindow === undefined) {
              return;
            }
            // TODO:Remove this after debugging
            console.log(`Clicked marker with id = ${studyDTO.id} Contained in markers = ${this.markers?.has(studyDTO.id)}`);
            console.log(this.mapCluster);
            // NOTE: If a marker is clicked then close another instance of the info window component
            if (this.infoWindow.get("studyId") !== undefined
              && this.infoWindow.get("studyId") === studyDTO.id
              && this.infoWindow.get("toggle") === true) {
              this.infoWindow.close();
              this.infoWindow.set("toggle", false);
              return;
            }

            // If the same marker is clicked again then toggle the current state of the
            // info window component.
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

          // onClusterClick: (_, cluster, map) => {
          //   // If any cluster is clicked, then the info window is restored to its initial state more or less
          //   // if (this.infoWindow && this.infoWindow.get("toggle") === true) {
          //   //   // console.log("Closing any active info windows.");
          //   //   this.infoWindow.close();
          //   //   this.infoWindow.set("toggle", false);
          //   //   this.infoWindow.set("studyId", -1n);
          //   // }
          //   map.fitBounds(cluster.bounds as google.maps.LatLngBounds);
          // }
        });

        this.initializeDeckOverylay(this.map);
        this.mapState.set('loaded');
        this.sendMapState(true);
      },
      error: err => console.error(err)
    });
    return true;
  }


  initializeDeckOverylay(map: google.maps.Map) {
    this.deckOverlay = new GoogleMapOverlayController(map, this.selectedLayer);
    this.streamStatus$ = toObservable(this.deckOverlay.StreamStatus, {
      injector: this.injector
    });

    const onChunkLoad$ = toObservable(this.deckOverlay.currentMetaData,
      { injector: this.injector });

    // TODO: This subcription responses to emitted chunks from the deck overlay class.
    onChunkLoad$.pipe(
      skip(1), // NOTE: A skip will result in the first loaded chunk being seen.
    ).
      subscribe({
        next: res => {
          this.emitChunkData(res);
        },
        error: err => console.error(err),
      });

    // TODO: This subscription will response to the latest stream status of the signalr
    // client.
    this.streamStatusSubscription = this.streamStatus$.pipe(
      skip(1),
      distinctUntilChanged()
    ).subscribe({
      next: (status: StreamStatus) => {
        // TODO: Finish this method and also remove the snack bar button.
        // The toolbar in the tracker component should be a separate component.
        // const numIndividuals = this.deckOverlay?.NumberofIndividuals() ?? 0;
        const numIndividuals = this.deckOverlay?.CurrentIndividuals().size ?? 0;
        switch (status) {
          case "standby":
            console.log("Google Maps Component: Instantiating signalr client or finished streaming events from a data source.");
            this.emitStreamStatus("standby");
            if (numIndividuals === 0) {
              this.openSnackBar("No Events Found.");
              break;
            }
            this.openSnackBar(`Events found for ${numIndividuals} animal(s).`);
            break;

          case "error":
            console.log("Google Map Component Overlay Status: Error");
            this.emitStreamStatus("error");
            this.openSnackBar("Error retrieving events.");
            break;

          case "streaming":
            console.log("Google Map Component Overlay Status: Streaming");
            this.emitStreamStatus("streaming");
            break;

          default:
            return;
        }
      },
      error: err => console.error(err)
    });
  }

  openSnackBar(message: string, timeLimit: number = 2) {
    this.snackbar.openFromComponent(GoogleMapsSnackbarComponent, { duration: timeLimit * 1000, data: message });
  }

  // NOTE: This function serves to create a dynamic button element every time the info window is opened
  // On button click an event is emitted that makes send jsonData to the event component
  buildInfoWindowContent(studyDTO: StudyDTO): HTMLElement {
    const infoWindowEl = document.createElement('info-window-el') as NgElement & WithProperties<InfoWindowComponent>;
    infoWindowEl.currentStudy = studyDTO;
    infoWindowEl.eventRequest = this.studyEmitter;

    return infoWindowEl;
  }

  getJsonData(entityType: "study" | "individual" | "tag", studyId: bigint): Observable<JsonResponseData[]> {
    return this.studyService.jsonRequest(entityType, studyId);
  }

  //NOTE:The focusedMarker needs to be set before calling this function.
  panToCurrentMarker() {
    if (this.focusedMarker === undefined) return;
    this.panToMarker(this.focusedMarker);
  }

  // NOTE: This function only affects the map component
  panToMarker(studyId: bigint): void {
    // console.log("Calling panToMarker in google maps component.");
    const curMarker = this.markers?.get(studyId);
    if (curMarker === undefined || this.infoWindow === undefined) {
      return;
    }
    const markerPos = curMarker.position;

    if (!markerPos) {
      return;
    }
    this.map?.panTo(markerPos);
    this.map?.setZoom(10);
    google.maps.event.trigger(curMarker, "click");
  }


  // INFO: This message is received in the event component.
  emitStudy(study: StudyDTO): void {
    this.studyEmitter.emit(study);
  }

  emitStudies(studies: Map<bigint, StudyDTO>): void {
    this.studiesEmitter.emit(studies);
  }

  emitChunkData(chunkInfo: EventMetaData): void {
    this.chunkInfoEmitter.emit(chunkInfo);
  }

  emitStreamStatus(streamStatus: StreamStatus): void {
    this.streamStatusEmitter.emit(streamStatus);
  }
}

@Component({
  selector: "app-google-maps-snackbar",
  template:
    `<span class="snackbar-label" matSnackBarLabel>
      {{data}}
    </span>
    <span class="dense-2" matSnackBarActions>
      <button mat-button matSnackBarAction (click)="snackBarRef.dismissWithAction()">Dismiss</button>
    </span>`,

  styles: [`
    :host {
      display: flex;
    }
    .snackbar-label {
      /* background-color: white; */
      /* color: white; */
    }
    span {
      /* color: white; */
    }
  `],
  standalone: true,
  imports: [MatButtonModule, MatSnackBarLabel, MatSnackBarActions, MatSnackBarAction]
})
export class GoogleMapsSnackbarComponent {
  snackBarRef = inject(MatSnackBarRef);
  constructor(@Inject(MAT_SNACK_BAR_DATA) public data: string) { }
}
