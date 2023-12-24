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
  standalone: true,
  imports: [
    NgIf, AsyncPipe, MatButtonModule,
    MatIconModule, MatProgressSpinnerModule]
})
export class MapComponent implements OnInit, AfterViewInit, OnChanges, OnDestroy {
  mainSubscription$?: Subscription;
  mapState: WritableSignal<MapState> = signal('initial');

  @Input() focusedMarker?: bigint;
  @Input() pathEventData$?: Observable<LineStringFeatureCollection[] | null>;

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
  ngOnChanges(changes: SimpleChanges): void {
    for (const propertyName in changes) {
      const currentValue = changes[propertyName].currentValue;
      switch (propertyName) {
        // This case sends a message that is received in the event component
        case "focusedMarker":
          console.log(`Panning to ${currentValue}`);
          this.panToMarker(currentValue);
          break;

        // Event data to be returned here in LineFeatureCollection format
        case "eventObservable":
          console.log(`Received event observable in google maps component.`);
          console.log(currentValue);
          this.pathEventData$ = currentValue as Observable<LineStringFeatureCollection[]>;
          break;

        default:
          break;
      }
    }
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

      next: async (objRes) => {
        const mapEl = document.getElementById("map");
        console.log(objRes);
        this.map = new google.maps.Map(mapEl as HTMLElement, this.defaultMapOptions);

        this.infoWindow = new google.maps.InfoWindow();
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
          onClusterClick: (_, cluster, map) => {
            // If any cluster is clicked, then the info window is restored to its initial state more or less
            if (this.infoWindow && this.infoWindow.get("toggle") === true) {
              this.infoWindow.close();
              this.infoWindow.set("toggle", false);
              this.infoWindow.set("studyId", -1n);
            }
            map.fitBounds(cluster.bounds as google.maps.LatLngBounds);
          }
        });
        this.deckOverlay = new GoogleMapOverlayController(this.map);
        // In Order,
        // The mapLoaded flag is changed for templating purposes.
        // The event emitter is fired and a message is sent to the TrackeView component.
        this.mapState.set('loaded');
        this.sendMapState(true);
      },
      error: err => console.error(err)
    });
    return true;
  }

  // initializeDeckOverlay(): GoogleMapsOverlay {
  //
  //   const EARTHQUAKES = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_month.geojson";
  //   const earthquakeLayer = new GeoJsonLayer({
  //     id: "earthquakes",
  //     data: EARTHQUAKES,
  //     filled: true,
  //     pointRadiusMinPixels: 2,
  //     pointRadiusMaxPixels: 200,
  //     opacity: 0.4,
  //     pointRadiusScale: 0.3,
  //     getPointRadius: (f) => Math.pow(10, f.properties!['mag']),
  //     getFillColor: [255, 70, 30, 180],
  //     autoHighlight: true,
  //   })
  //
  //   const overlay = new GoogleMapsOverlay({
  //     layers: [earthquakeLayer],
  //   });
  //   console.log("Returning overlay.");
  //   return overlay;
  // }

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

  // getGeoJsonData(studyId: bigint, ) {
  //   return this.studyService.getGeoJsonEventData(studyId, )
  // }

  // NOTE: This function only affects the map component
  panToMarker(studyId: bigint): void {
    const curMarker = this.markers?.get(studyId);
    if (curMarker === undefined) {
      return;
    }
    const markerPos = curMarker.position;
    if (!markerPos) {
      return;
    }
    console.log(`Panning to marker ${studyId}`);
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
