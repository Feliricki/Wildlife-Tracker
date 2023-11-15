import { Component, OnInit, OnChanges, SimpleChanges, Input, Output, EventEmitter } from '@angular/core';
import { map, of, from, Observable } from 'rxjs';
import { StudyService } from '../studies/study.service';
import { StudyDTO } from '../studies/study';
import { Loader } from '@googlemaps/js-api-loader';
import { NgIf, AsyncPipe } from '@angular/common';
import { MarkerClusterer, Marker, SuperClusterAlgorithm, SuperClusterOptions } from '@googlemaps/markerclusterer';
import { Renderer1 } from './renderers';
import { JsonResponseData } from '../studies/JsonResults/JsonDataResponse';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

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

  defaultPinOptions: google.maps.marker.PinElementOptions = {
    scale: 1, // default = 1
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
  studiesEmitter = new EventEmitter<Map<bigint, StudyDTO>>();
  markers: Map<bigint, google.maps.marker.AdvancedMarkerElement> | undefined;
  mapCluster: MarkerClusterer | undefined;

  infoWindow: google.maps.InfoWindow | undefined;

  constructor(
    private studyService: StudyService) {
  }

  ngOnInit(): void {
    console.log("ngOnInit");
    this.apiLoaded = from(this.initMap());
  }

  // NOTE: This method listens to values received from tracker view component
  //  Only new values (actual changes) make it to this method.
  ngOnChanges(changes: SimpleChanges): void {
    for (const propertyName in changes) {
      const currentValue = changes[propertyName].currentValue;
      switch (propertyName) {
        case "focusedMarker":
          console.log(`Panning to ${currentValue}`);
          this.panToMarker(currentValue);
          break;
        default:
          break;
      }
    }
  }


  async initMap(): Promise<boolean> {

    console.log("Initializing map.");
    return this.loader.load().then(async () => {

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
          const markers: Map<bigint, google.maps.marker.AdvancedMarkerElement> = new Map<bigint, google.maps.marker.AdvancedMarkerElement>();

          for (const studyDTO of this.studies.values()) {

            if (studyDTO.mainLocationLon === undefined || studyDTO.mainLocationLat === undefined) {
              continue;
            }

            // Scale this to an appropriate size
            const pin = new google.maps.marker.PinElement(
              this.defaultPinOptions);

            const marker = new google.maps.marker.AdvancedMarkerElement({
              map: this.map,
              content: pin.element,
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
              const content = this.buildInfoWindowContent(studyDTO);
              this.infoWindow.close();
              this.infoWindow.setContent(content);
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
            renderer: new Renderer1(),
            algorithm: new SuperClusterAlgorithm(this.defaultAlgorithmOptions),
            onClusterClick: (_, cluster, map) => {
              // If any cluster is clicked, then the infowindow is restored to its initial state more or less
              console.log("Recording cluster click event");
              if (this.infoWindow && this.infoWindow.get("toggle") === true) {
                this.infoWindow.close();
                this.infoWindow.set("toggle", false);
                this.infoWindow.set("studyId", -1n);
                console.log("Reset infowindow to its initial state");
                // console.log(this.infoWindow);
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

  buildInfoWindowContent(studyDTO: StudyDTO): HTMLElement {
    // const html = new HTMLElement();
    const html = document.createElement('div');
    html.id = `info-window-content`;
    html.innerHTML += `<h5>${studyDTO.name}</h5>`
    html.innerHTML += `<p>latitude: ${studyDTO.mainLocationLat}<br>`
    html.innerHTML += `<p>longitude: ${studyDTO.mainLocationLon}<br>`

    const buttonElem = document.createElement('button');
    buttonElem.id = `event-button`;
    buttonElem.innerText = "Get Event";
    // buttonElem.click = () => this.emitJsonData("study", studyDTO.id);
    buttonElem.addEventListener("click", () => {
      this.emitJsonData("study", studyDTO.id);
    });
    // TODO: Emit a json observable event from here to the tacker parent component
    html.appendChild(buttonElem);
    return html;
  }

  getJsonData(entityType: "study" | "individual" | "tag", studyId: bigint): Observable<JsonResponseData[]> {
    console.log("emitting json data");
    return this.studyService.jsonRequest(entityType, studyId);
  }

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

  emitStudies(studies: Map<bigint, StudyDTO>): void {
    console.log("emitting studies.");
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
