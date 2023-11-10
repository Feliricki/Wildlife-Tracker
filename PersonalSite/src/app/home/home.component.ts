import { Component } from '@angular/core';
import { SideNavComponent } from '../side-nav/side-nav.component';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
  standalone: true,
  imports: [SideNavComponent]
})
export class HomeComponent {
  // @ViewChild(GoogleMap, { static: false }) map: GoogleMap;
  constructor() {
    return;
  }
}
