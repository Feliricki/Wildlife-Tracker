import { Component, Input, Output, OnChanges, EventEmitter, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StudyDTO } from '../studies/study';
import { EventJsonDTO } from '../studies/JsonResults/EventJsonDTO';
import { EMPTY, Observable, tap, concatMap, map } from 'rxjs';
import { StudyService } from '../studies/study.service';
import { IndividualJsonDTO } from '../studies/JsonResults/IndividualJsonDTO';
import { TagJsonDTO } from '../studies/JsonResults/TagJsonDTO';
import { isLocationSensor } from '../studies/locationSensors';
import { MatListModule } from '@angular/material/list';

@Component({
  selector: 'app-events',
  standalone: true,
  imports: [CommonModule, MatListModule],
  templateUrl: './events.component.html',
  styleUrl: './events.component.css'
})
export class EventsComponent implements OnChanges {
  // NOTE: These studies are toggled to have their events appear on the map if
  // at all possible
  toggledStudies: Map<bigint, StudyDTO> | undefined;

  @Input() currentStudy: StudyDTO | undefined;
  // This input is used to signal an event request orignating from the info window component.
  @Input() eventRequest: StudyDTO| undefined;

  currentLocationSensors: string[] = [];
  // These observable will hold the local identifiers which are assumed to be unique
  currentIndividuals$: Observable<Map<string, IndividualJsonDTO>> | undefined;
  currentTags$: Observable<Map<string, TagJsonDTO>> | undefined;
  currentSubscriptions$: Observable<[Map<string, IndividualJsonDTO>, Map<string, TagJsonDTO>]> | undefined;


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
      // NOTE: The inputs currently in use are jsonPayload and currentStudy
      switch (propertyName) {
        // The current study being focused on.
        case "currentStudy":
          console.log("Recieved study in events component");
          this.currentStudy = currentValue as StudyDTO;
          this.currentLocationSensors = this.getLocationSensor(this.currentStudy);
          this.currentSubscriptions$ = this.combineSubscriptions(this.currentStudy);
          break
        case "eventRequest":
          console.log("Received event request in events component.");
          this.eventRequest = currentValue as StudyDTO;
          break;

        default:
          break;
      }
    }
    return;
  }

  getLocationSensor(studyDTO: StudyDTO): string[] {

    if (studyDTO.sensorTypeIds === undefined || studyDTO.sensorTypeIds.length === 0) {
      return [];
    }
    const splitList = studyDTO.sensorTypeIds.trim()
      .split(",")
      .map(sensor => sensor.trim());

    const locationSensors: string[] = [];
    splitList.forEach(sensor => {
      if (isLocationSensor(sensor)) {
        locationSensors.push(sensor);
      }
    });

    return locationSensors;
  }


  // Refactor the use the entire DTO proproty
  getIndividuals(studyDTO: StudyDTO): Observable<Map<string, IndividualJsonDTO>> {
    const retVal = this.studyService.jsonRequest("individual" as const, studyDTO.id).pipe(
      map(data => data as IndividualJsonDTO[]),
      map(individuals => {
        console.log(individuals);
        const ret = new Map<string, IndividualJsonDTO>();
        for (const individual of individuals) {
          ret.set(individual.LocalIdentifier, individual);
        }
        return ret;
      }),
      tap(res => console.log(res)),
    );
    return retVal;
  }


  getTags(studyDTO: StudyDTO): Observable<Map<string, TagJsonDTO>> {
    return this.studyService.jsonRequest("tag" as const, studyDTO.id).pipe(
      map(data => data as TagJsonDTO[]),
      map(tags => {
        console.log(tags);
        const ret = new Map<string, TagJsonDTO>();
        for (const individual of tags) {
          ret.set(individual.LocalIdentifier, individual);
        }
        return ret;
      }),
      tap(res => console.log(res))
    );
  }

  // NOTE: This functions combines the result of getIndividuals and getTags
  // into one observable for ease of use in templating
  combineSubscriptions(studyDTO: StudyDTO): Observable<[Map<string, IndividualJsonDTO>, Map<string, TagJsonDTO>]> {

    return this.getIndividuals(studyDTO).pipe(

      concatMap(individuals => {
        return this.getTags(studyDTO).pipe(
          map(tagged => {

            const unTagged = new Map<string, IndividualJsonDTO>();
            for (const individual in individuals.keys()) {
              if (!tagged.has(individual)) {
                unTagged.set(individual, individuals.get(individual)!)
              }
            }
            return [unTagged, tagged] as [Map<string, IndividualJsonDTO>, Map<string, TagJsonDTO>];
          }),
        );
      }),
    );
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
