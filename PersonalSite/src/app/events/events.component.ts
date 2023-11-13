import { Component, Input, Output, OnChanges, EventEmitter, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StudyDTO } from '../studies/study';
import { StudyService } from '../studies/study.service';
import { EventJsonDTO } from '../studies/JsonResults/EventJsonDTO';
import { EMPTY, Observable } from 'rxjs';

@Component({
  selector: 'app-events',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './events.component.html',
  styleUrl: './events.component.css'
})
export class EventsComponent implements OnChanges {
  // NOTE: This collection is the studies that are currently toggled to display event data
  toggledStudies: Map<bigint, StudyDTO> | undefined;
  @Input() toggledStudy: StudyDTO | undefined;

  currentEvents: EventJsonDTO[] = [];
  @Output() studyEventEmitter = new EventEmitter<Observable<EventJsonDTO>>();

  constructor(private studyService: StudyService) {
    return;
  }

  ngOnChanges(changes: SimpleChanges): void {
    for (const propertyName in changes){

      const currentValue = changes[propertyName].currentValue;
      switch (propertyName){
        // This message will toggle the given event's for a particular study.
        case "toggledStudy":
          this.toggleEventsForStudy(currentValue);
          break;
        default:
          break;
      }
    }
    return;
  }

  toggleEventsForStudy(studyDTO: StudyDTO): void {
    if (this.toggledStudies === undefined){
      this.toggledStudies = new Map<bigint, StudyDTO>();
    }
    if (!this.toggledStudies.has(studyDTO.id)){
      this.toggledStudies.set(studyDTO.id, studyDTO);
      // Send api request here
    }
    else {
      this.toggledStudies.delete(studyDTO.id);
    }
  }

  // TODO: This method still needs local identifiers to work
  getEvents(studyDTO: StudyDTO): Observable<EventJsonDTO> {
    // this.studyService.getEventData();
    console.log(`Sending request for study ${studyDTO.id}`)
    // return this.studyService.getEventData(studyDTO.id, studyDTO.);
    return EMPTY;
  }
}
