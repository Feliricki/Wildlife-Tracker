import { Component, OnInit } from '@angular/core';
// import { GoogleMap, } from '@angular/google-maps';
import { map, of, from } from 'rxjs';
import { StudyService } from '../studies/study.service';
import { StudyDTO } from '../studies/study';
import { Loader } from '@googlemaps/js-api-loader';
import { NgIf, AsyncPipe } from '@angular/common';
import { MarkerClusterer, Marker, SuperClusterAlgorithm, SuperClusterOptions } from '@googlemaps/markerclusterer';
import { Renderer1 } from './renderers';

@Component({
  selector: 'app-google-map',
  templateUrl: './google-map.component.html',
  styleUrls: ['./google-map.component.css'],
  standalone: true,
  imports: [NgIf, AsyncPipe]
})
export class MapComponent implements OnInit {

  defaultMapOptions: google.maps.MapOptions = {
    center: {
      lat: 0,
      lng: 0,
    },
    zoom: 4,
    mapId: "demo",
    mapTypeId: "hybrid",
  };

  defaultAlgorithmOptions: SuperClusterOptions = {
    radius: 120,
  }

  defaultMarkerOptions: google.maps.MarkerOptions = {
    clickable: true,
  };
  defaultPinOptions: google.maps.marker.PinElementOptions = {
    scale: 1, // default = 1
  }
  defaultInfoWindowOptions: google.maps.InfoWindowOptions = {
  }
  defaultInfoWindowOpenOptions: google.maps.InfoWindowOpenOptions = {
  }

  apiLoaded = of(false);
  // this api key is restricted
  loader = new Loader({
    apiKey: "AIzaSyB3YlH9v4TYdeP8Qc3x-HA6jRNYiHJKz1s",
    version: "weekly",
    libraries: ['marker']
  });

  map: google.maps.Map | undefined;
  studies: Map<bigint, StudyDTO> | undefined;
  markers: Marker[] = [];
  mapCluster: MarkerClusterer | undefined;

  infoWindow: google.maps.InfoWindow | undefined;

  constructor(
    private studyService: StudyService) {
  }

  ngOnInit(): void {
    console.log("ngOnInit");

    this.apiLoaded = from(this.initMap());
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
          const markers: Marker[] = [];

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
              this.infoWindow.close();
              this.infoWindow.setContent(`latitude: ${studyDTO.mainLocationLat}<br>longitude: ${studyDTO.mainLocationLon}`);
              this.infoWindow.set("toggle", !this.infoWindow.get("toggle"));
              this.infoWindow.set("studyId", studyDTO.id);
              this.infoWindow.open(this.map, marker);
            })
            markers.push(marker);
          }
          this.markers = markers;
          this.mapCluster = new MarkerClusterer({ map: this.map, markers: markers, renderer: new Renderer1(), algorithm: new SuperClusterAlgorithm(this.defaultAlgorithmOptions) });
        },
        error: err => console.error(err)
      });
      return true;

    }).catch(e => {
      console.error(e);
      return false;
    })

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
