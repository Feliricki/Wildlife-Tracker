import { Component, EventEmitter, Input } from '@angular/core';
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
      <h5>{{ currentStudy?.name }}</h5>
      <span>latitude: {{ currentStudy?.mainLocationLat }}</span><br>
      <span>longitude: {{ currentStudy?.mainLocationLon }}</span><br>
      <button mat-button (click)="emitEventRequest(currentStudy!)">See Event Data</button>
    `,
  styleUrl: './info-window.component.css'
})
export class InfoWindowComponent {
  @Input()
  currentStudy?: StudyDTO;
  @Input()
  eventRequest?: EventEmitter<StudyDTO>;

  constructor() {
    return;
  }

  emitEventRequest(studyDTO: StudyDTO): void {
    this.eventRequest?.emit(studyDTO);
  }

}
