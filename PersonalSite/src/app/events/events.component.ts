import { Component, Input, Output, OnChanges, EventEmitter, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StudyDTO } from '../studies/study';
import { EventJsonDTO } from '../studies/JsonResults/EventJsonDTO';
import { EMPTY, Observable, map } from 'rxjs';
import { JsonResponseData } from '../studies/JsonResults/JsonDataResponse';
import { StudyService } from '../studies/study.service';
import { IndividualJsonDTO } from '../studies/JsonResults/IndividualJsonDTO';
import { TagJsonDTO } from '../studies/JsonResults/TagJsonDTO';

@Component({
  selector: 'app-events',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './events.component.html',
  styleUrl: './events.component.css'
})
export class EventsComponent implements OnChanges {
  // NOTE: These studies are toggled to have their events appear on the map if
  // at all possible
  toggledStudies: Map<bigint, StudyDTO> | undefined;
  @Input() toggledStudy: StudyDTO | undefined;
  @Input() jsonPayload: Observable<JsonResponseData[]> | undefined;

  // NOTE: Only this input is being used
  @Input() currentStudy: StudyDTO | undefined;
  // These observable will hold the local identifiers which are assumed to be unique
  currentIndividuals$: Observable<Map<string, IndividualJsonDTO>> | undefined;
  currentTags$: Observable<Map<string, TagJsonDTO>> | undefined;


  currentEvents: EventJsonDTO[] = [];
  @Output() studyEventEmitter = new EventEmitter<Observable<EventJsonDTO>>();

  constructor(private studyService: StudyService) {
    return;
  }

  ngOnChanges(changes: SimpleChanges): void {
    for (const propertyName in changes) {

      const currentValue = changes[propertyName].currentValue;
      if (currentValue === undefined) {
        console.log(`Skipping undefined value for property value ${propertyName}`)
        continue;
      }

      switch (propertyName) {
        // This message will toggle the given event's for a particular study.
        case "toggledStudy":
          this.toggleEventsForStudy(currentValue);
          break;

        case "jsonPayload":
          // TODO: Implement a similar event to recieve actual event data
          console.log("received json payload in events component");
          this.jsonPayload = currentValue as Observable<JsonResponseData[]>;
          break;

        case "currentStudy":
          console.log("Recieved study in events component");
          this.currentStudy = currentValue as StudyDTO;
          break

        default:
          break;
      }
    }
    return;
  }

  // Refactor the use the entire DTO proproty
  getIndividuals(studyDTO: StudyDTO): void {
    this.currentIndividuals$ = this.studyService.jsonRequest("individual", studyDTO.id).pipe(
      // filter(data => data.length > 0),
      map(data => data as unknown as IndividualJsonDTO[]),
      map(individuals => {
        const map = new Map<string, IndividualJsonDTO>();
        individuals.forEach(value => map.set(value.localIdentifier, value));
        return map;
      })
    );
  }

  getTags(studyDTO: StudyDTO): void {
    this.currentTags$ = this.studyService.jsonRequest("tag", studyDTO.id).pipe(
      // filter(data => data.length > 0),
      map(data => data[0] as unknown as TagJsonDTO[]),
      map(tags => {
        const map = new Map<string, TagJsonDTO>();
        tags.forEach(value => map.set(value.localIdentifier, value));
        return map;
      })
    );
  }

  // Seperate the tagged individuals from the total number of individuals
  // s.t it is exclusively in the the tagged array
  // the individual array is made of the remaining
  combineSubscriptions(
    individuals: Map<string, IndividualJsonDTO>,
    tags: Map<string, TagJsonDTO>): [IndividualJsonDTO[], TagJsonDTO[]] {

    const unTagged: IndividualJsonDTO[] = [];
    const tagged: TagJsonDTO[] = [];

    for (const [name, value] of individuals.entries()){
      if (tags.has(name)){
        tagged.push( {type: "tag", id: value.id, localIdentifier: value.localIdentifier })
      } else {
        unTagged.push({type: "individual", id: value.id, localIdentifier: value.localIdentifier});
      }
    }
    return [unTagged, tagged];
  }

  toggleEventsForStudy(studyDTO: StudyDTO): void {
    if (this.toggledStudies === undefined) {
      this.toggledStudies = new Map<bigint, StudyDTO>();
    }
    if (!this.toggledStudies.has(studyDTO.id)) {
      this.toggledStudies.set(studyDTO.id, studyDTO);
    }
    else {
      this.toggledStudies.delete(studyDTO.id);
    }
  }

  // TODO: This method still needs local identifiers to work
  getEvents(studyDTO: StudyDTO): Observable<EventJsonDTO> {
    console.log(`Sending request for study ${studyDTO.id}`);
    return EMPTY;
  }
}
