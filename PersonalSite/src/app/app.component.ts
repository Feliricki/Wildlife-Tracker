import { Component, Injector } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavBarComponent } from './nav-bar/nav-bar.component';
import { createCustomElement } from '@angular/elements';
import { InfoWindowComponent } from './google-maps/info-window/info-window.component';


@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  standalone: true,
  imports: [NavBarComponent, RouterOutlet, InfoWindowComponent]
})
export class AppComponent {
  constructor(private injector: Injector) {
    const infoWindowEl = createCustomElement(InfoWindowComponent, { injector: this.injector });
    customElements.define('info-window-el', infoWindowEl);
  }
  title = 'Animal tracker';
}
