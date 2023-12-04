import { AfterViewInit, Component, Input, OnChanges, SimpleChanges, ViewChild, WritableSignal, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StudyDTO } from '../studies/study';
import { Observable, tap, map, of, startWith, switchAll, Subject } from 'rxjs';
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
import { MatCheckboxModule } from '@angular/material/checkbox';
import { SelectionModel } from '@angular/cdk/collections';
import { checkboxOptionSelectedValidator } from './Validators/ValidateCheckbox';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { FormDataSource } from '../HelperTypes/FormDataSource';
import { MatSelectModule } from '@angular/material/select';
import { MatDividerModule } from '@angular/material/divider';

type PageState = "loaded" | "loading" | "error" | "initial";

// NOTE: Make the tableSource an array of FormControls.

@Component({
  selector: 'app-events',
  standalone: true,
  imports: [
    CommonModule, MatListModule, MatSortModule,
    MatTabsModule, MatTableModule, MatPaginatorModule,
    AsyncPipe, ReactiveFormsModule, MatFormFieldModule,
    MatInputModule, MatIconModule, MatButtonModule,
    MatExpansionModule, MatTooltipModule, MatCheckboxModule,
    MatSelectModule, MatDividerModule],
  templateUrl: './events.component.html',
  styleUrl: './events.component.css'
})
export class EventsComponent implements OnChanges, AfterViewInit {
  // NOTE: These studies are toggled to have their events appear on the map if
  // at all possible
  toggledStudies?: Map<bigint, StudyDTO>;
  displayedColumns: string[] = ['select', 'name'];
  displayedColumnsWithExpanded: string[] = [...this.displayedColumns, 'expanded'];

  @Input() currentStudy?: StudyDTO;
  currentLocationSensors: string[] = [];

  // INFO: This is a higher order observable that the emits the latest observable from
  // a http request
  allAnimals$ = new Subject<Observable<IndividualJsonDTO[]>>;
  allTaggedAnimals$ = new Subject<Observable<TagJsonDTO[]>>;

  tableSource$: Observable<IndividualJsonDTO[]> = of([]);

  tableSource = new FormDataSource(this.studyService);
  // tableSource$?: Observable<MatTableDataSource<IndividualJsonDTO>>;
  currentTagged$: Observable<TagJsonDTO[]> = of([]);

  allToggles: WritableSignal<boolean[]> = signal([]);
  currentIndividuals: WritableSignal<IndividualJsonDTO[]> = signal([]);
  pageState: WritableSignal<PageState> = signal("initial" as const);
  // @Output() studyEventEmitter = new EventEmitter<Observable<EventJsonDTO>>();

  // @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;
  // The formGroup has the checkboxes formArray and the following validators.
  // FormGroup<{checkboxes: FormArray<FormControl<boolean>>;}>

  // TODO: Update formGroup for new fields.
  eventForm = this.formBuilder.nonNullable.group({
    checkboxes: this.formBuilder.nonNullable.array([] as boolean[]),
  }, {
    validators: checkboxOptionSelectedValidator(),
    updateOn: "change"
  });

  // NOTE: This is to be used as an input for the api call
  selectionModel = new SelectionModel<number>(true, []);

  constructor(
    private studyService: StudyService,
    private formBuilder: FormBuilder) {
    this.initializeTableSource();
  }

  initializeTableSource(): void {
    this.tableSource$ = this.allAnimals$.pipe(
      startWith([]),
      switchAll(),
      tap(arr => {
        console.log(arr);
        this.currentIndividuals.set(arr);
        // NOTE: This array is probably redundant.
        this.allToggles.set(arr.map(() => false));
        this.InitializeFormArray(arr);
        this.pageState.set("loaded");

      }),

    );
  }

  initializeTaggedSource(): void {
    this.currentTagged$ = this.allTaggedAnimals$.pipe(
      startWith([]),
      switchAll(),
    );
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
      // TODO: Set the aria labels for other components.
      // Performance issues are caused by not using attributes that react to changes.
      switch (propertyName) {
        // The current study being focused on.
        case "currentStudy":
          this.allAnimals$.next(of([]));
          this.selectionModel.clear();
          this.pageState.set("loading");

          this.currentStudy = currentValue as StudyDTO;
          this.currentLocationSensors = this.getLocationSensor(this.currentStudy);

          // TODO: Refactor this file to switch to using table source and the formgroup only.
          this.tableSource.getAnimalData(this.currentStudy.id, "asc");
          this.allAnimals$.next(this.getIndividualsArray(currentValue as StudyDTO));
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

  InitializeFormArray(individuals: IndividualJsonDTO[]): void {
    this.eventForm.markAsPristine();
    this.eventForm.controls.checkboxes.reset();
    for (let i = 0; i < individuals.length; i++) {
      const formControl = new FormControl<boolean>(false, { nonNullable: true });
      this.eventForm.controls.checkboxes.push(formControl);
    }
  }

  get CheckboxForm(): FormArray<FormControl<boolean>> {
    return this.eventForm.controls.checkboxes;
  }

  // INFO: This section includes methods for the selection of rows
  checkboxLabel(index?: number, row?: IndividualJsonDTO): string {
    console.log(`Calling checkboxLabel with index = ${index} row = ${row?.LocalIdentifier}`);
    if (!row || index === undefined) {
      return `${this.isAllSelected() ? 'deselect' : 'select'} all`;
    }
    return `${this.selectionModel.isSelected(index) ? 'deselect' : 'select'} row ${index + 1}`;
  }

  isAllSelected(): boolean {
    if (!this.tableSource$) {
      return false;
    }
    return this.currentIndividuals().length === this.selectionModel.selected.length;
  }

  toggleRow(index: number): void {
    if (index < 0 || index >= this.allToggles().length) {
      return;
    }

    this.selectionModel.toggle(index);
    this.allToggles.update(prev => {
      prev[index] = this.selectionModel.isSelected(index);
      return prev;
    });

    this.CheckboxForm.controls[index].setValue(this.selectionModel.isSelected(index));
    this.CheckboxForm.markAsDirty();
  }

  toggleAllRows() {
    if (this.isAllSelected()) {
      this.selectionModel.clear();
      this.allToggles.update(prev => {
        for (let i = 0; i < prev.length; i++) {
          prev[i] = false;
        }
        this.eventForm.markAsDirty();
        return prev;
      });
      this.CheckboxForm.controls.forEach(formControl => {
        formControl.patchValue(false);
      })
      return;
    }
    this.selectionModel.select(...this.allToggles().map((_, i) => i));
    this.allToggles.update(prev => {
      for (let i = 0; i < prev.length; i++) {
        prev[i] = true;
      }
      return prev;
    });
    this.CheckboxForm.controls.forEach(formControl => {
      formControl.patchValue(true);
    });
    this.eventForm.markAsDirty();
  }

  // INFO: The row is tracked by the individual local identifier.
  trackById(index: number, item: FormControl<[boolean, string]>): string {
    return `${item.value[1]}`;
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

  getIndividualsArray(studyDTO: StudyDTO): Observable<IndividualJsonDTO[]> {
    return this.studyService.jsonRequest("individual" as const, studyDTO.id).pipe(
      map(data => data as IndividualJsonDTO[])
    );
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
