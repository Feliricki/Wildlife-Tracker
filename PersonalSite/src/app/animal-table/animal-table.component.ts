import { Component, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableDataSource } from '@angular/material/table';
import { IndividualJsonDTO } from '../studies/JsonResults/IndividualJsonDTO';
import { FormGroup, FormsModule } from '@angular/forms';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';

@Component({
  selector: 'app-animal-table',
  standalone: true,
  imports: [CommonModule, FormsModule, MatPaginatorModule],
  templateUrl: './animal-table.component.html',
  styleUrl: './animal-table.component.css'
})
export class AnimalTableComponent {
  individuals?: MatTableDataSource<IndividualJsonDTO>;
  displayedColumns = ["name"];

  readonly defaultPageIndex = 0;
  readonly defaultPageSize = 15;

  readonly defaultSortColumn = "name";
  readonly defaultFilterColumn = "name";

  searchForm = new FormGroup({});
  @ViewChild(MatPaginator) paginator!: MatPaginator;
}
