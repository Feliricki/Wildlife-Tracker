import { Component, Input, Output, EventEmitter, Signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSortModule } from '@angular/material/sort';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatIconModule } from '@angular/material/icon';
import { EventProfile } from '../animal-data-panel.component';
import { SourceState } from '../../HelperTypes/FormDataSource';
import { FormDataSource } from '../../HelperTypes/FormDataSource';
import { TagJsonDTO } from '../../studies/JsonResults/TagJsonDTO';
import { IndividualJsonDTO } from '../../studies/JsonResults/IndividualJsonDTO';

/**
 * This component is used to select individuals for an event retrieval.
 * Several fields are available to filter and select individuals
 */
@Component({
    selector: 'app-event-form',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatFormFieldModule,
        MatSelectModule,
        MatDividerModule,
        MatTooltipModule,
        MatButtonModule,
        MatTableModule,
        MatCheckboxModule,
        MatSortModule,
        MatProgressBarModule,
        MatIconModule
    ],
    template: `
    <form [formGroup]="eventForm" class="event-form" (ngSubmit)="onSubmit()">
      <div class="event-form__controls" [ngClass]="{'event-form__controls--mobile': isMobile}">
        <mat-form-field class="event-form__profile-select dense-5" [appearance]="isMobile ? 'fill' : 'outline'">
          <mat-label>Reduction Profile</mat-label>
          <mat-select formControlName="eventProfiles"
            [(value)]="selectedEventProfile"
            matTooltip="Limit the number of events to improve performance and reduce clutter.">
            @for (option of eventProfilesOptions; track option.value){
            <mat-divider></mat-divider>
            <mat-option [value]="option.value">{{option.name}}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-form-field class="event-form__sensor-select dense-5" [appearance]="isMobile ? 'fill' : 'outline'">
          <mat-label>Sensors</mat-label>
          <mat-select formControlName="sensorForm" matTooltip="Select a sensor type.">
            @for (option of currentLocationSensors(); track option) {
            <mat-divider></mat-divider>
            <mat-option [value]="option">{{ option }}</mat-option>
            } @empty {
            <mat-option [value]="null">-</mat-option>
            }
          </mat-select>

          @if (eventForm.dirty && eventForm.hasError("noSensorSelected")) {
          <mat-error>No Sensor Selected.</mat-error>
          }
        </mat-form-field>
      </div>
      
      <table mat-table formArrayName="checkboxes" matSort matSortDisableClear matSortActive="name"
        matSortDirection="asc" [dataSource]="tableSource" #Table [trackBy]="trackById" 
        class="event-form__table dense-5" [ngClass]="{'event-form__table--mobile': isMobile}">
        
        <ng-container matColumnDef="select">
          <th mat-header-cell *matHeaderCellDef>
            <mat-checkbox [checked]="isAllSelected()" [disabled]="TableState() !== 'loaded'"
              [indeterminate]="!isAllSelected() && IsPartiallySelected()"
              (change)="$event ? toggleAllRows() : null"></mat-checkbox>
          </th>
          <td mat-cell *matCellDef="let control; let j = index;" class="event-form__table-cell">
            <mat-checkbox [formControlName]="j" (click)="$event.stopPropagation()" (change)="toggleRow(j)"
              [id]="j"></mat-checkbox>
          </td>
          @if (!isMobile) {
          <td mat-footer-cell *matFooterCellDef>
            <button mat-raised-button class="event-form__submit-button"
              [disabled]="eventForm.invalid" color="primary" type="submit">
              Submit
            </button>
          </td>
          }
        </ng-container>

        <ng-container matColumnDef="name" class="ng-container">
          <th mat-header-cell class="event-form__table-header-cell" *matHeaderCellDef mat-sort-header
            sortActionDescription="Sort by name">
            <div class="event-form__table-header-content">
              <span>Animals</span>
              <mat-icon
                matTooltip="Each animal is assigned a unique individual identifier provided by the owner of the study."
                aria-label="false" fontIcon="info"></mat-icon>
            </div>
          </th>
          <td mat-cell *matCellDef="let control; let j = index;" class="event-form__table-cell">
            <p>{{ getIndividual(j)()?.LocalIdentifier ?? "N/A" }}</p>
          </td>
          @if (!isMobile) {
          <td mat-footer-cell *matFooterCellDef>
          </td>
          }
        </ng-container>

        <tr mat-header-row *matHeaderRowDef="displayedColumns; sticky:true"></tr>
        <tr mat-row *matRowDef="let row; let i = index; columns:displayedColumns;"></tr>
        @if (!isMobile) {
        <tr mat-footer-row *matFooterRowDef="displayedColumns; sticky: true">
        }
      </table>

      @if (isMobile) {
      <button mat-raised-button class="event-form__submit-button" [disabled]="eventForm.invalid"
        color="primary" type="submit">
        Submit
      </button>
      }
    </form>

    @if (TableState() === "loading"){
    <mat-progress-bar mode="indeterminate"></mat-progress-bar>
    }
  `,
    styles: [`
    .event-form {
      width: 100%;
    }
    
    .event-form__controls {
      display: flex;
      gap: 1rem;
      margin-bottom: 1rem;
    }
    
    .event-form__controls--mobile {
      flex-direction: column;
    }
    
    .event-form__profile-select {
      flex: 1;
    }
    
    .event-form__sensor-select {
      flex: 1;
    }
    
    .event-form__table {
      width: 100%;
      table-layout: fixed;
    }

    .event-form__table td, .event-form__table th {
      word-wrap: break-word;
      overflow-wrap: break-word;
    }
    
    .event-form__table td.mat-cell, .event-form__table th.mat-header-cell {
      padding: 0 8px;
    }

    .event-form__table--mobile {
      max-height: 300px;
    }
    
    .event-form__submit-button {
      margin-top: 1rem;
    }
  `]
})
export class AnimalSelectionFormComponent {
  @Input() eventForm!: FormGroup;
  @Input() tableSource!: FormDataSource;
  @Input() eventProfilesOptions!: EventProfile[];
  @Input() selectedEventProfile!: string;
  @Input() currentLocationSensors!: Signal<string[]>;
  @Input() isMobile: boolean = false;
  @Input() displayedColumns: string[] = ['select', 'name'];
  @Input() IsPartiallySelected!: Signal<boolean>;
  @Input() isAllSelected!: Signal<boolean>;
  @Input() TableState!: Signal<SourceState>;
  @Input() getIndividual!: (index: number) => Signal<TagJsonDTO | IndividualJsonDTO | null>;
  @Input() trackById!: (index: number) => number;
  @Input() toggleAllRows!: () => void;
  @Input() toggleRow!: (index: number) => void;

  @Output() submit = new EventEmitter<void>();


  onSubmit() {
    this.submit.emit();
  }
} 