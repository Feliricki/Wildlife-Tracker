import { AfterViewInit, ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output, Signal, SimpleChanges, ViewChild, WritableSignal, computed, signal } from '@angular/core'; import { CommonModule } from '@angular/common';
import { StudyDTO } from '../studies/study';
import { StudyService } from '../studies/study.service';
import { IndividualJsonDTO } from '../studies/JsonResults/IndividualJsonDTO';
import { TagJsonDTO } from '../studies/JsonResults/TagJsonDTO';
import { filterForLocationsSensors } from '../studies/locationSensors';
import { MatListModule } from '@angular/material/list';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { AsyncPipe } from '@angular/common';
import { FormArray, FormBuilder, FormControl, ReactiveFormsModule, FormsModule, FormGroup } from '@angular/forms';
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
import { EventRequest } from '../studies/EventRequest';
import { MatCardModule } from '@angular/material/card';
import { MatBadgeModule } from '@angular/material/badge';
import { LayerTypes, OverlayPathOptions, OverlayPointOptions, StreamStatus } from '../deckGL/DeckOverlayController';
import { EventMetadata } from './EventsMetadata';
import { LayerTypesHelper } from '../deckGL/OverlayOption';
import { AggregationOverlayOptions, PointOverlayOptions, PathOverlayOptions, PointForms, PathForms, AggregationForms } from '../tracker-view/OverlayOptions';
import { MatGridListModule } from '@angular/material/grid-list';
import { MtxColorpickerModule } from '@ng-matero/extensions/colorpicker';

export type RGBAColor = [number, number, number, number];
export type ActiveForm = "point" | "path" | "aggregation";
export type FormTypes = PointForms | PathForms | AggregationForms;
export type OverlayTypes = FormGroup<PointForms> | FormGroup<PathForms> | FormGroup<AggregationForms>;

export interface Tile {
  color: string;
  cols: number;
  rows: number;
}
export type NumberChange = {
  type: "number";
  value: number;
}

export type StringChange = {
  type: "string";
  value: string;
}

export type ColorChange = {
  type: "color";
  value: RGBAColor;
}

export type BooleanChange = {
  type: "boolean";
  value: boolean;
}

export interface ControlChange {
  change: ColorChange | NumberChange | StringChange | BooleanChange;
  field: string;
  formType: ActiveForm;
}

export interface EventProfile {
  value: string;
  name: string;
}

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
    MatCardModule, MatCheckboxModule, MatFormFieldModule,
    MatInputModule, MatGridListModule, MtxColorpickerModule,
  ],
  templateUrl: './events.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './events.component.scss'
})
export class EventsComponent implements OnInit, OnChanges, AfterViewInit, OnDestroy {
  // NOTE: These studies are toggled to have their events appear on the map if
  // at all possible
  readonly MAX_EVENTS_LIMIT = MAX_EVENTS;
  readonly tiles: Tile[] = [
    { cols: 2, rows: 7, color: 'lightblue' },
    { cols: 3, rows: 7, color: 'lightgreen' },
  ];

  readonly eventProfilesOptions: EventProfile[] = [
    { value: "EURING_01", name: "24 hours between events" },
    { value: "EURING_02", name: "50 kilometers between events" },
    { value: "EURING_03", name: "Last 30 days" },
    { value: "EURING_04", name: "0.25 degrees movements" },
  ];

  selectedEventProfile = this.eventProfilesOptions[0].value;

  toggledStudies?: Map<bigint, StudyDTO>;
  displayedColumns: string[] = ['select', 'name'];

  @Input() currentStudy?: StudyDTO;

  // INFO:This section contains metadata on events from the maps component.
  // and the outputs from the would be overlay controls
  // Consider if the controls should be made into a proper reactive form.
  @Input() currentFocusedIndividual?: string;
  @Input() currentEventData?: EventMetadata;
  @Input() currentSelectedLayer?: LayerTypes;

  @Output() pathOverlayOptions = new EventEmitter<OverlayPathOptions>();
  @Output() pointOverlayOptions = new EventEmitter<OverlayPointOptions>();

  currentSortOrder: 'asc' | 'desc' = 'asc';
  currentLocationSensors: WritableSignal<string[]> = signal([]);

