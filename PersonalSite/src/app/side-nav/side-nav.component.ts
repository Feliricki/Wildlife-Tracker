import { Component } from '@angular/core';
import { MapComponent } from '../google-maps/google-map.component';
import { SimpleSearchComponent } from '../simple-search/simple-search.component';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-side-nav',
  templateUrl: './side-nav.component.html',
  styleUrls: ['./side-nav.component.css'],
  standalone: true,
  imports: [MatSidenavModule, MatButtonModule, SimpleSearchComponent, MapComponent]
})
export class SideNavComponent {
  options = {
    fixed: true,
    bottom: 0,
    top: 0
  };
  currentMarker: bigint | undefined;

  constructor(
  ) {
    return;
  }

  switchSearchMode(): void {
    return;
  }

  panToMarker(studyId: bigint): void {
    // console.log(`Received ${studyId} in SideNav component.`);
    this.currentMarker = studyId;
  }

  toggleLeft(): void {
    return;
  }
}
