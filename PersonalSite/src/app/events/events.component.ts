import { AfterViewInit, ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output, Signal, SimpleChanges, ViewChild, WritableSignal, computed, signal } from '@angular/core';
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
import { FormArray, FormBuilder, FormControl, ReactiveFormsModule, FormsModule } from '@angular/forms';
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
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { sensorValidator } from './Validators/SensorValidator';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { Observable, Subscription, distinctUntilChanged, map, tap } from 'rxjs';
import { MatSliderModule } from '@angular/material/slider';
import { EventOptions, EventProfiles } from '../studies/EventOptions';
import { NonEmptyArray } from '../HelperTypes/NonEmptyArray';
import { MAX_EVENTS } from './Validators/maxEventsValidator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
// import { LineStringFeatureCollection, LineStringMetaData, LineStringPropertiesV1 } from "../deckGL/GeoJsonTypes";
// import { HttpResponse } from '@angular/common/http';
import { EventRequest } from '../studies/EventRequest';
import { MatCardModule } from '@angular/material/card';
import { MatBadgeModule } from '@angular/material/badge';
import { LayerTypes, OverlayPathOptions, OverlayPointOptions, StreamStatus } from '../deckGL/GoogleOverlay';
import { EventMetaData } from './EventsMetadata';
import { LayerTypesHelper } from '../deckGL/OverlayOption';
import { AggregationOverlayOptions, PointOverlayOptions, PathOverlayOptions, PointForms, PathForms, AggregationForms } from '../tracker-view/OverlayOptions';

export type RGBAColor = [number, number, number, number];
export type ActiveForm = "point" | "path" | "aggregation";
// type ColorTypes = RGBAColor | [number, number, number];
// type Range = [number, number];

@Component({
  selector: 'app-events',
  standalone: true,
  imports: [
    MatTableModule, CommonModule, MatListModule,
    MatSortModule, MatNativeDateModule, MatTabsModule,
    MatPaginatorModule, AsyncPipe, ReactiveFormsModule,
    MatInputModule, MatIconModule, MatButtonModule, FormsModule,
    MatExpansionModule, MatTooltipModule, MatSelectModule,
    MatDividerModule, MatDatepickerModule, MatBadgeModule,
    MatSlideToggleModule, MatSliderModule, MatProgressBarModule,
    MatCardModule, MatCheckboxModule, MatFormFieldModule
  ],
  templateUrl: './events.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './events.component.scss'
})
export class EventsComponent implements OnInit, OnChanges, AfterViewInit, OnDestroy {
  // NOTE: These studies are toggled to have their events appear on the map if
  // at all possible
  // Switch to using tagged individuals as the main source.
  readonly MAX_EVENTS_LIMIT = MAX_EVENTS;

  toggledStudies?: Map<bigint, StudyDTO>;
  // displayedColumns: string[] = ['name', 'select'];
  displayedColumns: string[] = ['select', 'name'];
  displayedColumnsWithExpanded: string[] = [...this.displayedColumns, 'expanded'];

  @Input() currentStudy?: StudyDTO;

  // INFO:This section contains metadata on events from the maps component.
  // and the outputs from the wouldbe overlay controls
  // Consider if the controls should be made into a proper reative form.
  @Input() currentEventData?: EventMetaData;
  @Output() pathOverlayOptions = new EventEmitter<OverlayPathOptions>();
  @Output() pointOverlayOptions = new EventEmitter<OverlayPointOptions>();

  currentSortOrder: 'asc' | 'desc' = 'asc';
  currentLocationSensors: WritableSignal<string[]> = signal([]);
  currentActiveForms: WritableSignal<ActiveForm> = signal("path");

  @Output() closeRightNavEmitter = new EventEmitter<true>(true);
  @Output() eventRequestEmitter = new EventEmitter<EventRequest>();

  @ViewChild(MatSort) sort!: MatSort;

  maxEventsToggle: WritableSignal<boolean> = signal(true);

  // NOTE: The following section is meant to communicate with the map component and then the overlay controls.
  @Output() overlayOptionsEmitter = new EventEmitter<PointOverlayOptions | AggregationOverlayOptions | PathOverlayOptions>();
  eventForm = this.formBuilder.nonNullable.group({

    eventProfiles: this.formBuilder.control(null as EventProfiles),
    sensorForm: this.formBuilder.control(null as null | string),
    checkboxes: new FormArray<FormControl<boolean>>([]),

  }, {
    validators: [
      checkboxOptionSelectedValidator(),
      sensorValidator()
    ],
    updateOn: "change"
  });