  currentActiveForms: WritableSignal<ActiveForm> = signal("path");
  currentActiveLayer: WritableSignal<LayerTypes> = signal(LayerTypes.ArcLayer);

  // NOTE: currentEventData is only not undefined when an event has been received meaning that
  // forms can only be switched out when at least one event has been received.
  pointFormValid: Signal<boolean> = computed(() => {
    const newLayer = this.currentActiveLayer();
    return this.isPointLayer(newLayer) && this.currentEventData !== undefined;
  });

  pathFormValid: Signal<boolean> = computed(() => {
    const newLayer = this.currentActiveLayer();
    return this.isPathLayer(newLayer) && this.currentEventData !== undefined;
  });

  aggregationFormValid: Signal<boolean> = computed(() => {
    const newLayer = this.currentActiveLayer();
    return this.isAggregationLayer(newLayer) && this.currentEventData !== undefined;
  });

  @Output() closeRightNavEmitter = new EventEmitter<true>(true);
  @Output() eventRequestEmitter = new EventEmitter<EventRequest>();

  @ViewChild(MatSort) sort!: MatSort;

  maxEventsToggle: WritableSignal<boolean> = signal(true);

  // NOTE: The following section is meant to communicate with the map component and then the overlay controls.
  @Output() overlayOptionsEmitter = new EventEmitter<PointOverlayOptions | AggregationOverlayOptions | PathOverlayOptions>();
  @Output() controlOptionsEmitter = new EventEmitter<ControlChange>();

  // TODO:Look up the default values for the following forms. Check deck.gl documention.
  // Add validators
  pathForms = this.formBuilder.nonNullable.group({
    widthScale: this.formBuilder.nonNullable.control(1), // The scaling factor
    widthMinPixels: this.formBuilder.nonNullable.control(0),
    opacity: this.formBuilder.nonNullable.control(1),
  });

  pointForms = this.formBuilder.nonNullable.group({
    getRadius: this.formBuilder.nonNullable.control(1),
    opacity: this.formBuilder.nonNullable.control(1),
    getFillColor: this.formBuilder.nonNullable.control(null as string | null),
    radiusMinPixels: this.formBuilder.nonNullable.control(0),
  });

  aggregationForms = this.formBuilder.nonNullable.group({
    radius: this.formBuilder.nonNullable.control(1),
    elevationAggregation: this.formBuilder.nonNullable.control(1),
  });

  eventForm = this.formBuilder.nonNullable.group({

    eventProfiles: this.formBuilder.nonNullable.control("EURING_01" as EventProfiles),
    sensorForm: this.formBuilder.control(null as null | string),
    checkboxes: new FormArray<FormControl<boolean>>([]),

  }, {
    validators: [
      checkboxOptionSelectedValidator(),
      sensorValidator()
    ],
    updateOn: "change"
  });

  // TODO:
  // 1) Rewrite these forms to match the types in the OverlayOptions.ts file
  // 2) making a base form for each layer type.
  //  This is necessary since some values can carried over onto other forms types.
  // 3) Make the form array initially empty.
  // 4) reconsider the default options
  pointOverlayControls = this.formBuilder.nonNullable.group({
    individual: this.formBuilder.array([] as Array<FormGroup<PointForms>>),
  });

  pathOverlayControls = this.formBuilder.nonNullable.group({
    individual: this.formBuilder.array([] as Array<FormGroup<PathForms>>),
  });

  aggregationOverlayControls = this.formBuilder.nonNullable.group({
    individual: this.formBuilder.array([] as Array<FormGroup<AggregationForms>>)
  });

  tableSource = new FormDataSource(this.studyService, this.CheckboxForm);
  tableState$?: Observable<SourceState>;
  tableStateSubscription?: Subscription;

  // TODO:Remove these objects from the templates
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
  currentIndividuals: WritableSignal<string[]> = signal([]);
  badgeHidden: boolean = true;
  @Input() streamStatus?: StreamStatus;
  formSubscriptions: Subscription[] = [];
  // INFO:This group contains the overlay controls; one for each individual.

  // pathDropdown: HTMLSelectElement;
  // pointDropdown: HTMLSelectElement;
  // aggregationDropdown: HTMLSelectElement;
  constructor(
    private studyService: StudyService,
    private formBuilder: FormBuilder,
    private breakpointObserver: BreakpointObserver
  ) {
  }

