import { AfterViewInit, Component, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output, Signal, SimpleChanges, ViewChild, WritableSignal, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StudyDTO } from '../studies/study';
import { StudyService } from '../studies/study.service';
import { IndividualJsonDTO } from '../studies/JsonResults/IndividualJsonDTO';
import { TagJsonDTO } from '../studies/JsonResults/TagJsonDTO';
import { filterForLocationsSensors } from '../studies/locationSensors';
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
import { dateRangeValidators } from './Validators/dateRangeValidator';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { maxEventsValidator } from './Validators/maxEventsValidator';
import { sensorValidator } from './Validators/SensorValidator';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { Observable, Subscription, distinctUntilChanged, map, tap } from 'rxjs';
import { MatSliderModule } from '@angular/material/slider';
import { EventOptions, EventProfiles } from '../studies/EventOptions';
import { NonEmptyArray } from '../HelperTypes/NonEmptyArray';
import { MAX_EVENTS } from './Validators/maxEventsValidator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { LineStringFeatureCollection, LineStringMetaData, LineStringProperties } from '../deckGL/GoogleOverlay';
import { HttpResponse } from '@angular/common/http';
import { EventRequest } from '../studies/EventRequest';


@Component({
  selector: 'app-events',
  standalone: true,
  imports: [
    CommonModule, MatListModule, MatSortModule, MatNativeDateModule,
    MatTabsModule, MatTableModule, MatPaginatorModule,
    AsyncPipe, ReactiveFormsModule, MatFormFieldModule,
    MatInputModule, MatIconModule, MatButtonModule,
    MatExpansionModule, MatTooltipModule, MatCheckboxModule,
    MatSelectModule, MatDividerModule, MatDatepickerModule,
    MatSlideToggleModule, MatSliderModule, MatProgressBarModule],
  templateUrl: './events.component.html',
  styleUrl: './events.component.scss'
})
export class EventsComponent implements OnInit, OnChanges, AfterViewInit, OnDestroy {
  // NOTE: These studies are toggled to have their events appear on the map if
  // at all possible
  // Switch to using tagged individuals as the main source.
  readonly MAX_EVENTS_LIMIT = MAX_EVENTS;

  toggledStudies?: Map<bigint, StudyDTO>;
  displayedColumns: string[] = ['name', 'select'];
  displayedColumnsWithExpanded: string[] = [...this.displayedColumns, 'expanded'];

  @Input() currentStudy?: StudyDTO;
  currentSortOrder: 'asc' | 'desc' = 'asc';
  currentLocationSensors: WritableSignal<string[]> = signal([]);

  @Output() closeRightNavEmitter = new EventEmitter<true>(true);
  @Output() lineDataEmitter = new EventEmitter<Observable<HttpResponse<LineStringFeatureCollection[] | null>>>;
  @Output() fetchRequestEmitter = new EventEmitter<Request>();

  @ViewChild(MatSort) sort!: MatSort;

  maxEventsToggle: WritableSignal<boolean> = signal(true);

  eventForm = this.formBuilder.nonNullable.group({

    // This field will go unused.
    maxEvents: new FormControl<number | null>(
      0,
      { nonNullable: false }),

    dateRange: this.formBuilder.group({
      start: this.formBuilder.control(null as null | Date),
      end: this.formBuilder.control(null as null | Date),
    }),
    eventProfiles: this.formBuilder.control(null as EventProfiles),

    sensorForm: this.formBuilder.control(null as null | string),

    checkboxes: new FormArray<FormControl<boolean>>([]),
  }, {
    validators: [
      checkboxOptionSelectedValidator(),
      dateRangeValidators(),
      maxEventsValidator(),
      sensorValidator()],
    updateOn: "change"
  });

  tableSource = new FormDataSource(this.studyService, this.CheckboxForm);
  tableState$?: Observable<SourceState>;
  tableStateSubscription?: Subscription;