  // TODO:The number of options needs to be cut down signficantly.
  // Consider the following:
  // 1) Rewrite these forms to match the types in the OverlayOptions.ts file
  // 2) making a base form for each layer type.
  //  This is necessary since some values can carried over onto other forms types.
  // 3) Make the form array initially empty.
  // 4) reconsider the default options
  pointOverlayControls = this.formBuilder.nonNullable.group({
    individual: this.formBuilder.array([
      this.formBuilder.group({

        currentIndividual: this.formBuilder.nonNullable.control(null as null | string),
        getRadius: this.formBuilder.nonNullable.control(3),
        filled: this.formBuilder.nonNullable.control(true),

        autoHighlight: this.formBuilder.nonNullable.control(true),

        opacity: this.formBuilder.nonNullable.control(0.8),
        focusLevel: this.formBuilder.nonNullable.control(1.0),

        radiusMinPixels: this.formBuilder.nonNullable.control(1),
        radiusMaxPixels: this.formBuilder.nonNullable.control(100),

        getFillColor: this.formBuilder.nonNullable.control([0, 0, 0, 255] as RGBAColor),
        getLineColor: this.formBuilder.nonNullable.control([0, 0, 0, 255] as RGBAColor),
      } as PointForms)
    ])
  });

  // pointOverlayControls = this.formBuilder.nonNullable.group({
  //   individual: this.formBuilder.array([] as Array<FormGroup<PointForms>>),
  // });

  pathOverlayControls = this.formBuilder.nonNullable.group({
    individual: this.formBuilder.array([
      this.formBuilder.group({

        currentIndividual: this.formBuilder.nonNullable.control(null as null | string),
        widthScale: this.formBuilder.nonNullable.control(1),

        opacity: this.formBuilder.nonNullable.control(0.8),

        widthMinPixels: this.formBuilder.nonNullable.control(1),
        widthMaxPixels: this.formBuilder.nonNullable.control(Number.MAX_SAFE_INTEGER),

        getSourceColor: this.formBuilder.nonNullable.control([0, 0, 0, 255] as RGBAColor),
        getTargetColor: this.formBuilder.nonNullable.control(null as RGBAColor | null),

        focusLevel: this.formBuilder.nonNullable.control(1.0),
        autoHighlight: this.formBuilder.nonNullable.control(true),
      } as PathForms)
    ])
  });

  // TODO:The default values need to be checked in the overlay controls file.
  aggregationOverlayControls = this.formBuilder.nonNullable.group({
    individual: this.formBuilder.array([
      this.formBuilder.group({
        currentIndividual: this.formBuilder.nonNullable.control(null as null | string),
        radius: this.formBuilder.nonNullable.control(1),

        elevationRange: this.formBuilder.nonNullable.control([0, 1000] as [number, number]),
        elevationScale: this.formBuilder.nonNullable.control(1),

        lowerPercentile: this.formBuilder.nonNullable.control(0),
        upperPercentile: this.formBuilder.nonNullable.control(100),

        elevationLowerPercentile: this.formBuilder.nonNullable.control(0),
        elevationUpperPercentile: this.formBuilder.nonNullable.control(100),

        elevationAggregation: this.formBuilder.nonNullable.control("SUM" as "SUM" | "MEAN" | "MAX" | "MIN"),

        colorScaleType: this.formBuilder.nonNullable.control(null as "quantize" | "quantile" | "ordinal" | null),
        colorAggregation: this.formBuilder.nonNullable.control("SUM" as "SUM" | "MEAN" | "MAX" | "MIN"),

        getColorWeight: this.formBuilder.nonNullable.control(1),
        getElevationWeight: this.formBuilder.nonNullable.control(1),
      } as AggregationForms)
    ])
  })

  tableSource = new FormDataSource(this.studyService, this.CheckboxForm);
  tableState$?: Observable<SourceState>;
  tableStateSubscription?: Subscription;

  smallTabSize = {
    // 'min-width': '150px',
    // 'max-width': '290px',
  }