  get CurrentIndividiuals()
    : FormArray<FormGroup<PointForms>> | FormArray<FormGroup<PathForms>> | FormArray<FormGroup<AggregationForms>> {
    switch (this.currentActiveForms()) {
      // NOTE:These 3 cases encompass all three options.
      case "path":
        return this.pathOverlayControls.controls.individual;

      case "point":
        return this.pointOverlayControls.controls.individual;

      case "aggregation":
        return this.aggregationOverlayControls.controls.individual;
    }
  }

  get PointForms() {
    return this.pointOverlayControls.controls.individual;
  }

  get PathForms() {
    return this.pathOverlayControls.controls.individual;
  }

  get AggregationForms() {
    return this.aggregationOverlayControls.controls.individual;
  }

  // TODO:Handle color input - Convert to rgba quadtuple.
  controlChangeHelper(value: number | string | RGBAColor | boolean, option: string, formType: ActiveForm): void {
    if (typeof (value) === "string") {
      this.emitControlChanges({
        change: {
          type: "string",
          value: value
        },
        field: option,
        formType: formType
      });
    }
    else if (typeof (value) === "number") {
      this.emitControlChanges({
        change: {
          type: "number",
          value: value,
        },
        field: option,
        formType: formType
      });

    }
    else if (typeof value === "boolean") {
      this.emitControlChanges({
        change: {
          type: "boolean",
          value: value,
        },
        field: option,
        formType: formType,
      });
    }
    else {
      this.emitControlChanges({
        change: {
          type: "color",
          value: value,
        },
        field: option,
        formType: formType
      });
    }
  }

  pointControlChange(value: number | string | null, option: string, colorChange: boolean = false): void {
    if (value === null) return;
    if (colorChange) {
      const color = value as string;
      const rgbaColor = this.hexToRgba(color);
      this.pointForms.get(option)?.setValue(value);
      this.controlChangeHelper(rgbaColor, option, "point");
      return;
    }
    this.pointForms.get(option)?.setValue(value);
    this.controlChangeHelper(value, option, "point");
  }
  pathControlChange(value: number | string | boolean, option: string): void {
    this.pathForms.get(option)?.setValue(value);
    this.controlChangeHelper(value, option, "path");
  }
  aggregationControlChange(value: number | string, option: string): void {
    this.aggregationForms.get(option)?.setValue(value);
    this.controlChangeHelper(value, option, "aggregation");
  }


  // TODO: This method is untested
  rgbaToHex(color: RGBAColor): string {
    const red = color[0].toString(16);
    const green = color[1].toString(16);
    const blue = color[2].toString(16);

    const ret = '#' + red + green + blue;
    return ret;
  }

  layerToString(layer: LayerTypes): string {
    return LayerTypesHelper.layerToString(layer);
  }
  // INFO:A '#' value is expected to be the first value since this string is being
  // pulled from the input forms values.
  hexToRgba(color: string): RGBAColor {
    const redHex = color[1] + color[2];
    const greenHex = color[3] + color[4];
    const blueHex = color[5] + color[6];

    const redValue = this.normalizeColorValue(parseInt(redHex, 16));
    const greenValue = this.normalizeColorValue(parseInt(greenHex, 16));
    const blueValue = this.normalizeColorValue(parseInt(blueHex, 16));

    const ret = [redValue, greenValue, blueValue, 255] as RGBAColor;
    return ret;
  }

