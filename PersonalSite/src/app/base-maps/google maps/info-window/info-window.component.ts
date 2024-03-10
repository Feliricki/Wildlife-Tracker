import { Component, EventEmitter, Input, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { StudyDTO } from 'src/app/studies/study';

// INFO: Templating and logic for the info window used in the googlemap component.
// This component is registered as a custom element in app.component
@Component({
  selector: 'app-info-window',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule],
  template:
    `
      <div class="container">
      <h4>{{ currentStudy?.name }}</h4>
      <span>latitude: {{ currentStudy?.mainLocationLat }}</span><br>
      <span>longitude: {{ currentStudy?.mainLocationLon }}</span><br>
      <button mat-raised-button extended (click)="emitEventRequest(currentStudy!)">See Event Data</button>
      </div>
`,
  styleUrl: './info-window.component.css'
})
export class InfoWindowComponent implements OnDestroy {
  @Input()
  currentStudy?: StudyDTO;
  @Input()
  eventRequest?: EventEmitter<StudyDTO>;
  @Input()
  infoWindowInstance?: google.maps.InfoWindow;

  constructor() {
    return;
  }

  emitEventRequest(studyDTO: StudyDTO): void {
    this.eventRequest?.emit(studyDTO);
  }

  ngOnDestroy(): void {
    // this.closeInfoWindow();
    return;
  }

  closeInfoWindow(): void {
    this.infoWindowInstance?.set("toggle", false);
    this.infoWindowInstance?.close();
  }

}
