import { Component } from '@angular/core';
import { MapComponent } from '../map/map.component';
import { SimpleSearchComponent } from '../simple-search/simple-search.component';
import { MatSidenavModule } from '@angular/material/sidenav';

@Component({
  selector: 'app-side-nav',
  templateUrl: './side-nav.component.html',
  styleUrls: ['./side-nav.component.css'],
  standalone: true,
  imports: [MatSidenavModule, SimpleSearchComponent, MapComponent]
})
export class SideNavComponent {
  options = {
    fixed: true,
    bottom: 0,
    top: 0
  };
  constructor(
  ) {
    return;
  }

  switchSearchMode(): void {
    return;
  }
}