  // TODO: Aria label needs to be for accessibility purposes.
  smallTabSize = {
    'min-width': '150px',
    'max-width': '500px',
  }

  largeTabSize = {
    'width': '500px',
  }

  fourthRowSmall = {
    'justify-content': 'left'
  }

  fourthRowDefault = {
    'justify-content': 'space-between',
    'margin-left': '1em',
    'margin-right': '1em',
  }

  breakpointSubscription?: Subscription;
  screenChange?: Observable<boolean>;
  extraSmallScreenChange?: Observable<boolean>;
  screenChangeSignal: WritableSignal<boolean> = signal(false);

  constructor(
    private studyService: StudyService,
    private formBuilder: FormBuilder,
    private breakpointObserver: BreakpointObserver
  ) {
    return;
  }

  ngOnInit(): void {
    this.eventForm.disable();
    this.tableState$ = this.tableSource.DataStateAsObservable.pipe(
      distinctUntilChanged(),
      tap(value => {
        console.log(`Current tableState is ${value}`);
        switch (value) {
          case "loading":
            this.eventForm.disable();
            break;
          case "loaded":
            this.eventForm.markAsPristine();
            this.eventForm.enable();
            this.sensorForm.setValue(this.currentLocationSensors().at(0) ?? null);
            // this.MaxEvents.setValue(10);
            break;
          case "error":
            this.eventForm.disable();
            break;
          case "initial":
            this.eventForm.disable();
            break;
          default:
            break;
        }
      }),
    );
    this.tableStateSubscription = this.tableState$.subscribe();

    this.screenChange =
      this.breakpointObserver.observe([Breakpoints.XSmall, Breakpoints.Small])
        .pipe(
          map(state => state.matches),
          tap(state => {
            this.screenChangeSignal.set(state);
          })
        );

    this.extraSmallScreenChange =
      this.breakpointObserver.observe(Breakpoints.XSmall)
        .pipe(
          map(state => state.matches)
        );

  }

  isSticky(): boolean {
    return true;
  }

  ngOnChanges(changes: SimpleChanges): void {

    for (const propertyName in changes) {
      const currentValue = changes[propertyName].currentValue;
      const previousValue = changes[propertyName].previousValue;
      if (currentValue === undefined || currentValue === previousValue) {
        continue;
      }

      // TODO: Set the aria labels for other components.
      switch (propertyName) {
        case "currentStudy":
          this.eventForm.disable();

          console.log(currentValue);
          this.currentStudy = currentValue as StudyDTO;
          this.currentLocationSensors.set(filterForLocationsSensors(this.currentStudy?.sensorTypeIds));
          this.tableSource.getAnimalData(this.currentStudy.id, this.currentSortOrder);
          break

        default:
          break;
      }
    }
    return;
  }

  ngOnDestroy(): void {
    this.breakpointSubscription?.unsubscribe();
    this.tableStateSubscription?.unsubscribe();
  }

  closeRightNav(): void {
    this.closeRightNavEmitter.emit(true);
  }

  ngAfterViewInit(): void {
    return;
  }

  stringToNumber(num: string): number {
    return Number(num);
  }

  setMaxEventsValue(value: number) {
    this.MaxEvents.setValue(value);
  }

