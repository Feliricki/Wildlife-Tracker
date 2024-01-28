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
// import { dateRangeValidators } from './Validators/dateRangeValidator';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
// import { maxEventsValidator } from './Validators/maxEventsValidator';
import { sensorValidator } from './Validators/SensorValidator';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { Observable, Subscription, distinctUntilChanged, map, tap } from 'rxjs';
import { MatSliderModule } from '@angular/material/slider';
import { EventOptions, EventProfiles } from '../studies/EventOptions';
import { NonEmptyArray } from '../HelperTypes/NonEmptyArray';
import { MAX_EVENTS } from './Validators/maxEventsValidator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { LineStringFeatureCollection, LineStringMetaData, LineStringPropertiesV1 } from "../deckGL/GeoJsonTypes";
import { HttpResponse } from '@angular/common/http';
import { EventRequest } from '../studies/EventRequest';
import { MatCardModule } from '@angular/material/card';
import { MatBadgeModule } from '@angular/material/badge';
import { LayerTypes, OverlayPathOptions, OverlayPointOptions, StreamStatus } from '../deckGL/GoogleOverlay';
import { EventMetaData } from './EventsMetadata';
import { LayerTypesHelper } from '../deckGL/OverlayOption';
import { AggregationOverlayOptions, PointOverlayOptions, PathOverlayOptions } from '../tracker-view/OverlayOptions';

export type RGBAColor = [number, number, number, number];
// type ColorTypes = RGBAColor | [number, number, number];
type Range = [number, number];

