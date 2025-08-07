import { Component, Injector } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavBarComponent } from './nav-bar/nav-bar.component';
import { createCustomElement } from '@angular/elements';
import { InfoWindowComponent } from './base-maps/google maps/info-window/info-window.component';
import { CustomButtonComponent } from './base-maps/mapbox/custom-button/custom-button.component';
import { LumaDeviceService } from './services/luma-device.service';


@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.css'],
    imports: [
        NavBarComponent, RouterOutlet,
    ]
})
export class AppComponent {
  constructor(private injector: Injector, private lumaDeviceService: LumaDeviceService) {
    this.lumaDeviceService.initializeDevice();
    const infoWindowEl = createCustomElement(InfoWindowComponent, { injector: this.injector });
    customElements.define('info-window-el', infoWindowEl);

    const customButtonEl = createCustomElement(CustomButtonComponent, { injector: this.injector });
    customElements.define('custom-button-el', customButtonEl);
  }
  title = 'Animal tracker';
}
