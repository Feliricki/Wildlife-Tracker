import { Component, OnInit } from '@angular/core';
// import { GoogleMap, } from '@angular/google-maps';
import { HttpClient } from '@angular/common/http';
import { Observable, map, of, tap, from } from 'rxjs';
import { StudyService } from '../studies/study.service';
import { StudyDTO } from '../studies/study';
import { Loader } from '@googlemaps/js-api-loader';

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
  standalone: true
})
export class MapComponent implements OnInit {

  defaultCenter: google.maps.LatLngAltitudeLiteral = {
    lat: 0,
    lng: 0,
    altitude: 12
  };

  defaultZoom = 15;
  defaultMapOptions: google.maps.MapOptions = {
    mapTypeId: "hybrid",
    zoom: 12,
  };

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
    // retries: 3,
  });

  map: google.maps.Map | undefined;

  constructor(
    private httpClient: HttpClient,
    private studyService: StudyService) {
  }

  ngOnInit(): void {
    // if (navigator.geolocation) {
    //   navigator.geolocation.getCurrentPosition(
    //     (position: GeolocationPosition) => {
    //       this.defaultCenter = {
    //         lat: position.coords.latitude ?? 0,
    //         lng: position.coords.longitude ?? 0,
    //         altitude: 150
    //       };
    //       console.log("defaultCenter has been updated");
    //     },
    //
    //     (error: GeolocationPositionError) => {
    //       console.error(error);
    //     }
    //   )
    // }

    this.apiLoaded = from(this.initMap()).pipe(
      tap(result => {
        if (result) {
          // TODO:  load studies and markers here
          // this.loadData();
        } else {
          return;
        }
      }),
    );
  }

  async initMap(): Promise<boolean> {
    try {
      console.log("Initializing map.");
      this.loader.importLibrary("maps")
        .then(({ Map }) => {
          new Map(document.getElementById("map")!, this.mapOptions);
        })
        .catch((e) => console.log(e));

      return true;

    } catch (error) {
      console.error(error);
      return false;
    }
  }

  getStudies(): Observable<Map<bigint, StudyDTO>> {
    return this.studyService.getAllStudies().pipe(

      map(StudyDTOs => {

        const mappings = new Map<bigint, StudyDTO>();
        StudyDTOs.forEach(studyDTO => {
          mappings.set(studyDTO.id, studyDTO);
        })
        return mappings;

      }),

    );
  }

  // TODO: How to combine both the studies and the marker subscription?
  // Use a higher order observable such as ConcatMap or MergeMap
  getMarkers(): Observable<Map<bigint, google.maps.Marker>> {
    return this.studyService.getAllStudies().pipe(
      map(studyDTOs => {
        return studyDTOs.filter(studyDTO => (studyDTO.mainLocationLat !== undefined || studyDTO.mainLocationLon !== undefined)
          && (studyDTO.mainLocationLon !== 0 && studyDTO.mainLocationLat !== 0));
      }),

      map(studyDTOs => {
        const mappings = new Map<bigint, google.maps.Marker>();

        for (const studyDTO of studyDTOs) {
          const marker = new google.maps.Marker();
          const pos: google.maps.LatLngLiteral = {
            lat: studyDTO.mainLocationLat ?? 0,
            lng: studyDTO.mainLocationLon ?? 0,
          };

          if (this.map) {
            marker.setMap(this.map);
          }
          marker.setPosition(pos);
          mappings.set(studyDTO.id, marker);
        }
        return mappings;
      })
    );
  }

  // loadData(): void {
  // }
}
