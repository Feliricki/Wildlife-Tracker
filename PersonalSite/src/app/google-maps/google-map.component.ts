import { Component, OnInit, OnChanges, SimpleChanges, Input, Output, EventEmitter } from '@angular/core';
import { map, of, from, Observable } from 'rxjs';
import { StudyService } from '../studies/study.service';
import { StudyDTO } from '../studies/study';
import { Loader } from '@googlemaps/js-api-loader';
import { NgIf, AsyncPipe } from '@angular/common';
import { CustomRenderer1 } from './renderers';
import { MarkerClusterer, Marker, SuperClusterAlgorithm, SuperClusterOptions } from '@googlemaps/markerclusterer';
import { JsonResponseData } from '../studies/JsonResults/JsonDataResponse';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { NgElement, WithProperties } from '@angular/elements';
import { InfoWindowComponent } from './info-window/info-window.component';
import { environment } from 'src/environments/environment';

// const glyphImage = require("../../assets/glyph1.png");

@Component({
  selector: 'app-google-map',
  templateUrl: './google-map.component.html',
  styleUrls: ['./google-map.component.css'],
  standalone: true,
  imports: [NgIf, AsyncPipe, MatButtonModule, MatIconModule]
})
export class MapComponent implements OnInit, OnChanges {
  @Input() focusedMarker: bigint | undefined;
  @Output() JsonDataEmitter = new EventEmitter<Observable<JsonResponseData[]>>();

  defaultMapOptions: google.maps.MapOptions = {
    center: {
      lat: 0,
      lng: 0,
    },
    zoom: 4,
    mapId: "initial_map",
    mapTypeId: "hybrid",
    gestureHandling: "cooperative",
    // restriction: { strictBounds: true }
  };

  defaultAlgorithmOptions: SuperClusterOptions = {
    radius: 150,
  }

  defaultMarkerOptions: google.maps.MarkerOptions = {
    clickable: true,
  };

  // defaultGlyphOptions: google.maps.marker.

  defaultPinOptions: google.maps.marker.PinElementOptions = {
    scale: 1, // default = 1
    // glyph: new URL(`/img/house-icon.png`),
  };

  defaultInfoWindowOptions: google.maps.InfoWindowOptions = {
  };

  defaultInfoWindowOpenOptions: google.maps.InfoWindowOpenOptions = {
  };

  apiLoaded = of(false);
  // this api key is restricted
  loader = new Loader({
    apiKey: "AIzaSyB3YlH9v4TYdeP8Qc3x-HA6jRNYiHJKz1s",
    version: "weekly",
    libraries: ['marker']
  });

  map: google.maps.Map | undefined;
  studies: Map<bigint, StudyDTO> | undefined;

  // TODO: Make sure this message recieved in the trigger view component
  @Output() studiesEmitter = new EventEmitter<Map<bigint, StudyDTO>>();
  @Output() studyEmitter = new EventEmitter<StudyDTO>();
  // @Output() eventRequestEmitter = new EventEmitter<StudyDTO>();

  markers: Map<bigint, google.maps.marker.AdvancedMarkerElement> | undefined;
  mapCluster: MarkerClusterer | undefined;

  infoWindow: google.maps.InfoWindow | undefined;

  constructor(
    private studyService: StudyService) {
  }

  ngOnInit(): void {
    this.apiLoaded = from(this.initMap());
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
        default:
          break;
      }
    }
  }
  // TODO: Design the ui that will become the individual identifier and event viewer viewer

  async initMap(): Promise<boolean> {

    console.log("Initializing map.");
    return this.loader.load().then(() => {

      this.map = new google.maps.Map(document.getElementById("map") as HTMLElement, this.defaultMapOptions);
      this.infoWindow = new google.maps.InfoWindow();
      this.infoWindow.set("toggle", false);
      this.infoWindow.set("studyId", -1n);

      this.studyService.getAllStudies().pipe(

        map(StudyDTOs => {

          const mappings = new Map<bigint, StudyDTO>();
          StudyDTOs.forEach(studyDTO => {
            mappings.set(studyDTO.id, studyDTO);
          })
          return mappings;
        }),

      ).subscribe({
        next: mappings => {
          this.studies = mappings;
          this.emitStudies(this.studies);
          const markers: Map<bigint, google.maps.marker.AdvancedMarkerElement> = new Map<bigint, google.maps.marker.AdvancedMarkerElement>();

          for (const studyDTO of this.studies.values()) {

            if (studyDTO.mainLocationLon === undefined || studyDTO.mainLocationLat === undefined) {
              continue;
            }
            const imageIcon = document.createElement('img');
            imageIcon.src = '../../assets/location-pin2.png';
            imageIcon.style['height'] = '45px';
            imageIcon.style['width'] = '45px';


            const marker = new google.maps.marker.AdvancedMarkerElement({
              map: this.map,
              content: imageIcon,
              position: {
                lat: studyDTO.mainLocationLat,
                lng: studyDTO.mainLocationLon
              },
              title: studyDTO.name,
            });

            // NOTE: This is where the listener functions is defined.
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
              // If any cluster is clicked, then the infowindow is restored to its initial state more or less
              if (this.infoWindow && this.infoWindow.get("toggle") === true) {
                this.infoWindow.close();
                this.infoWindow.set("toggle", false);
                this.infoWindow.set("studyId", -1n);
              }
              map.fitBounds(cluster.bounds as google.maps.LatLngBounds);
            }

          });

        },
        error: err => console.error(err)
      });
      return true;

    }).catch(e => {
      console.error(e);
      return false;
    })
  }

  // NOTE: This function serves to create a dynamic button element every time the info window is opened
  // On button click an event is emitted that makes send jsonData to the event component
  buildInfoWindowContent(studyDTO: StudyDTO): HTMLElement {
    console.log("about to create info window");
    const infoWindowEl = document.createElement('info-window-el') as NgElement & WithProperties<InfoWindowComponent>;
    infoWindowEl.currentStudy = studyDTO;
    infoWindowEl.eventRequest = this.studyEmitter;

    infoWindowEl.addEventListener('closed', () => {
      console.log("closed event: Closing info window component");
      document.body.removeChild(infoWindowEl)
    });
    console.log("returning info window content");
    return infoWindowEl;
  }

  getJsonData(entityType: "study" | "individual" | "tag", studyId: bigint): Observable<JsonResponseData[]> {
    console.log("emitting json data");
    return this.studyService.jsonRequest(entityType, studyId);
  }

  // NOTE: This function only effects the map component
  panToMarker(studyId: bigint): void {
    console.log("calling panToMarker");
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

  emitJsonData(entityType: "study" | "individual" | "tag", studyId: bigint): void {
    this.JsonDataEmitter.emit(this.studyService.jsonRequest(entityType, studyId));
  }

  // Use this to emit specific to the parent component
  //  Tentatively, this will only be recieved in the event and tracker view component
  emitStudy(study: StudyDTO): void {
    this.studyEmitter.emit(study);
  }

  emitStudies(studies: Map<bigint, StudyDTO>): void {
    console.log("Emitting studies in google maps component");
    this.studiesEmitter.emit(studies);
  }

  getMarkers(studies: Map<bigint, StudyDTO>, map: google.maps.Map): Marker[] {
    const markers = [];
    for (const studyDTO of studies.values()) {
      if (studyDTO.mainLocationLat !== undefined && studyDTO.mainLocationLon !== undefined) {
        const marker = new google.maps.marker.AdvancedMarkerElement({
          position: { lat: studyDTO.mainLocationLat, lng: studyDTO.mainLocationLon },
          map: map
        });
        markers.push(marker);
      }
    }
    return markers;
  }
}
