import { Component, OnInit, ViewChild } from '@angular/core';
import { GoogleMap, } from '@angular/google-maps';
import { HttpClient } from '@angular/common/http';
import { Observable, map, of, catchError, tap } from 'rxjs';
import { StudyService } from '../studies/study.service';
import { StudyDTO } from '../studies/study';

interface MarkerObject {
  // marker: google.maps.Marker;
  position: google.maps.LatLngLiteral;
  study: StudyDTO;
  title: string;
  options?: google.maps.MarkerOptions;
  shape?: google.maps.MarkerShape;
  label?: google.maps.MarkerLabel;
  library?: google.maps.MarkerLibrary;
}

@Component({
  selector: 'app-map',
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.css']
})
export class MapComponent implements OnInit {
  currentStudiesMap = new Map<bigint, StudyDTO>();
  currentStudiesMap$: Observable<Map<bigint, StudyDTO>> | undefined; // the current collection of studies
  currentMapMarkersMap = new Map<bigint, MarkerObject>();
  currentMapMarkers$: Observable<Map<bigint, MarkerObject>> | undefined;

  currentMarkers$: Observable<google.maps.Marker[]> | undefined;
  currentStudies: StudyDTO[] = [];
  currentMarkers: google.maps.Marker[] = [];

  apiLoaded: Observable<boolean> = of(false);
  center!: google.maps.LatLngAltitudeLiteral;
  defaultZoom = 12;
  options: google.maps.MapOptions = {
    mapTypeId: "hybrid",
    scrollwheel: false,
    disableDoubleClickZoom: true,
  };

  @ViewChild(GoogleMap, { static: false }) googleMap!: GoogleMap;
  // @ViewChild(google.maps.Map) curMap: google.maps.Map;

  constructor(
    private httpClient: HttpClient,
    private studyService: StudyService) {
  }

  ngOnInit(): void {
    navigator.geolocation.getCurrentPosition(position => {
      this.center = {
        lat: position.coords.latitude ?? 0,
        lng: position.coords.longitude ?? 0,
        altitude: 10
      };
      this.options.center = this.center;
    }, error => {
      console.log(error);
      this.center = {
        lat: 0, lng: 0, altitude: 10
      };
    });
    // Restricted API key
    // this.apiLoaded = of(false);
    // AIzaSyB3YlH9v4TYdeP8Qc3x-HA6jRNYiHJKz1s
    //this.apiLoaded = this.httpClient.jsonp('https://maps.googleapis.com/maps/api/js?key=AIzaSyB3YlH9v4TYdeP8Qc3x-HA6jRNYiHJKz1s&signature=AsW1SeEc8neRlJVwxCzcmYf6eMs=', "callback")
    this.apiLoaded = this.httpClient.jsonp("https://maps.googleapis.com/maps/api/js?key=AIzaSyB3YlH9v4TYdeP8Qc3x-HA6jRNYiHJKz1s", "callback")
      .pipe(

        map(() => {
          return true;
        }),

        tap(result => {
          if (result) {
            this.loadData();
          }
        }),

        catchError(_ => {
          console.error("Login error in apiLoaded subscription");
          console.error(_);
          return of(false);
        }
        ),
      );

  }

  AddMarker(): void {
    if (!this.currentMapMarkers$) {
      return;
    }
    this.currentMapMarkers$;

    return;
  }

  getStudies(): Observable<Map<bigint, StudyDTO>> {
    return this.studyService.getAllStudies().pipe(
      map(studyDTOs => {
        let mappings = new Map<bigint, StudyDTO>();
        for (const studyDTO of studyDTOs) {
          mappings.set(studyDTO.id, studyDTO);
        }
        console.log(mappings);
        return mappings;
      }),
    );
  }

  loadData(): void {
    console.log("loading data.")
    this.studyService.getAllStudies().subscribe({
      next: studyDTOs => {
        console.log("Subscription to getAllStudies");
        let mappings = new Map<bigint, MarkerObject>();
        studyDTOs.forEach(studyDTO => {
          this.currentStudies.push(studyDTO);
          if (!(studyDTO.mainLocationLon === undefined || studyDTO.mainLocationLat === undefined) &&
            !(studyDTO.mainLocationLon === 0 && studyDTO.mainLocationLat === 0)) {
            // console.log("test condition #1");
            let pos: google.maps.LatLngLiteral = {
              lat: studyDTO.mainLocationLat!,
              lng: studyDTO.mainLocationLon!,
            };
            let mapObj: MarkerObject = {
              position: pos,
              study: studyDTO,
              label: {
                color: "red",
                text: "Study label"
              },
              title: studyDTO.name.slice(0, Math.min(25, studyDTO.name.length)),
            };
            mappings.set(studyDTO.id, mapObj);
          }
        });
        console.log(mappings);
        return mappings;
      },
      error: err => {
        console.error(err);
      }
    })
  }

  // Grab the observable for performance
  loadMarkers(): void {
    this.studyService.getAllStudies().pipe(

      // Filter out study object that do not contains a valid position to display
      map(studyDTOs => {
        return studyDTOs.filter(studyDTO =>
          (studyDTO.mainLocationLat !== undefined && studyDTO.mainLocationLon !== undefined)
          && (studyDTO.mainLocationLon !== 0 && studyDTO.mainLocationLat !== 0)
        );
      }),

      map(studyDTOs => {
        // Create Marker Objects from the array of studyDTO objects.
        let mappings = new Map<bigint, MarkerObject>();
        // Create markers from the study objects
        let markers = studyDTOs.map(studyDTO => {
          let curMarker = new google.maps.Marker();
          let pos: google.maps.LatLngLiteral = {
            lat: studyDTO.mainLocationLat!,
            lng: studyDTO.mainLocationLon!,
          };

          let markerObj = {
            marker: curMarker,
            position: pos,
            study: studyDTO,
            title: "A title."
          } as MarkerObject;

          return markerObj;
        });

        for (const marker of markers) {
          mappings.set(marker.study.id, marker);
        }

        return mappings;
      }),

    );
  }
}
