import { Component, OnInit } from '@angular/core';
// import { GoogleMap, } from '@angular/google-maps';
import { map, of, from } from 'rxjs';
import { StudyService } from '../studies/study.service';
import { StudyDTO } from '../studies/study';
import { Loader } from '@googlemaps/js-api-loader';
import { NgIf, AsyncPipe } from '@angular/common';
// import { MarkerClusterer } from '@googlemaps/markerclusterer';

// interface MarkerObject {
//   // marker: google.maps.Marker;
//   position: google.maps.LatLngLiteral;
//   study: StudyDTO;
//   title: string;
//   options?: google.maps.MarkerOptions;
//   shape?: google.maps.MarkerShape;
//   label?: google.maps.MarkerLabel;
//   library?: google.maps.MarkerLibrary;
// }

@Component({
  selector: 'app-map',
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.css'],
  standalone: true,
  imports: [NgIf, AsyncPipe]
})
export class MapComponent implements OnInit {


  mapOptions: google.maps.MapOptions = {
    center: {
      lat: 0,
      lng: 0,
    },
    zoom: 4,
    mapId: "demo",
    mapTypeId: "hybrid",
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
  // markers: Map<bigint, google.maps.Marker> | undefined;
  markers: google.maps.marker.AdvancedMarkerElement[] = [];
  mapCluster: MarkerClusterer | undefined;

  constructor(
    private studyService: StudyService) {
  }

  ngOnInit(): void {
    console.log("ngOnInit");

    this.apiLoaded = from(this.initMap());
  }

  async initMap(): Promise<boolean> {
    try {
      console.log("Initializing map.");
      // await this.loader.importLibrary("maps")
      //   .then(({ Map }) => {
      //     console.log("loaded map");
      //     new Map(document.getElementById("map")!, this.mapOptions);
      //
      //   })
      //   .catch((e) => console.error(e));

      this.loader.load().then((google) => {
        this.map = new google.maps.Map(document.getElementById("map")!, this.mapOptions);
        this.loadData();
        this.mapCluster = new MarkerClusterer({ map: this.map, markers: this.markers })
      })
      return true;

    } catch (error) {
      console.error(error);
      return false;
    }
  }

  loadData(): void {
    console.log("Calling getStudies");
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
        const markers = [];
        for (const studyDTO of this.studies.values()) {
          // console.log("beginning marker loop");
          if (studyDTO.mainLocationLon !== undefined && studyDTO.mainLocationLat !== undefined) {
            const marker = new google.maps.marker.AdvancedMarkerElement({
              map: this.map,
              position: {
                lat: studyDTO.mainLocationLat,
                lng: studyDTO.mainLocationLon
              }
            });
            markers.push(marker);
          }
        }
        this.markers = markers;
      },
      error: err => {
        console.error(err);
      }
    });
  }

  async addMarkers(studies: Map<bigint, StudyDTO>): Promise<void> {
    console.log(studies);
    return this.loader.importLibrary("marker")
      .then(({ AdvancedMarkerElement }) => {
        const markers = [];
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for (const [_, studyDTO] of studies.entries()) {
          const studyLat = studyDTO.mainLocationLat;
          const studyLon = studyDTO.mainLocationLon;
          if (studyLat !== undefined && studyLon !== undefined) {
            const pos = { lat: studyLat, lng: studyLon } as unknown as google.maps.LatLng;

            // const position = { lat: -25.344, lng: 131.031 } as google.maps.LatLng;
            const marker = new AdvancedMarkerElement({
              map: this.map,
              position: pos,
              title: studyDTO.name ?? null,
            });

            markers.push(marker);
          }
        }
        this.markers = markers;
        console.log(this.markers);
      })
      .catch((e) => console.error(e))
  }
}