@Component({
  selector: 'app-events',
  standalone: true,
  imports: [
    CommonModule, MatListModule, MatSortModule, MatNativeDateModule,
    MatTabsModule, MatTableModule, MatPaginatorModule,
    AsyncPipe, ReactiveFormsModule, MatFormFieldModule,
    MatInputModule, MatIconModule, MatButtonModule, FormsModule,
    MatExpansionModule, MatTooltipModule, MatSelectModule,
    MatDividerModule, MatDatepickerModule, MatBadgeModule,
    MatSlideToggleModule, MatSliderModule, MatProgressBarModule, MatCardModule,
    MatCheckboxModule,
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

  @Output() closeRightNavEmitter = new EventEmitter<true>(true);
  @Output() lineDataEmitter = new EventEmitter<Observable<HttpResponse<LineStringFeatureCollection<LineStringPropertiesV1>[] | null>>>;
  @Output() eventRequestEmitter = new EventEmitter<EventRequest>();

  @ViewChild(MatSort) sort!: MatSort;

  maxEventsToggle: WritableSignal<boolean> = signal(true);

  // NOTE: The following section is meant to communicate with the map component and then the overlay controls.
  @Output() overlayOptionsEmitter = new EventEmitter<PointOverlayOptions | AggregationOverlayOptions | PathOverlayOptions>();
  eventForm = this.formBuilder.nonNullable.group({

    // This field will go unused.
    // maxEvents: new FormControl<number | null>(
    //   0,
    //   { nonNullable: false }),
    //
    // dateRange: this.formBuilder.group({
    //   start: this.formBuilder.control(null as null | Date),
    //   end: this.formBuilder.control(null as null | Date),
    // }),
    eventProfiles: this.formBuilder.control(null as EventProfiles),
    sensorForm: this.formBuilder.control(null as null | string),
    checkboxes: new FormArray<FormControl<boolean>>([]),
  }, {
    validators: [
      checkboxOptionSelectedValidator(),
      // dateRangeValidators(),
      // maxEventsValidator(),
      sensorValidator()
    ],
    updateOn: "change"
  });

  // TODO:The number of options needs to be cut down signficantly.
  // Consider the following:
  // 1) making a base form for each layer type.
  // 2) moving these form types into a separate file.
  pointOverlayControls = this.formBuilder.array([
    this.formBuilder.nonNullable.group({
      // TODO: The part needs a custom validator.
      individual: this.formBuilder.nonNullable.control(null as null | string),

      radius: this.formBuilder.nonNullable.control(3),
      radiusUnits: this.formBuilder.nonNullable.control('meters' as 'pixel' | 'common' | 'meters'),
      radiusScale: this.formBuilder.nonNullable.control(1),

      radiusMinPixels: this.formBuilder.nonNullable.control(1),
      radiusMaxPixels: this.formBuilder.nonNullable.control(Number.MAX_SAFE_INTEGER),

      lineWidthUnits: this.formBuilder.nonNullable.control(30),
      lineWidthScale: this.formBuilder.nonNullable.control(30),

      // Draw the outline of the points.
      // stroked: this.formBuilder.nonNullable.control(false),
      // filled: this.formBuilder.nonNullable.control(true),

      autoHighlight: this.formBuilder.nonNullable.control(true),
      opacity: this.formBuilder.nonNullable.control(0.8),

      // NOTE:These options are sent from the chunks loaded from the overlay class
      // on chunk load.
      getColor: this.formBuilder.nonNullable.control([0, 0, 0, 255] as RGBAColor),
      getFillColor: this.formBuilder.nonNullable.control([0, 0, 0, 255] as RGBAColor),

      getLineColor: this.formBuilder.nonNullable.control([0, 0, 0, 255] as RGBAColor),
      getLineWidth: this.formBuilder.nonNullable.control(1),

      // billboard: this.formBuilder.nonNullable.control(false),
    })
  ]);

  // TODO: Fix the default options.
  // All of the fields within this formBuilder array may need to contain
  // a getter method to fix templating.
  pathOverlayControls = this.formBuilder.array([
    this.formBuilder.group({
      individual: this.formBuilder.nonNullable.control(null as null | string),

      pathRadius: this.formBuilder.nonNullable.control(0),
      pathScale: this.formBuilder.nonNullable.control(0),
      pathUnits: this.formBuilder.nonNullable.control('pixel' as 'pixel' | 'common' | 'meters'),

      widthUnits: this.formBuilder.nonNullable.control('pixel' as 'pixel' | 'common' | 'meters'),
      widthScale: this.formBuilder.nonNullable.control(1),
      getWidth: this.formBuilder.nonNullable.control(3),

      widthMinPixels: this.formBuilder.nonNullable.control(1),
      widthMaxPixels: this.formBuilder.nonNullable.control(Number.MAX_SAFE_INTEGER),

      opacity: this.formBuilder.nonNullable.control(0.8),
      getFillColor: this.formBuilder.nonNullable.control([0, 0, 0, 255] as RGBAColor),
      getLineColor: this.formBuilder.nonNullable.control([0, 0, 0, 0] as RGBAColor),

      autoHighlight: this.formBuilder.nonNullable.control(true),
    })
  ]);

  //NOTE:The default options may need to be removed or otherwise removed.
  aggregationOverlayControls = this.formBuilder.array([
    this.formBuilder.group({
      individual: this.formBuilder.nonNullable.control(null as null | string),

      radius: this.formBuilder.nonNullable.control(1000),
      // coverage: this.formBuilder.nonNullable.control(1),

      elevationRange: this.formBuilder.nonNullable.control([0, 1000] as Range),
      elevationScale: this.formBuilder.nonNullable.control(1),

      elevationLowerPercentile: this.formBuilder.nonNullable.control(0),
      elevationUpperPercentile: this.formBuilder.nonNullable.control(100),

      UpperPercentile: this.formBuilder.nonNullable.control(100),
      lowerPercentile: this.formBuilder.nonNullable.control(0),

      colorScaleType: this.formBuilder.nonNullable.control('quantize' as 'quantize' | 'quantile' | 'ordinal'),
      colorAggregation: this.formBuilder.nonNullable.control('SUM' as 'SUM' | 'MEAN' | 'MIN' | 'MAX'),
      elevationAggregation: this.formBuilder.nonNullable.control('SUM' as 'SUM' | 'MEAN' | 'MIN' | 'MAX'),

      getColorWeight: this.formBuilder.nonNullable.control(1),
      getElevationWeight: this.formBuilder.nonNullable.control(1),
    })
  ]);

  // TODO: This will be a formarray containing the overlay controls
  // Rather than use this form, just switch them out depending on the current layer type.
  // overlayControls = this.formBuilder.nonNullable.group({
  // });

  tableSource = new FormDataSource(this.studyService, this.CheckboxForm);
  tableState$?: Observable<SourceState>;
  tableStateSubscription?: Subscription;

  // INFO: The following stylings should perhaps be applied to the
  // input form.
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
      // TODO:Consider if this check is necessary.
      if (currentValue === undefined || currentValue === previousValue) {
        continue;
      }

      // TODO:An message event is needed if a stream ends or runs into an error.
      // INFO: Work done so far.
      // 1) Linked the overlay's stream status with the the events component
      // 2) Linked incoming chunked data from the overlay's stream
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


  // NOTE:The following three overlay controls
  submitPathLayer(index: number): void {
    if (index < 0 || index >= this.pathOverlayControls.controls.length) {
      return;
    }

    const formGroup = this.pathOverlayControls.controls[index];
    if (formGroup.invalid) {
      return;
    }
    // NOTE:This emitter needs to emit different types of forms depending on the
    // currently active layer type.
    // The categeries are path, point and aggregation types.
    this.overlayOptionsEmitter.emit({
      type: "pathOverlayOptions",
      currentIndividual: formGroup.controls.individual.value ?? "None",
      opacity: formGroup.controls.opacity.value,
      widthScale: formGroup.controls.widthScale.value,
      widthUnits: formGroup.controls.widthUnits.value,
      widthMinPixels: formGroup.controls.widthMinPixels.value,
      widthMaxPixels: formGroup.controls.widthMaxPixels.value,
    } as PathOverlayOptions);
  }
  // TODO: Create a custom type to hold the requested information.
  // Or reuse the overlay default options

  submitPointLayerForm(index: number): void {
    if (index < 0 || index >= this.pathOverlayControls.controls.length) {
      return;
    }

    const formGroup = this.pointOverlayControls.controls[index];
    if (formGroup.invalid) {
      return;
    }

    this.overlayOptionsEmitter.emit({
      type: "pointOverlayOptions",
      currentIndividual: formGroup.controls.individual.value,
      opacity: formGroup.controls.opacity.value,
      getRadius: formGroup.controls.radius.value,
      radiusScale: formGroup.controls.radiusScale.value,
      radiusUnits: formGroup.controls.radiusUnits.value,
      widthMinPixels: formGroup.controls.radiusMinPixels.value,
      widthMaxPixels: formGroup.controls.radiusMaxPixels.value,
      getFillColor: formGroup.controls.getFillColor.value,
      getLineColor: formGroup.controls.getLineColor.value,
    } as PointOverlayOptions);
  }

  submitAggregationLayerForm(index: number): void {
    if (index < 0 || index >= this.aggregationOverlayControls.controls.length) {
      return;
    }

    const formGroup = this.aggregationOverlayControls.controls[index];
    if (formGroup.invalid) {
      return;
    }
    this.overlayOptionsEmitter.emit({
      type: "AggregationOverlayOptions",
      radius: formGroup.controls.radius.value,
      // coverage: formGroup.controls.coverage.value,

      currentIndividual: formGroup.controls.individual.value,

      elevationRange: formGroup.controls.elevationRange.value,
      elevationScale: formGroup.controls.elevationScale.value,
      elevationLowerPercentile: formGroup.controls.elevationLowerPercentile.value,
      elevationUpperPercentile: formGroup.controls.elevationUpperPercentile.value,

      upperPercentile: formGroup.controls.UpperPercentile.value,
      lowerPercentile: formGroup.controls.lowerPercentile.value,
      colorAggregation: formGroup.controls.colorAggregation.value,
      elevationAggregation: formGroup.controls.elevationAggregation.value,
      getColorWeight: formGroup.controls.getColorWeight.value,
      // getElevationWeight: formGroup.controls.getElevationWeight.value,
    } as AggregationOverlayOptions);
  }
  //      individual: this.formBuilder.nonNullable.control(null as null | string),
  //
  //       radius: this.formBuilder.nonNullable.control(1000),
  //       coverage: this.formBuilder.nonNullable.control(1),
  //
  //       elevationRange: this.formBuilder.nonNullable.control([0, 1000] as [number, number]),
  //       elevationScale: this.formBuilder.nonNullable.control(1),
  //       UpperPercentile: this.formBuilder.nonNullable.control(100),
  //       lowerPercentile: this.formBuilder.nonNullable.control(0),
  //
  //       colorScaleType: this.formBuilder.nonNullable.control('quantize' as 'quantize' | 'quantile' | 'ordinal'),
  //       colorAggregation: this.formBuilder.nonNullable.control('SUM' as 'SUM' | 'MEAN' | 'MIN' | 'MAX'),
  //       elevationAggregation: this.formBuilder.nonNullable.control('SUM' as 'SUM' | 'MEAN' | 'MIN' | 'MAX'),
  //
  //       getColorWeight: this.formBuilder.nonNullable.control(1),
  //       getElevationWeight: this.formBuilder.nonNullable.control(1),

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

    const request = this.studyService.
      getGeoJsonEventData<GeoJSON.LineString, LineStringPropertiesV1, LineStringMetaData>
      (eventRequest);
    // const fetchRequest = this.studyService.getGeoJsonFetchRequest(eventRequest);

    this.sendEventMessage(request);
    this.sendFetchRequest(eventRequest);
    // TODO: Consider if an observable or the actual data should be sent to the current
  }

  sendEventMessage(request: Observable<HttpResponse<LineStringFeatureCollection<LineStringPropertiesV1>[] | null>>): void {
    console.log("Sending event message in events component");
    this.lineDataEmitter.emit(request);
  }

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