  largeTabSize = {
    // 'width': '290px',
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

  // TODO: Think about sorting this collection so
  // that new chunks can be appended to the list of individuals.
  currentIndividuals: string[] = [];
  badgeHidden: boolean = true;
  @Input() streamStatus?: StreamStatus;

  // INFO:This group contains the overlay controls; one for each individual.

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
        switch (value) {
          case "loading":
            this.eventForm.disable();
            break;
          case "loaded":
            this.eventForm.markAsPristine();
            this.eventForm.enable();
            this.sensorForm.setValue(this.currentLocationSensors().at(0) ?? null);
            console.log("All individuals are loaded (tracker component)");
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

      // TODO: Work to be done
      // 1) Implement the actual controls
      // 2) Set up the link from the events component to the maps component (the other way)
      switch (propertyName) {
        case "currentStudy":
          this.eventForm.disable();
          this.currentStudy = currentValue as StudyDTO;
          this.currentLocationSensors.set(filterForLocationsSensors(this.currentStudy?.sensorTypeIds));
          this.tableSource.getAnimalData(this.currentStudy.id, this.currentSortOrder);
          break

        case "streamStatus":
          this.streamStatus = currentValue as StreamStatus;
          console.log(`Streaming status is ${this.streamStatus} in events component.`);

          switch (this.streamStatus) {
            case "standby":
              break;
            case "streaming":
              // NOTE: This case refreshes the current individuals loaded
              // by the stream.
              this.currentIndividuals = [];
              break;
            case "error":
              this.currentEventData = undefined;
              this.currentIndividuals = [];
              break;
          }
          break;

        case "currentEventData":
          console.log(`Received new chunk in events component.`);
          console.log(currentValue);

          this.currentEventData = currentValue as EventMetaData;
          this.currentIndividuals =
            Array.from(
              this.currentEventData
                .currentIndividuals
                .values())
              .sort();

          this.badgeHidden = true;

          break;

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

  isPathLayer(layer: LayerTypes): boolean {
    return LayerTypesHelper.isPathTypeLayer(layer);
  }

  isPointLayer(layer: LayerTypes): boolean {
    return LayerTypesHelper.isPointTypeLayer(layer);
  }

  isAggregationLayer(layer: LayerTypes): boolean {
    return LayerTypesHelper.isAggregationLayer(layer);
  }

  submitPointLayerForm(index: number): void {
    if (index < 0 || index >= this.pathOverlayControls.controls.individual.controls.length) {
      return;
    }

    const formGroup = this.pointOverlayControls.controls.individual.controls[index];
    if (formGroup.invalid) {
      return;
    }

    // TODO:Fix this.
    this.overlayOptionsEmitter.emit({
      type: "pointOverlayOptions",
      currentIndividual: formGroup.controls.currentIndividual.value,

      opacity: formGroup.controls.opacity.value,
      getRadius: formGroup.controls.getRadius.value,

      radiusMinPixels: formGroup.controls.radiusMinPixels.value,
      radiusMaxPixels: formGroup.controls.radiusMaxPixels.value,

      getFillColor: formGroup.controls.getFillColor.value,
      getLineColor: formGroup.controls.getLineColor.value,

    } as PointOverlayOptions);
  }

  // TODO: Create a custom type to hold the requested information.
  // Uncomment this later. Also rewrite the aggregation form submission method later.
  submitPathLayer(index: number): void {
    if (index < 0 || index >= this.pathOverlayControls.controls.individual.controls.length) {
      return;
    }

    const formGroup = this.pathOverlayControls.controls.individual.controls[index];
    if (formGroup.invalid) {
      return;
    }
    // INFO:The categeries are path, point and aggregation types.
    // this.overlayOptionsEmitter.emit({
    //   type: "pathOverlayOptions",
    //   currentIndividual: formGroup.controls.individual.value ?? "None",
    //   getWidth: formGroup.controls.getWidth.value,
    //
    //   opacity: formGroup.controls.opacity.value,
    //
    //   widthMinPixels: formGroup.controls.widthMinPixels.value,
    //   // widthMaxPixels: formGroup.controls.widthMaxPixels.value,
    //
    //   getLineColor: formGroup.controls.getLineColor.value,
    //   getFillColor: formGroup.controls.getFillColor.value,
    //
    //   focusOpacity: formGroup.controls.focusOpacity.value,
    //
    //   autoHighlight: formGroup.controls.autoHighlight.value,
    //
    // } as PathOverlayOptions);
  }

  // setMaxEventsValue(values: number) {
  //   this.MaxEvents.setValue(value);
  // }

  // get dateRange() {
  //   return this.eventForm.controls.dateRange;
  // }

  // get MaxEvents(): FormControl<number | null> {
  //   return this.eventForm.controls.maxEvents;
  // }

  get formEnabled(): Signal<boolean> {
    return computed(() => {
      return this.TableState() === "loaded"
    })
  }

  get eventProfiles() {
    return this.eventForm.controls.eventProfiles;
  }

  get CheckboxForm(): FormArray<FormControl<boolean>> {
    return this.eventForm.controls.checkboxes;
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
    return index;
  }

  // @ts-expect-warning - Index goes unused.
  trackByAnimalName(index: number, item: string) {
    return item;
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
      MaxEventsPerIndividual: undefined,
      // TimestampStart: this.dateRange.valid ? this.timeStampHelper(this.dateRange.controls.start.value) : undefined,
      // TimestampEnd: this.dateRange.valid ? this.timeStampHelper(this.dateRange.controls.end.value) : undefined,
      Attributes: undefined,
      EventProfile: this.eventProfiles.valid ? this.eventProfiles.value : undefined,
    };

    const eventRequest: EventRequest = {
      StudyId: studyId,
      LocalIdentifiers: localIdentifiers,
      SensorType: sensor,
      GeometryType: geometryType,
      Options: eventOptions,
    };

    console.log(JSON.stringify(eventRequest));

    // const request = this.studyService.
    //   getGeoJsonEventData<GeoJSON.LineString, LineStringPropertiesV1, LineStringMetaData>
    //   (eventRequest);
    // const fetchRequest = this.studyService.getGeoJsonFetchRequest(eventRequest);
    // this.sendEventMessage(request);
    this.sendFetchRequest(eventRequest);
    // TODO: Consider if an observable or the actual data should be sent to the current
  }

  // sendEventMessage(request: Observable<HttpResponse<LineStringFeatureCollection<LineStringPropertiesV1>[] | null>>): void {
  //   console.log("Sending event message in events component");
  //   this.lineDataEmitter.emit(request);
  // }

  sendFetchRequest(request: EventRequest): void {
    this.eventRequestEmitter.emit(request);
  }

  timeStampHelper(date: Date | null): bigint | undefined {
    if (date === null) {
      return undefined;
    }
    return BigInt(date.valueOf());
  }

}