  normalizeColorValue(colorValue: number): number {
    return Math.min(255, Math.max(0, colorValue));
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
      // 1) Set up the link from the events component to the maps component (the other way)
      switch (propertyName) {
        case "currentStudy":
          this.eventForm.disable();
          this.currentStudy = currentValue as StudyDTO;
          this.currentLocationSensors.set(filterForLocationsSensors(this.currentStudy?.sensorTypeIds));
          this.tableSource.getAnimalData(this.currentStudy.id, this.currentSortOrder);
          break

        case "streamStatus":
          this.streamStatus = currentValue as StreamStatus;
          // console.log(`Streaming status is ${this.streamStatus} in events component.`);

          switch (this.streamStatus) {
            case "standby":
              break;
            case "streaming":
              // NOTE: This case refreshes the current individuals loaded by the stream.
              this.currentIndividuals.set([]);
              break;
            case "error":
              this.currentEventData = undefined;
              this.currentIndividuals.set([]);
              break;
          }
          break;

        case "currentEventData":
          // TODO:New forms should be added to the list of form groups.
          // Also continue testing by logging the output from the CurrrentActiveLayer signal.
          this.currentEventData = currentValue as EventMetadata;
          this.currentActiveLayer.set(this.currentEventData.layer);

          Array.from(this.currentEventData.currentIndividuals.values())
            .filter(elem => this.currentIndividuals().indexOf(elem) === -1)
            .forEach(elem => {
              this.addForms(elem)
            });

          this.currentIndividuals.set(
            Array.from(
              this.currentEventData
                .currentIndividuals
                .values())
              .sort()
          );

          this.badgeHidden = true;
          break;

        // INFO:This information is expected to come from the mapbox or google maps component.
        case "currentFocusedIndividual":
          this.currentFocusedIndividual = currentValue as string;
          break;

        case "currentSelectedLayer":
          this.currentSelectedLayer = currentValue as LayerTypes;
          this.currentActiveForms.set(this.getActiveForm(this.currentSelectedLayer));
          break;

        default:
          break;
      }
    }
    return;
  }

  getActiveForm(layer: LayerTypes): ActiveForm {
    if (LayerTypesHelper.isPathTypeLayer(layer)) {
      return "path";
    }
    else if (LayerTypesHelper.isPointTypeLayer(layer)) {
      return "point";
    }
    else return "aggregation";
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

  get CurrentActiveLayer(): Signal<LayerTypes> {
    return this.currentActiveLayer.asReadonly();
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

  addForms(individual: string) {

    const pointForm = this.formBuilder.group({
      currentIndividual: new FormControl(individual),
      getRadius: this.formBuilder.nonNullable.control(3),
      filled: this.formBuilder.nonNullable.control(true),

      autoHighlight: this.formBuilder.nonNullable.control(true),

      opacity: this.formBuilder.nonNullable.control(0.8),
      focusLevel: this.formBuilder.nonNullable.control(1.0),

      radiusMinPixels: this.formBuilder.nonNullable.control(1),
      radiusMaxPixels: this.formBuilder.nonNullable.control(100),

      getFillColor: this.formBuilder.nonNullable.control("#ff0000"),
      getLineColor: this.formBuilder.nonNullable.control("#00ff00"),

    } as PointForms);

    const pathForm = this.formBuilder.group({
      currentIndividual: new FormControl(individual),
      widthScale: this.formBuilder.nonNullable.control(1),

      opacity: this.formBuilder.nonNullable.control(0.8),

      widthMinPixels: this.formBuilder.nonNullable.control(1),
      widthMaxPixels: this.formBuilder.nonNullable.control(Number.MAX_SAFE_INTEGER),

      getSourceColor: this.formBuilder.nonNullable.control("#ff00ff"),
      getTargetColor: this.formBuilder.nonNullable.control(null as string | null),

      focusLevel: this.formBuilder.nonNullable.control(1.0),
      autoHighlight: this.formBuilder.nonNullable.control(true),
    } as PathForms);

    const aggregationForm = this.formBuilder.group({
      currentIndividual: new FormControl(individual),
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
    } as AggregationForms);

    this.pointOverlayControls.controls.individual.controls.push(pointForm);
    this.pathOverlayControls.controls.individual.controls.push(pathForm);
    this.aggregationOverlayControls.controls.individual.controls.push(aggregationForm);

    // INFO:Sort by the individual's name alphabetically
    this.pointOverlayControls.controls.individual.controls.sort(this.sortControlByIndividual);
    this.pathOverlayControls.controls.individual.controls.sort(this.sortControlByIndividual);
    this.aggregationOverlayControls.controls.individual.controls.sort(this.sortControlByIndividual);
  }

  sortControlByIndividual(a: OverlayTypes, b: OverlayTypes) {
    if (a.controls.currentIndividual < b.controls.currentIndividual) {
      return -1;
    }
    else if (a.controls.currentIndividual > b.controls.currentIndividual) {
      return 1;
    }
    else {
      return 0;
    }
  }

  // NOTE:This method is meant to be used in templates but may be prone to errors.
  // formVisible(layerType: ActiveForm): Signal<boolean> {
  //   return computed(() => {
  //     let layerMatches = false;
  //     if (layerType === "point") {
  //       layerMatches = this.isPointLayer(this.CurrentActiveLayer());
  //     }
  //     else if (layerType === "path") {
  //       layerMatches = this.isPathLayer(this.CurrentActiveLayer());
  //     }
  //     else if (layerType === "aggregation") {
  //       layerMatches = this.isAggregationLayer(this.CurrentActiveLayer());
  //     }
  //     return layerMatches && this.currentEventData !== undefined;
  //   });
  // }
  emitControlChanges(changes: ControlChange): void {
    this.controlOptionsEmitter.emit(changes);
  }

  submitPointLayerForm(index: number): void {
    if (index < 0 || index >= this.pathOverlayControls.controls.individual.controls.length) {
      return;
    }

    const formGroup = this.pointOverlayControls.controls.individual.controls[index];
    if (formGroup.invalid) {
      return;
    }

    this.overlayOptionsEmitter.emit({
      type: "pointOverlayOptions",
      currentIndividual: formGroup.controls.currentIndividual.value,

      opacity: formGroup.controls.opacity.value,
      getRadius: formGroup.controls.getRadius.value,

      radiusMinPixels: formGroup.controls.radiusMinPixels.value,
      radiusMaxPixels: formGroup.controls.radiusMaxPixels.value,

      getFillColor: this.hexToRgba(formGroup.controls.getFillColor.value),
      getLineColor: this.hexToRgba(formGroup.controls.getLineColor.value),

    } as PointOverlayOptions);
  }

  // TODO: Create a custom type to hold the requested information.
  // Uncomment this later. Also rewrite the aggregation form submission method later.
  // Consider making these forms a component to treduce clutter on this component's template
  submitPathLayer(index: number): void {
    if (index < 0 || index >= this.pathOverlayControls.controls.individual.controls.length) {
      return;
    }

    const formGroup = this.pathOverlayControls.controls.individual.controls[index];
    if (formGroup.invalid) {
      return;
    }

    // INFO:The categeries are path, point and aggregation types.
    let targetColor = undefined;
    if (formGroup.controls.getTargetColor.value !== null) {
      targetColor = this.hexToRgba(formGroup.controls.getTargetColor.value);
    }
    this.overlayOptionsEmitter.emit({
      type: "pathOverlayOptions",
      currentIndividual: formGroup.controls.currentIndividual.value,
      widthScale: formGroup.controls.widthScale.value,

      opacity: formGroup.controls.opacity.value,

      widthMinPixels: formGroup.controls.widthMinPixels.value,
      widthMaxPixels: formGroup.controls.widthMaxPixels.value,

      getSourceColor: this.hexToRgba(formGroup.controls.getSourceColor.value),
      getTargetColor: targetColor,

      focusLevel: formGroup.controls.focusLevel.value,
      autoHighlight: formGroup.controls.autoHighlight.value,

    } as PathOverlayOptions);
  }

  submitAggregationLayer(index: number): void {
    if (index < 0 || index >= this.aggregationOverlayControls.controls.individual.controls.length) {
      return;
    }
    const formGroup = this.aggregationOverlayControls.controls.individual.controls[index];
    if (formGroup.invalid) return;

    this.overlayOptionsEmitter.emit({
      type: "aggregationOverlayOptions",
      currentIndividual: formGroup.controls.currentIndividual.value,
      radius: formGroup.controls.radius.value,

      elevationRange: formGroup.controls.elevationRange.value,
      elevationScale: formGroup.controls.elevationScale.value,

      lowerPercentile: formGroup.controls.lowerPercentile.value,
      upperPercentile: formGroup.controls.upperPercentile.value,

      elevationLowerPercentile: formGroup.controls.elevationLowerPercentile.value,
      elevationUpperPercentile: formGroup.controls.elevationUpperPercentile.value,

      elevationAggregation: formGroup.controls.elevationAggregation.value,

      colorScaleType: formGroup.controls.colorScaleType.value,
      colorAggregation: formGroup.controls.colorAggregation.value,

      getColorWeight: formGroup.controls.getColorWeight.value,
      getElevationWeight: formGroup.controls.getElevationWeight.value,
    } as AggregationOverlayOptions);
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

    this.sendFetchRequest(eventRequest);
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
