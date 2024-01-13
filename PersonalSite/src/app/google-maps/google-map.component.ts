import { Component, OnInit, OnChanges, SimpleChanges, Input, Output, EventEmitter, WritableSignal, signal, AfterViewInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
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
import { GoogleMapOverlayController } from '../deckGL/GoogleOverlay';
// import { LineStringFeatureCollection } from ''
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { HttpResponse } from '@angular/common/http';
import {LineStringFeatureCollection, LineStringPropertiesV1 } from "../deckGL/GeoJsonTypes";
import {EventRequest} from "../studies/EventRequest";

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
    NgIf, AsyncPipe, MatButtonModule,
    MatIconModule, MatProgressSpinnerModule]
})
export class MapComponent implements OnInit, AfterViewInit, OnChanges, OnDestroy {
  mainSubscription$?: Subscription;
  mapState: WritableSignal<MapState> = signal('initial');
  eventState: WritableSignal<EventState> = signal("initial");

  @Input() focusedMarker?: bigint;
  @Input() pathEventData$?: EventResponse;
  @Input() eventRequest?: EventRequest;

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
    console.log("Constructing deckOverlayController.");
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

        case "eventRequest":
          console.log("Received event fetch request in google maps component.");
          this.eventRequest = currentValue as EventRequest;
          this.handleEventRequest(currentValue as EventRequest);

          break;

        default:
          break;
      }
    }
  }

  handleEventRequest(request: EventRequest){
    if (!this.map){
      console.log("Map not set before setting overlay");
      return;
    }
    this.deckOverlay?.loadData(request);
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
        this.mapState.set('loading');

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
