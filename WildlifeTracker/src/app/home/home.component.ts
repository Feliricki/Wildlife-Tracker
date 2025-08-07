import { Component } from '@angular/core';
import { MapDashboardComponent } from '../tracker-view/tracker-view.component';
// import {RouterOutlet} from "@angular/router";

@Component({
    selector: 'app-home',
    templateUrl: './home.component.html',
    styleUrls: ['./home.component.css'],
    imports: [MapDashboardComponent]
})
export class HomeComponent {
  // @ViewChild(GoogleMap, { static: false }) map: GoogleMap;
  constructor() {
    return;
  }
}
