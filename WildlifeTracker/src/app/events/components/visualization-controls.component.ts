import { Component, Input, Output, EventEmitter, Signal, ChangeDetectionStrategy, OnInit, OnDestroy, effect, DestroyRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, ReactiveFormsModule, FormControl } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatSliderModule } from '@angular/material/slider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCardModule } from '@angular/material/card';
import { MtxColorpickerModule } from '@ng-matero/extensions/colorpicker';
import { MatInputModule } from '@angular/material/input';
import { ActiveForm, Color } from '../animal-data-panel.component';
import { LayerTypes } from '../../deckGL/DeckOverlayController';
import { EventMetadata } from '../EventsMetadata';
import { distinctUntilChanged, Subscription } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

// Define the control value types based on the existing control change methods
type PathControlValue = number | string | boolean;
type PointControlValue = number | string | null;
type AggregationControlValue = number | string;

// Define the event emitter payload types
interface PathControlChangeEvent {
  value: PathControlValue;
  option: string;
}

interface PointControlChangeEvent {
  value: PointControlValue;
  option: string;
  colorChange?: boolean;
}

interface AggregationControlChangeEvent {
  value: AggregationControlValue;
  option: string;
}

@Component({
  selector: 'app-control-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatSelectModule,
    MatSliderModule,
    MatTooltipModule,
    MatCardModule,
    MtxColorpickerModule,
    MatInputModule
  ],
  template: `
    <div class="control-panel">
      @switch (currentActiveForms()) {
        @case ("path") {
          <div class="control-panel__section">
            <div class="control-panel__row">
              <mat-form-field appearance="outline" class="control-panel__item dense-5">
                <mat-label>Units</mat-label>
                <mat-select (valueChange)="onPathControlChange($event, 'widthUnits')">
                  <mat-option value="meters">Meters</mat-option>
                  <mat-option value="pixels">Pixels</mat-option>
                </mat-select>
              </mat-form-field>
              <mat-form-field appearance="outline" class="control-panel__item dense-5">
                <mat-label>Tooltip</mat-label>
                <mat-select (valueChange)="onPathControlChange($event, 'toggleTooltip')">
                  <mat-option [value]="true">On</mat-option>
                  <mat-option [value]="false">Off</mat-option>
                </mat-select>
              </mat-form-field>
            </div>
<div class="control-panel__slider-group">
  <span>Width: {{ getControl(pathForms, 'widthScale').value }}</span>
  <div class="control-panel__slider-container">
    <mat-slider class="control-panel__slider" min="0" max="20" thumbLabel>
      <input matSliderThumb [formControl]="getControl(pathForms, 'widthScale')">
    </mat-slider>
    <mat-form-field class="control-panel__slider-input dense-5">
      <input matInput type="number" min="0" max="20" [formControl]="getControl(pathForms, 'widthScale')">
    </mat-form-field>
  </div>
</div>
<div class="control-panel__slider-group">
  <span>Min Width: {{ getControl(pathForms, 'widthMinPixels').value }}px</span>
  <div class="control-panel__slider-container">
    <mat-slider class="control-panel__slider" min="0" max="20" thumbLabel>
      <input matSliderThumb [formControl]="getControl(pathForms, 'widthMinPixels')">
    </mat-slider>
    <mat-form-field class="control-panel__slider-input dense-5">
      <input matInput type="number" min="0" max="20" [formControl]="getControl(pathForms, 'widthMinPixels')">
    </mat-form-field>
  </div>
</div>
<div class="control-panel__slider-group">
  <span>Opacity: {{ (getControl(pathForms, 'opacity').value ?? 0) * 100 }}%</span>
  <div class="control-panel__slider-container">
    <mat-slider class="control-panel__slider" min="0" max="1" step="0.01" thumbLabel>
      <input matSliderThumb [formControl]="getControl(pathForms, 'opacity')">
    </mat-slider>
    <mat-form-field class="control-panel__slider-input dense-5">
      <input matInput type="number" min="0" max="1" step="0.01" [formControl]="getControl(pathForms, 'opacity')">
    </mat-form-field>
  </div>
</div>

          </div>
        }
        @case ("point") {
          <div class="control-panel__section">
            <div class="control-panel__row">
              <mat-form-field appearance="outline" class="control-panel__item dense-5">
                <mat-label>Units</mat-label>
                <mat-select (valueChange)="onPointControlChange($event, 'radiusUnits')">
                  <mat-option value="meters">Meters</mat-option>
                  <mat-option value="pixels">Pixels</mat-option>
                </mat-select>
              </mat-form-field>
              <mat-form-field appearance="outline" class="control-panel__item dense-5">
                <mat-label>Color</mat-label>
                <input matInput [mtxColorpicker]="PointColorpicker" (colorChange)="onPointControlChange($event.value, 'getFillColor', true)">
                <mtx-colorpicker-toggle matSuffix [for]="PointColorpicker"></mtx-colorpicker-toggle>
                <mtx-colorpicker #PointColorpicker></mtx-colorpicker>
              </mat-form-field>
            </div>
<div class="control-panel__slider-group">
  <span>Radius: {{ getControl(pointForms, 'getRadius').value }}</span>
  <div class="control-panel__slider-container">
    <mat-slider class="control-panel__slider" min="0" max="1000" thumbLabel>
      <input matSliderThumb [formControl]="getControl(pointForms, 'getRadius')">
    </mat-slider>
    <mat-form-field class="control-panel__slider-input dense-5">
      <input matInput type="number" min="0" max="1000" [formControl]="getControl(pointForms, 'getRadius')">
    </mat-form-field>
  </div>
</div>
<div class="control-panel__slider-group">
  <span>Min Radius: {{ getControl(pointForms, 'radiusMinPixels').value }}px</span>
  <div class="control-panel__slider-container">
    <mat-slider class="control-panel__slider" min="0" max="20" step="1" thumbLabel>
      <input matSliderThumb [formControl]="getControl(pointForms, 'radiusMinPixels')">
    </mat-slider>
    <mat-form-field class="control-panel__slider-input dense-5">
      <input matInput type="number" min="0" max="20" step="1" [formControl]="getControl(pointForms, 'radiusMinPixels')">
    </mat-form-field>
  </div>
</div>
<div class="control-panel__slider-group">
  <span>Opacity: {{ (getControl(pointForms, 'opacity').value ?? 0) * 100 }}%</span>
  <div class="control-panel__slider-container">
    <mat-slider class="control-panel__slider" min="0" max="1" step="0.01" thumbLabel>
      <input matSliderThumb [formControl]="getControl(pointForms, 'opacity')">
    </mat-slider>
    <mat-form-field class="control-panel__slider-input dense-5">
      <input matInput type="number" min="0" max="1" step="0.01" [formControl]="getControl(pointForms, 'opacity')">
    </mat-form-field>
  </div>
</div>
          </div>
        }
        @case ("aggregation") {
          <div class="control-panel__section">
            <div class="control-panel__row">
              <mat-form-field appearance="outline" class="control-panel__item dense-5">
                <mat-label>Aggregation</mat-label>
                <mat-select (valueChange)="onAggregationControlChange($event, 'aggregation')">
                  <mat-option value="SUM">Sum</mat-option>
                  <mat-option value="MEAN">Mean</mat-option>
                   @if(currentActiveLayer() === 13){
                    <mat-option value="MIN">Min</mat-option>
                    <mat-option value="MAX">Max</mat-option>
                  }
                </mat-select>
              </mat-form-field>
              <mat-form-field appearance="outline" class="control-panel__item dense-5">
                <mat-label>Theme</mat-label>
                <mat-select (valueChange)="onAggregationControlChange($event, 'colorRange')">
                  <mat-option [value]="ColorRangeThemes[0]">Theme 1</mat-option>
                  <mat-option [value]="ColorRangeThemes[1]">Theme 2</mat-option>
                  <mat-option [value]="ColorRangeThemes[2]">Theme 3</mat-option>
                </mat-select>
              </mat-form-field>
            </div>

            @if(currentActiveLayer() === 5){
              <div class="control-panel__slider-section--grid">
                <div class="control-panel__slider-group">
                  <span>Radius: {{ getControl(aggregationForms, 'radiusPixels').value }}px</span>
                  <div class="control-panel__slider-container">
                    <mat-slider class="control-panel__slider" min="1" max="100" thumbLabel>
                      <input matSliderThumb [formControl]="getControl(aggregationForms, 'radiusPixels')">
                    </mat-slider>
                    <mat-form-field class="control-panel__slider-input dense-5">
                      <input matInput type="number" min="1" max="100" [formControl]="getControl(aggregationForms, 'radiusPixels')">
                    </mat-form-field>
                  </div>
                </div>
                <div class="control-panel__slider-group">
                  <span>Intensity: {{ getControl(aggregationForms, 'intensity').value }}</span>
                  <div class="control-panel__slider-container">
                    <mat-slider class="control-panel__slider" min="0" max="5" thumbLabel>
                      <input matSliderThumb [formControl]="getControl(aggregationForms, 'intensity')">
                    </mat-slider>
                    <mat-form-field class="control-panel__slider-input dense-5">
                      <input matInput type="number" min="0" max="5" [formControl]="getControl(aggregationForms, 'intensity')">
                    </mat-form-field>
                  </div>
                </div>
                <div class="control-panel__slider-group">
                  <span>Threshold: {{ getControl(aggregationForms, 'threshold').value }}</span>
                  <div class="control-panel__slider-container">
                    <mat-slider class="control-panel__slider" min="0" max="1" step="0.01" thumbLabel>
                      <input matSliderThumb [formControl]="getControl(aggregationForms, 'threshold')">
                    </mat-slider>
                    <mat-form-field class="control-panel__slider-input dense-5">
                      <input matInput type="number" min="0" max="1" step="0.01" [formControl]="getControl(aggregationForms, 'threshold')">
                    </mat-form-field>
                  </div>
                </div>
              </div>
            }

            @if(currentActiveLayer() === 6){
              <div class="control-panel__slider-section--grid">
                <div class="control-panel__slider-group">
                  <span>Radius: {{ getControl(aggregationForms, 'radius').value }}</span>
                  <div class="control-panel__slider-container">
                    <mat-slider class="control-panel__slider" min="10" max="1000" thumbLabel>
                      <input matSliderThumb [formControl]="getControl(aggregationForms, 'radius')">
                    </mat-slider>
                    <mat-form-field class="control-panel__slider-input dense-5">
                      <input matInput type="number" min="10" max="1000" [formControl]="getControl(aggregationForms, 'radius')">
                    </mat-form-field>
                  </div>
                </div>
                <div class="control-panel__slider-group">
                  <span>Coverage: {{ getControl(aggregationForms, 'coverage').value }}</span>
                  <div class="control-panel__slider-container">
                    <mat-slider class="control-panel__slider" min="0" max="1" step="0.01" thumbLabel>
                      <input matSliderThumb [formControl]="getControl(aggregationForms, 'coverage')">
                    </mat-slider>
                    <mat-form-field class="control-panel__slider-input dense-5">
                      <input matInput type="number" min="0" max="1" step="0.01" [formControl]="getControl(aggregationForms, 'coverage')">
                    </mat-form-field>
                  </div>
                </div>
                <div class="control-panel__slider-group">
                  <span>Upper Percentile: {{ getControl(aggregationForms, 'upperPercentile').value }}</span>
                  <div class="control-panel__slider-container">
                    <mat-slider class="control-panel__slider" min="0" max="100" thumbLabel>
                      <input matSliderThumb [formControl]="getControl(aggregationForms, 'upperPercentile')">
                    </mat-slider>
                    <mat-form-field class="control-panel__slider-input dense-5">
                      <input matInput type="number" min="0" max="100" [formControl]="getControl(aggregationForms, 'upperPercentile')">
                    </mat-form-field>
                  </div>
                </div>
                <div class="control-panel__slider-group">
                  <span>Lower Percentile: {{ getControl(aggregationForms, 'lowerPercentile').value }}</span>
                  <div class="control-panel__slider-container">
                    <mat-slider class="control-panel__slider" min="0" max="100" thumbLabel>
                      <input matSliderThumb [formControl]="getControl(aggregationForms, 'lowerPercentile')">
                    </mat-slider>
                    <mat-form-field class="control-panel__slider-input dense-5">
                      <input matInput type="number" min="0" max="100" [formControl]="getControl(aggregationForms, 'lowerPercentile')">
                    </mat-form-field>
                  </div>
                </div>
              </div>
            }

            @if(currentActiveLayer() === 13){
              <div class="control-panel__slider-section">
                <span>Cell Size: {{ getControl(aggregationForms, 'cellSizePixels').value }}px</span>
                <div class="control-panel__slider-container">
                  <mat-slider class="control-panel__slider" min="10" max="1000" thumbLabel>
                    <input matSliderThumb [formControl]="getControl(aggregationForms, 'cellSizePixels')">
                  </mat-slider>
                  <mat-form-field class="control-panel__slider-input dense-5">
                    <input matInput type="number" min="10" max="1000" [formControl]="getControl(aggregationForms, 'cellSizePixels')">
                  </mat-form-field>
                </div>
              </div>
            }
          </div>
        }
      }
    </div>
  `,
  styles: [`
    .control-panel {
      padding: 0;
    }
    .control-panel__section {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .control-panel__row {
      display: flex;
      gap: 1rem;
    }
    .control-panel__item {
      flex: 1;
    }
.control-panel__slider-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.control-panel__slider-container {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.control-panel__slider {
  flex: 1;
}

.control-panel__slider-input {
  width: 80px;
}
  `]
})
export class VisualizationControlsComponent implements OnInit, OnDestroy {
  @Input() currentActiveForms!: Signal<ActiveForm>;
  @Input() currentActiveLayer!: Signal<LayerTypes>;
  @Input() currentEventData!: Signal<EventMetadata | null>;
  @Input() pathForms!: FormGroup;
  @Input() pointForms!: FormGroup;
  @Input() aggregationForms!: FormGroup;
  @Input() ColorRangeThemes!: Color[][];
  @Input() isMobile: boolean = false;

