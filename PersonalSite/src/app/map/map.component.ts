import { Component, OnInit, ViewChild } from '@angular/core';
import { GoogleMap } from '@angular/google-maps';
import { HttpClient } from '@angular/common/http';
import { Observable, map, catchError, of } from 'rxjs';

@Component({
  selector: 'app-map',
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.css']
})
export class MapComponent implements OnInit {
  apiLoaded: Observable<boolean> = of(false);
  zoom = 12;
  center!: google.maps.LatLngAltitudeLiteral;
  options: google.maps.MapOptions = {
    mapTypeId: 'hybrid',
  };

  constructor(private httpClient: HttpClient){}

  ngOnInit(): void {
    navigator.geolocation.getCurrentPosition(position => {
     this.center = {
      lat: position.coords.latitude ?? 0,
      lng: position.coords.longitude ?? 0,
      altitude: position.coords.altitude ?? 10
     };
    }, error => console.log(error));

    // Restricted API key
    this.apiLoaded = of(false);
     //this.apiLoaded = this.httpClient.jsonp('https://maps.googleapis.com/maps/api/js?key=AIzaSyB3YlH9v4TYdeP8Qc3x-HA6jRNYiHJKz1s&signature=AsW1SeEc8neRlJVwxCzcmYf6eMs=', "callback")
     //  .pipe(
     //    map(() => true),
     //    catchError((err) => {
     //      console.log(err);
     //      return of(false);
     //    }),
     //  );
  }
  // isLoaded(): boolean {
  //   return this.apiLoaded. == true;
  // }
}
