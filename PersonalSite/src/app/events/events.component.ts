import { Component, Input, Output, OnChanges, EventEmitter, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StudyDTO } from '../studies/study';
import { EventJsonDTO } from '../studies/JsonResults/EventJsonDTO';
import { Observable, tap, map } from 'rxjs';
import { StudyService } from '../studies/study.service';
import { IndividualJsonDTO } from '../studies/JsonResults/IndividualJsonDTO';
import { TagJsonDTO } from '../studies/JsonResults/TagJsonDTO';
import { isLocationSensor } from '../studies/locationSensors';
import { MatListModule } from '@angular/material/list';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { AsyncPipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { SelectionModel } from '@angular/cdk/collections';

@Component({
  selector: 'app-events',
  standalone: true,
  imports: [CommonModule, MatListModule,
    MatTabsModule, MatTableModule,
    AsyncPipe, ReactiveFormsModule, MatFormFieldModule,
    MatInputModule, MatIconModule, MatButtonModule,
    MatExpansionModule, MatTooltipModule, MatCheckboxModule],
  templateUrl: './events.component.html',
  styleUrl: './events.component.css'
})
export class EventsComponent implements OnChanges {
  // NOTE: These studies are toggled to have their events appear on the map if
  // at all possible
  toggledStudies?: Map<bigint, StudyDTO>;
  displayedColumns: string[] = ['name', 'select'];

  @Input() currentStudy: StudyDTO | undefined;

  currentLocationSensors: string[] = [];
  // These observable will hold the local identifiers which are assumed to be unique
  // currentIndividuals?: Map<string, IndividualJsonDTO>;
  currentIndividuals$?: Observable<Map<string, IndividualJsonDTO>>;
  currentTags$?: Observable<Map<string, TagJsonDTO>>;

  currentEvents: EventJsonDTO[] = [];
  @Output() studyEventEmitter = new EventEmitter<Observable<EventJsonDTO>>();

  searchForm = new FormGroup({
    filterQuery: new FormControl<string>("", { nonNullable: true }),
  });
  // NOTE: This is to be used as an input for the api call
  selection = new SelectionModel<IndividualJsonDTO>(true, []);

  constructor(private studyService: StudyService) {
    return;
  }


  ngOnChanges(changes: SimpleChanges): void {
    for (const propertyName in changes) {

      const currentValue = changes[propertyName].currentValue;
      const previousValue = changes[propertyName].previousValue;
      if (currentValue === undefined || currentValue === previousValue) {
        console.log(`Skipping undefined value for property value ${propertyName}`);
        continue;
      }
      // NOTE: The inputs currently in use are jsonPayload and currentStudy
      switch (propertyName) {
        // The current study being focused on.
        case "currentStudy":
          console.log("Recieved study in events component");
          console.info(currentValue as StudyDTO);
          this.currentStudy = currentValue as StudyDTO;
          this.currentLocationSensors = this.getLocationSensor(this.currentStudy);
          this.currentIndividuals$ = this.getIndividuals(this.currentStudy).pipe(
            // tap(map => {
            //   this.currentIndividuals = map;
            // }),
          )
          this.currentTags$ = this.getTags(this.currentStudy);
          break
        default:
          break;
      }
    }
    return;
  }

  isAllSelected(individuals?: IndividualJsonDTO[] | Map<bigint, IndividualJsonDTO>): boolean {
    if (!individuals){
      return false;
    }
    if (Array.isArray(individuals)){
      return this.selection.selected.length === individuals.length;
    } else {
      return this.selection.selected.length === individuals.size;
    }
  }

  checkBoxLabel(index: number, row?: IndividualJsonDTO): string {
    if (!row) {
      return `${this.isAllSelected() ? 'deselect' : 'select'} all`;
    }
    return `${this.selection.isSelected(row) ? 'deselect' : 'select'} row ${index + 1}`;
  }

  trackIndividuals(index: number, item: IndividualJsonDTO): string {
    return `${item.Id}`
  }

  mapToArray<T, U>(map: Map<T, U>): U[] {
    return Array.from(map.values());
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
        const ret = new Map<string, TagJsonDTO>();
        for (const individual of tags) {
          ret.set(individual.LocalIdentifier, individual);
        }
        return ret;
      }),
      tap(res => console.log(res))
    );
  }

  getIndidividualData(): void {
    if (this.currentStudy === undefined) {
      return;
    }
    this.getIndividuals(this.currentStudy).subscribe({
      next: (individuals) => {
        console.log(individuals);
      },
      error: err => console.error(err)
    });
  }
}
