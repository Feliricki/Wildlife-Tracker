import { ChangeDetectionStrategy, Component, OnInit, Signal, WritableSignal, computed, signal, inject, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
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
import { MatSortModule } from '@angular/material/sort';
import { FormDataSource, SourceState } from '../HelperTypes/FormDataSource';
import { MatSelectModule } from '@angular/material/select';
import { MatDividerModule } from '@angular/material/divider';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { sensorValidator } from './Validators/SensorValidator';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { Observable, distinctUntilChanged, map, tap } from 'rxjs';
import { MatSliderModule } from '@angular/material/slider';
import { EventOptions, EventProfiles } from '../studies/EventOptions';
import { NonEmptyArray } from '../HelperTypes/NonEmptyArray';
import { MAX_EVENTS } from './Validators/maxEventsValidator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { EventRequest } from '../studies/EventRequest';
import { MatCardModule } from '@angular/material/card';
import { MatBadgeModule } from '@angular/material/badge';
import { LayerTypes } from '../deckGL/DeckOverlayController';
import { LayerTypesHelper } from '../deckGL/OverlayOption';
import { PointForms, PathForms, AggregationForms } from '../tracker-view/OverlayOptions';
import { MatGridListModule } from '@angular/material/grid-list';
import { MtxColorpickerModule } from '@ng-matero/extensions/colorpicker';
import { DeckOverlayStateService } from '../services/deck-overlay-state.service';
import { UIStateService } from '../services/ui-state.service';
import { MapStateService } from '../services/map-state.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

export type RGBAColor = [number, number, number, number];
export type Color = [number, number, number] | RGBAColor;
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

// Sends changes from the right side panel
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
export class EventsComponent implements OnInit {
    // Inject services
    private readonly studyService = inject(StudyService);
    private readonly formBuilder = inject(FormBuilder);
    private readonly breakpointObserver = inject(BreakpointObserver);
    private readonly deckOverlayStateService = inject(DeckOverlayStateService);
    private readonly uiStateService = inject(UIStateService);
    private readonly mapStateService = inject(MapStateService);
    private readonly destroyRef = inject(DestroyRef);

    // State from services
    readonly currentStudy = this.mapStateService.currentStudy;
    readonly currentEventData = this.mapStateService.currentEventData;
    readonly streamStatus = this.mapStateService.streamStatus;
    readonly currentLayer = this.deckOverlayStateService.currentLayer;

    readonly MAX_EVENTS_LIMIT = MAX_EVENTS;
    readonly tiles: Tile[] = [
        { cols: 4, rows: 1, color: 'lightblue' },
        { cols: 6, rows: 1, color: 'lightgreen' },
    ];

    readonly eventProfilesOptions: EventProfile[] = [
        { value: "EURING_01", name: "24 hours between events" },
        { value: "EURING_02", name: "50 kilometers between events" },
        { value: "EURING_03", name: "Last 30 days" },
        { value: "EURING_04", name: "0.25 degrees movements" },
    ];

    readonly ColorRangeThemes: Color[][] = [
        // default theme
        [
            [255, 255, 178],
            [254, 217, 118],
            [254, 178, 76],
            [253, 141, 60],
            [240, 59, 32],
            [189, 0, 38],
        ],
        // This is the blue to red theme.
        [
            [1, 152, 189],
            [73, 227, 206],
            [216, 254, 181],
            [254, 237, 177],
            [254, 173, 84],
            [209, 55, 78]
        ],
        // grey to green theme
        [
            [0, 25, 0, 25],
            [0, 85, 0, 85],
            [0, 127, 0, 127],
            [0, 170, 0, 170],
            [0, 190, 0, 190],
            [0, 255, 0, 255]
        ],
    ]

    selectedEventProfile = this.eventProfilesOptions[0].value;
    displayedColumns: string[] = ['select', 'name'];
    currentSortOrder: 'asc' | 'desc' = 'asc';
    currentLocationSensors: WritableSignal<string[]> = signal([]);
    currentActiveForms: WritableSignal<ActiveForm> = signal("path");
    currentActiveLayer: WritableSignal<LayerTypes> = signal(LayerTypes.ArcLayer);

    // Computed properties for form validation
    pointFormValid: Signal<boolean> = computed(() => {
        const newLayer = this.currentActiveLayer();
        return this.isPointLayer(newLayer) && this.currentEventData() !== null;
    });

    pathFormValid: Signal<boolean> = computed(() => {
        const newLayer = this.currentActiveLayer();
        return this.isPathLayer(newLayer) && this.currentEventData() !== null;
    });

    aggregationFormValid: Signal<boolean> = computed(() => {
        const newLayer = this.currentActiveLayer();
        return this.isAggregationLayer(newLayer) && this.currentEventData() !== null;
    });

    maxEventsToggle: WritableSignal<boolean> = signal(true);

    pathForms = this.formBuilder.nonNullable.group({
        widthScale: this.formBuilder.nonNullable.control(1),
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
        radiusPixels: this.formBuilder.nonNullable.control(30),
        radius: this.formBuilder.nonNullable.control(1000),
        cellSizePixels: this.formBuilder.nonNullable.control(100),
        intensity: this.formBuilder.nonNullable.control(1),
        threshold: this.formBuilder.nonNullable.control(0.5),
        coverage: this.formBuilder.nonNullable.control(1),
        upperPercentile: this.formBuilder.nonNullable.control(100),
        lowerPercentile: this.formBuilder.nonNullable.control(0),
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

    fourthRowSmall = {
        'justify-content': 'left'
    }

    fourthRowDefault = {
        'justify-content': 'space-between',
        'margin-left': '1em',
        'margin-right': '1em',
    }

    screenChange?: Observable<boolean>;
    extraSmallScreenChange?: Observable<boolean>;
    screenChangeSignal: WritableSignal<boolean> = signal(false);

    currentIndividuals: WritableSignal<string[]> = signal([]);
    badgeHidden: boolean = true;

    constructor() {
        this.setupStateSubscriptions();
    }

    private setupStateSubscriptions(): void {
        // Watch for current study changes
        this.mapStateService.currentStudy$
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(study => {
                if (study) {
                    this.eventForm.disable();
                    this.currentLocationSensors.set(filterForLocationsSensors(study.sensorTypeIds));
                    this.tableSource.getAnimalData(study.id, this.currentSortOrder);
                }
            });

        // Watch for stream status changes
        this.mapStateService.streamStatus$
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(status => {
                switch (status) {
                    case "standby":
                        break;
                    case "streaming":
                        this.currentIndividuals.set([]);
                        break;
                    case "error":
                        this.currentIndividuals.set([]);
                        break;
                }
            });

        // Watch for event data changes
        this.mapStateService.currentEventData$
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(eventData => {
                if (eventData) {
                    Array.from(eventData.currentIndividuals.values())
                        .filter(elem => this.currentIndividuals().indexOf(elem) === -1)
                        .forEach(elem => {
                            this.addForms(elem);
                        });

                    this.currentIndividuals.set(
                        Array.from(eventData.currentIndividuals.values()).sort()
                    );

                    this.badgeHidden = true;
                }
            });

        // Watch for layer changes
        this.deckOverlayStateService.currentLayer$
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(layer => {
                this.currentActiveLayer.set(layer);
                this.currentActiveForms.set(this.getActiveForm(layer));
            });
    }

    get CurrentIndividiuals()
        : FormArray<FormGroup<PointForms>> | FormArray<FormGroup<PathForms>> | FormArray<FormGroup<AggregationForms>> {
        switch (this.currentActiveForms()) {
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

    controlChangeHelper(value: number | string | RGBAColor | boolean, option: string, formType: ActiveForm): void {
        if (typeof (value) === "string") {
            this.deckOverlayStateService.applyControlChange({
                change: { type: "string", value: value },
                field: option,
                formType: formType
            });
        }
        else if (typeof (value) === "number") {
            this.deckOverlayStateService.applyControlChange({
                change: { type: "number", value: value },
                field: option,
                formType: formType
            });
        }
        else if (typeof value === "boolean") {
            this.deckOverlayStateService.applyControlChange({
                change: { type: "boolean", value: value },
                field: option,
                formType: formType
            });
        }
        else {
            this.deckOverlayStateService.applyControlChange({
                change: { type: "color", value: value },
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

    rgbaToHex(color: RGBAColor): string {
        const red = color[0].toString(16);
        const green = color[1].toString(16);
        const blue = color[2].toString(16);
        return '#' + red + green + blue;
    }

    layerToString(layer: LayerTypes): string {
        return LayerTypesHelper.layerToString(layer);
    }

    hexToRgba(color: string): RGBAColor {
        const redHex = color[1] + color[2];
        const greenHex = color[3] + color[4];
        const blueHex = color[5] + color[6];

        const redValue = this.normalizeColorValue(parseInt(redHex, 16));
        const greenValue = this.normalizeColorValue(parseInt(greenHex, 16));
        const blueValue = this.normalizeColorValue(parseInt(blueHex, 16));

        return [redValue, greenValue, blueValue, 255] as RGBAColor;
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

        this.tableState$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe();

        this.screenChange = this.breakpointObserver.observe([Breakpoints.XSmall, Breakpoints.Small])
            .pipe(map(state => state.matches));

        this.extraSmallScreenChange = this.breakpointObserver.observe(Breakpoints.XSmall)
            .pipe(map(state => state.matches));
    }

    closeRightNav(): void {
        this.uiStateService.closeRightPanel();
    }

    isSticky(): boolean {
        return true;
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

    getActiveForm(layer: LayerTypes): ActiveForm {
        if (LayerTypesHelper.isPathTypeLayer(layer)) {
            return "path";
        }
        else if (LayerTypesHelper.isPointTypeLayer(layer)) {
            return "point";
        }
        else return "aggregation";
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
        const study = this.currentStudy();
        if (!study) {
            return;
        }
        this.currentSortOrder = this.currentSortOrder === 'asc' ? 'desc' : 'asc';
        this.tableSource.getAnimalData(study.id, this.currentSortOrder);
    }

    isSelected(index: number): Signal<boolean> {
        return this.tableSource.isSelected(index);
    }

    trackById(index: number) {
        return index;
    }

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

    submitForm() {
        if (this.eventForm.invalid) {
            return;
        }

        const study = this.currentStudy();
        if (!study || this.TableState() !== "loaded" || this.sensorForm.value == null) {
            return;
        }

        const studyId = study.id;
        const localIdentifiers = this.tableSource.taggedAndSelectedIndividuals() as NonEmptyArray<string>;
        const sensor = this.sensorForm.value;
        const geometryType = "linestring";

        const eventOptions: EventOptions = {
            MaxEventsPerIndividual: undefined,
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
        // Use the service to handle the request instead of emitting
        this.deckOverlayStateService.setEventRequest(request);
    }

    timeStampHelper(date: Date | null): bigint | undefined {
        if (date === null) return undefined;
        return BigInt(date.valueOf());
    }
}