  get formEnabled(): Signal<boolean> {
    return computed(() => {
      return this.TableState() === "loaded"
    })
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

  get MaxEvents(): FormControl<number | null> {
    return this.eventForm.controls.maxEvents;
  }

  get sensorForm(): FormControl<string | null> {
    return this.eventForm.controls.sensorForm;
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

  updateState(): void {
    this.tableSource;
  }

  // toggleMaxEvents(): void {
  //   this.maxEventsToggle.update(prev => !prev);
  //   if (this.maxEventsToggle()) {
  //     this.MaxEvents.disable();
  //   } else {
  //     this.MaxEvents.enable();
  //   }
  // }

  getIndividual(index: number): Signal<TagJsonDTO | IndividualJsonDTO | null> {
    return this.tableSource.getIndividual(index);
  }

  toggleRow(index: number, event?: MatCheckboxChange): void {
    if (event) {
      console.log(event);
    }
    this.tableSource.toggleRow(index);
  }

  toggleAllRows() {
    // console.log("toggling all rows");
    this.tableSource.toggleAllRows();
    this.eventForm.markAsDirty();
  }

  sortChange(): void {
    if (!this.currentStudy) {
      return;
    }
    this.currentSortOrder = this.currentSortOrder === 'asc' ? 'desc' : 'asc';
    this.tableSource.getAnimalData(this.currentStudy.id, this.currentSortOrder);
  }

  isSelected(index: number): Signal<boolean> {
    return this.tableSource.isSelected(index);
  }

  trackById(index: number) {
    // console.log(`Tracking index ${index}`);
    return index;
  }

  mapToArray<T, U>(map: Map<T, U>): U[] {
    return Array.from(map.values());
  }

  isTagged(localIdentifier: string): Signal<boolean> {
    return this.tableSource.isTagged(localIdentifier);
  }

  get hasValue(): Signal<boolean> {
    return computed(() => this.tableSource.HasValue() && this.TableState() === "loaded");
  }

  get Individuals(): Signal<Map<string, IndividualJsonDTO>> {
    return this.tableSource.allIndividuals;
  }

  get TaggedIndividuals(): Signal<Map<string, TagJsonDTO>> {
    return this.tableSource.allTaggedIndividuals;
  }

  // TODO: This form is better of being sent to another component.
  // It should probably be sent to the google maps component.
  submitForm() {
    console.log(`EventForm State: ${this.eventForm.valid}`);

    if (this.eventForm.invalid) {
      return;
    }
    if (!this.currentStudy || this.TableState() !== "loaded"
      || this.sensorForm.value == null) {
      return;
    }

    const studyId = this.currentStudy.id;
    const localIdentifiers = this.tableSource.taggedAndSelectedIndividuals() as NonEmptyArray<string>;

    const sensor = this.sensorForm.value;
    const geometryType = "linestring";


    const eventOptions: EventOptions = {
      // maxEventsPerIndividual: this.MaxEvents.valid ? this.MaxEvents.value ?? undefined : undefined,
      maxEventsPerIndividual: undefined,
      timestampStart: this.dateRange.valid ? this.timeStampHelper(this.dateRange.controls.start.value) : undefined,
      timestampEnd: this.dateRange.valid ? this.timeStampHelper(this.dateRange.controls.end.value) : undefined,
      attributes: undefined,
      eventProfile: this.eventProfiles.valid ? this.eventProfiles.value : undefined,
    };

    const eventRequest: EventRequest = {
      studyId: studyId,
      localIdentifiers: localIdentifiers,
      sensorType: sensor,
      geometryType: geometryType,
      options: eventOptions,
    };

    console.log(JSON.stringify(eventRequest));

    const request = this.studyService.
      getGeoJsonEventData<GeoJSON.LineString, LineStringProperties, LineStringMetaData>
      (eventRequest);
    const fetchRequest = this.studyService.getGeoJsonFetchRequest(eventRequest);

    this.sendEventMessage(request);
    this.sendFetchRequest(fetchRequest);
    // TODO: Consider if an observable or the actual data should be sent to the current
    // map component.
  }

  sendEventMessage(request: Observable<HttpResponse<LineStringFeatureCollection[] | null>>): void {
    console.log("Sending event message in events component");
    this.lineDataEmitter.emit(request);
  }

  sendFetchRequest(request: Request): void {
    this.fetchRequestEmitter.emit(request);
  }

  timeStampHelper(date: Date | null): bigint | undefined {
    if (date === null) {
      return undefined;
    }
    return BigInt(date.valueOf());
  }
}
