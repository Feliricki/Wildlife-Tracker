import { AfterViewInit, Component, Input, OnChanges, Signal, SimpleChanges, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StudyDTO } from '../studies/study';
import { Observable, Subject } from 'rxjs';
import { StudyService } from '../studies/study.service';
import { IndividualJsonDTO } from '../studies/JsonResults/IndividualJsonDTO';
import { TagJsonDTO } from '../studies/JsonResults/TagJsonDTO';
import { isLocationSensor } from '../studies/locationSensors';
import { MatListModule } from '@angular/material/list';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { AsyncPipe } from '@angular/common';
import { FormArray, FormBuilder, FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCheckboxChange, MatCheckboxModule } from '@angular/material/checkbox';
import { checkboxOptionSelectedValidator } from './Validators/ValidateCheckbox';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { FormDataSource, SourceState } from '../HelperTypes/FormDataSource';
import { MatSelectModule } from '@angular/material/select';
import { MatDividerModule } from '@angular/material/divider';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';

export type EventProfiles = null | "EURING_01" | "EURING_02" | "EURING_03" | "EURING_04";

// NOTE: Make the tableSource an array of FormControls.

@Component({
  selector: 'app-events',
  standalone: true,
  imports: [
    CommonModule, MatListModule, MatSortModule, MatNativeDateModule,
    MatTabsModule, MatTableModule, MatPaginatorModule,
    AsyncPipe, ReactiveFormsModule, MatFormFieldModule,
    MatInputModule, MatIconModule, MatButtonModule,
    MatExpansionModule, MatTooltipModule, MatCheckboxModule,
    MatSelectModule, MatDividerModule, MatDatepickerModule],
  templateUrl: './events.component.html',
  styleUrl: './events.component.css'
})
export class EventsComponent implements OnChanges, AfterViewInit {
  // NOTE: These studies are toggled to have their events appear on the map if
  // at all possible
  toggledStudies?: Map<bigint, StudyDTO>;
  // displayedColumns: string[] = ['select', 'name'];
  displayedColumns: string[] = ['name', 'select'];
  displayedColumnsWithExpanded: string[] = [...this.displayedColumns, 'expanded'];

  @Input() currentStudy?: StudyDTO;
  currentLocationSensors: string[] = [];

  // INFO: This is a higher order observable that the emits the latest observable from
  // a http request
  allAnimals$ = new Subject<Observable<IndividualJsonDTO[]>>;
  allTaggedAnimals$ = new Subject<Observable<TagJsonDTO[]>>;

  // @Output() studyEventEmitter = new EventEmitter<Observable<EventJsonDTO>>();

  @ViewChild(MatSort) sort!: MatSort;
  eventForm = this.formBuilder.nonNullable.group({

    dateRange: this.formBuilder.group({
      start: this.formBuilder.control(null as null | Date),
      end: this.formBuilder.control(null as null | Date),
    }),
    eventProfiles: this.formBuilder.control(null as EventProfiles),
    checkboxes: new FormArray<FormControl<boolean>>([]),
  }, {
    validators: checkboxOptionSelectedValidator(),
    updateOn: "change"
  });

  tableSource = new FormDataSource(this.studyService, this.CheckboxForm);

  constructor(
    private studyService: StudyService,
    private formBuilder: FormBuilder) {
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

      // TODO: Set the aria labels for other components.
      switch (propertyName) {
        case "currentStudy":
          console.log(currentValue);
          this.currentStudy = currentValue as StudyDTO;
          this.tableSource.getAnimalData(this.currentStudy.id, "asc");
          this.eventForm.markAsPristine();
          break

        default:
          break;
      }
    }
    return;
  }

  ngAfterViewInit(): void {
    return;
  }

  get dateRange() {
    return this.eventForm.controls.dateRange;
  }

  get eventProfiles() {
    return this.eventForm.controls.eventProfiles;
  }

  get CheckboxForm(): FormArray<FormControl<boolean>> {
    return this.eventForm.controls.checkboxes;
  }


  checkboxLabel(index?: number): string {
    if (index == undefined) {
      return `${this.isAllSelected() ? 'deselect' : 'select'} all`;
    }
    return `${this.tableSource.isSelected(index) ? 'deselect' : 'select'} row ${index + 1}`;
  }

  get TableState(): Signal<SourceState> {
    return this.tableSource.TableState;
  }

  get isAllSelected(): Signal<boolean> {
    return this.tableSource.IsAllSelected;
  }

  getIndividual(index: number): Signal<IndividualJsonDTO | null> {
    return this.tableSource.getIndividual(index);
  }

  toggleRow(index: number, event?: MatCheckboxChange): void {
    console.log("toggling row");
    if (event) {
      console.log(event);
    }
    this.tableSource.toggleRow(index);
  }

  toggleAllRows() {
    console.log("toggling all rows");
    this.tableSource.toggleAllRows();
    this.eventForm.markAsDirty();
  }

  isSelected(index: number): Signal<boolean> {
    return this.tableSource.isSelected(index);
  }

  // INFO: The row is tracked by the individual local identifier.
  trackById(index: number, form: FormControl<boolean>): string {
    console.log(`tracking by index ${index} and value ${form.value}`);
    return `${index}`;
  }

  mapToArray<T, U>(map: Map<T, U>): U[] {
    return Array.from(map.values());
  }

  get hasValue(): Signal<boolean> {
    return this.tableSource.HasValue;
  }

  isTagged(localIdentifier: string): Signal<boolean> {
    return this.tableSource.isTagged(localIdentifier);
  }

  get Individuals(): Signal<Map<string, IndividualJsonDTO>> {
    return this.tableSource.allIndividuals;
  }

  get TaggedIndividuals(): Signal<Map<string, TagJsonDTO>> {
    return this.tableSource.allTaggedIndividuals;
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

}
