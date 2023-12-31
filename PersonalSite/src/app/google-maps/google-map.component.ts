import { Component, OnInit, OnChanges, SimpleChanges, Input, Output, EventEmitter, WritableSignal, signal, AfterViewInit, OnDestroy } from '@angular/core';
import { forkJoin, from, Observable, Subscription } from 'rxjs';
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
import { GoogleMapOverlayController, LineStringFeatureCollection } from '../deckGL/GoogleOverlay';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { HttpResponse, HttpStatusCode, HttpErrorResponse } from '@angular/common/http';

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

export type EventResponse = Observable<HttpResponse<LineStringFeatureCollection[] | null>>;

@Component({
  selector: 'app-google-map',
  templateUrl: './google-map.component.html',
  styleUrls: ['./google-map.component.css'],
  standalone: true,
  imports: [
    NgIf, AsyncPipe, MatButtonModule,
    MatIconModule, MatProgressSpinnerModule]
})
export class MapComponent implements OnInit, AfterViewInit, OnChanges, OnDestroy {
  mainSubscription$?: Subscription;
  mapState: WritableSignal<MapState> = signal('initial');
  eventState: WritableSignal<EventState> = signal("initial");

  @Input() focusedMarker?: bigint;
  @Input() pathEventData$?: EventResponse;
  @Input() lineStringRequest?: Request;

  @Output() JsonDataEmitter = new EventEmitter<Observable<JsonResponseData[]>>();
  @Output() componentInitialized = new EventEmitter<true>;

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

  map: google.maps.Map | undefined;
  // @ViewChild(google.maps.Map)
  studies?: Map<bigint, StudyDTO>;

  @Output() studiesEmitter = new EventEmitter<Map<bigint, StudyDTO>>();
  @Output() studyEmitter = new EventEmitter<StudyDTO>();
  @Output() mapStateEmitter = new EventEmitter<boolean>();

  markers: Map<bigint, google.maps.marker.AdvancedMarkerElement> | undefined;
  mapCluster: MarkerClusterer | undefined;

  infoWindow: google.maps.InfoWindow | undefined;

  deckOverlay?: GoogleMapOverlayController;

  // NOTE: New event data in some form will come from the events component.
  // lineDataStream: BehaviorSubject<Observable<LineStringSource>>;
  // lineSource: Subscription<>;

  constructor(
    private studyService: StudyService) {
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
  //  and forbiden responses correctly.
  ngOnChanges(changes: SimpleChanges): void {
    for (const propertyName in changes) {
      const currentValue = changes[propertyName].currentValue;

      if (currentValue === undefined) {
        continue;
      }

      switch (propertyName) {
        // This case sends a message that is received in the event component
        case "focusedMarker":
          console.log(`Panning to ${currentValue}`);
          this.panToMarker(currentValue);
          break;

        // TODO: The backend needs to be changed to use CSV responses.
        // Event data to be returned here in LineFeatureCollection format
        case "pathEventData$":
          console.log(`Received event observable in google maps component.`);
          this.pathEventData$ = currentValue as EventResponse;
          // this.handleEventData(this.pathEventData$);

          break;
        case "lineStringRequest":
          console.log("Recieved event fetch request in google maps component.");
          this.lineStringRequest = currentValue as Request;
          this.handleEventRequest(currentValue as Request);
          break;

        default:
          break;
      }
    }
  }

  handleEventRequest(request: Request){
    // this.eventState.set("loading");
    this.deckOverlay?.addArcLayerUrl(request);
  }

  // TODO: Consider handling the raw httpResponse or a flag to indicate.
  handleEventData(event$: EventResponse) {

    // this.deckOverlay?.addArcLayerUrl();
    this.eventState.set("loading");
    event$.pipe(
    ).subscribe({

      next: response => {
        const collection = response.body;
        switch (response.status) {
          // Error responses need to be handle in the catch error function.
          case HttpStatusCode.InternalServerError:
            console.log("Server error while retrieving events.");
            break;

          case HttpStatusCode.Forbidden:
            console.log("Access is forbidden for event data.");
            break;

          case HttpStatusCode.Ok:
            if (collection === null || collection.length === 0) {
              console.log(`No events found. collection === null = ${collection === null}`);
              return;
            }
            this.deckOverlay?.setLineData(collection);
            this.eventState.set("loaded");
            break;

          default:
            console.log("Reached default case in response handler.");
            console.log(collection);
            break;
        }
      }, error: (err: HttpErrorResponse | Error) => {
        // TODO: This response handling needs to be tested with timeout and httpresponse errors.
        console.log(typeof err);
        console.error(err);
        this.eventState.set("error");
      },
    });
  }

  coordinateToLatLng(coordinates: GeoJSON.Position): google.maps.LatLng {
    return new google.maps.LatLng(coordinates[0], coordinates[1]);
  }

  ngOnDestroy(): void {
    this.mainSubscription$?.unsubscribe();
  }

  sendMapState(loaded: boolean): void {
    this.mapStateEmitter.emit(loaded);
  }

  async initMap(): Promise<boolean> {
    if (this.map !== undefined) {
      return true;
    }

    this.mapState.set('loading');
    // TODO: Consider loading the neded components only. Refactor is potentially needed to ensure optimal performance.
    const mapRes$ = from(this.loader.importLibrary('maps'));
    const markerRes$ = from(this.loader.importLibrary('marker'));
    const studies$ = this.studyService.getAllStudies();


    this.mainSubscription$ = forkJoin({

      map: mapRes$,
      marker: markerRes$,
      studies: studies$,

    }).subscribe({

      next: (objRes) => {

        console.log("Successfully loaded google maps markers and map.")
        const mapEl = document.getElementById("map");

        // NOTE: Set control positions.
        this.defaultMapOptions.mapTypeControl = true;
        this.defaultMapOptions.mapTypeControlOptions = {
          style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
          position: google.maps.ControlPosition.BLOCK_START_INLINE_CENTER,
        };

        this.defaultMapOptions.fullscreenControl = true;
        this.defaultMapOptions.fullscreenControlOptions = {
          position: google.maps.ControlPosition.BLOCK_START_INLINE_CENTER,
        };

        this.defaultMapOptions.zoomControl = true;
        this.defaultMapOptions.zoomControlOptions = {
          // position: google.maps.ControlPosition.BLOCK_END_INLINE_CENTER,
          position: google.maps.ControlPosition.BLOCK_START_INLINE_CENTER
        }


        this.defaultMapOptions.streetViewControl = true;
        this.defaultMapOptions.streetViewControlOptions = {
          position: google.maps.ControlPosition.INLINE_START_BLOCK_CENTER,
        };

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

        this.deckOverlay = new GoogleMapOverlayController(this.map);
        this.mapState.set('loaded');
        this.sendMapState(true);
      },
      error: err => console.error(err)
    });
    return true;
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

}
