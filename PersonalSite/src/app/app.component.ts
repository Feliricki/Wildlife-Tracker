import { HttpClient } from '@angular/common/http';
import { Component } from '@angular/core';
import { environment } from "../environments/environment";


@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  // public forecasts?: WeatherForecast[];
  constructor(http: HttpClient) {
    // http.get<WeatherForecast[]>(environment.baseUrl + 'api/weatherforecast').subscribe({
    //   next: (result) => this.forecasts = result,
    //   error: (err) => console.log(err)
    // });
  }
  title = 'Animal tracker';
}

// interface WeatherForecast {
//   date: string;
//   temperatureC: number;
//   temperatureF: number;
//   summary: string;
// }