  @Output() pathControlChange = new EventEmitter<PathControlChangeEvent>();
  @Output() pointControlChange = new EventEmitter<PointControlChangeEvent>();
  @Output() aggregationControlChange = new EventEmitter<AggregationControlChangeEvent>();

  private readonly destroyRef = inject(DestroyRef);
  private subscriptions: Subscription[] = [];

  constructor() {
    effect(() => {
      if (this.currentEventData()) {
        this.pathForms.enable({ emitEvent: false });
        this.pointForms.enable({ emitEvent: false });
        this.aggregationForms.enable({ emitEvent: false });
      } else {
        this.pathForms.disable({ emitEvent: false });
        this.pointForms.disable({ emitEvent: false });
        this.aggregationForms.disable({ emitEvent: false });
      }
    });
  }

  ngOnInit(): void {
    this.setupFormSubscriptions();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  private setupFormSubscriptions(): void {
    const pathControls = ['widthScale', 'widthMinPixels', 'opacity'];
    pathControls.forEach(controlName => {
      this.subscriptions.push(this.subscribeToControl<PathControlValue>(this.pathForms, controlName, this.onPathControlChange));
    });

    const pointControls = ['getRadius', 'radiusMinPixels', 'opacity'];
    pointControls.forEach(controlName => {
      this.subscriptions.push(this.subscribeToControl<PointControlValue>(this.pointForms, controlName, (value, option) => this.onPointControlChange(value, option)));
    });

    const aggregationControls = [
      'radiusPixels', 'intensity', 'threshold', 'radius', 'coverage',
      'upperPercentile', 'lowerPercentile', 'cellSizePixels'
    ];
    aggregationControls.forEach(controlName => {
      if (this.aggregationForms.controls[controlName]) {
        this.subscriptions.push(this.subscribeToControl<AggregationControlValue>(this.aggregationForms, controlName, this.onAggregationControlChange));
      }
    });
  }

  private subscribeToControl<T>(
    formGroup: FormGroup,
    controlName: string,
    callback: (value: T, option: string) => void
  ): Subscription {
    const control = this.getControl(formGroup, controlName);
    return control.valueChanges.pipe(
      distinctUntilChanged(),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(value => callback.call(this, value as T, controlName));
  }


  onPathControlChange(value: PathControlValue, option: string) {
    this.pathControlChange.emit({ value, option });
  }

  onPointControlChange(value: PointControlValue, option: string, colorChange: boolean = false) {
    this.pointControlChange.emit({ value, option, colorChange });
  }

  onAggregationControlChange(value: AggregationControlValue, option: string) {
    this.aggregationControlChange.emit({ value, option });
  }

  getControl(formGroup: FormGroup, controlName: string): FormControl {
    return formGroup.get(controlName) as FormControl;
  }
}
