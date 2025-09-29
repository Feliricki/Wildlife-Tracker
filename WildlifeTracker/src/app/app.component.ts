import { Component, Injector, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavBarComponent } from './nav-bar/nav-bar.component';
import { createCustomElement } from '@angular/elements';
import { InfoWindowComponent } from './base-maps/google maps/info-window/info-window.component';
import { CustomButtonComponent } from './base-maps/mapbox/custom-button/custom-button.component';
import { LumaDeviceService } from './services/luma-device.service';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs';


@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  imports: [
    NavBarComponent, RouterOutlet,
  ]
})
export class AppComponent implements OnInit {

  private swUpdate = inject(SwUpdate);

  ngOnInit(): void {
    if (this.swUpdate.isEnabled) {
      this.checkForUpdates();
    }
  }

  checkForUpdates(): void {
    // The versionUpdates observable emits when a new version is downloaded and ready to be activated.
    this.swUpdate.versionUpdates.pipe(
      filter((event): event is VersionReadyEvent => event.type === 'VERSION_READY')
    ).subscribe(event => {
      console.log(`New version ready: ${event.latestVersion.hash}. Current version: ${event.currentVersion.hash}.`);

      // Prompt the user to update. This can be a toast, a snackbar, a modal, or a simple confirm().
      if (confirm('A new version of the application is available. Load new version?')) {
        // This reloads the page and activates the new service worker.
        this.swUpdate.activateUpdate().then(() => document.location.reload());
      }
    });

    // check for update every six hours
    setInterval(() => {
      this.swUpdate.checkForUpdate();
    }, 6 * 60 * 60 * 1000);
  }

  constructor(private injector: Injector, private lumaDeviceService: LumaDeviceService) {
    this.lumaDeviceService.initializeDevice();
    const infoWindowEl = createCustomElement(InfoWindowComponent, { injector: this.injector });
    customElements.define('info-window-el', infoWindowEl);

    const customButtonEl = createCustomElement(CustomButtonComponent, { injector: this.injector });
    customElements.define('custom-button-el', customButtonEl);
  }
  title = 'Animal tracker';
}
