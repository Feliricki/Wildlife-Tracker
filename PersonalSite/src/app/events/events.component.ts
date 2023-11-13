import { Component, Input, OnInit, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StudyDTO } from '../studies/study';
import { StudyService } from '../studies/study.service';
import { EventJsonDTO } from '../studies/JsonResults/EventJsonDTO';

@Component({
  selector: 'app-events',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './events.component.html',
  styleUrl: './events.component.css'
})
export class EventsComponent {
  @Input() currentStudies: StudyDTO[] | undefined;
  @Input() toggles: boolean[] | undefined;

  constructor(studyService: StudyService) {
    return;
  }
}
