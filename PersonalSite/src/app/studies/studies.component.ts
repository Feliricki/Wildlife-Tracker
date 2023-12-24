import { Component, OnInit, OnDestroy, ViewChild, WritableSignal, signal, Output, EventEmitter, AfterViewInit } from '@angular/core';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { StudyDTO } from './study';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatPaginator, PageEvent, MatPaginatorModule } from '@angular/material/paginator';
import { StudyService } from './study.service';
import { TruncatePipe } from '../pipes/truncate.pipe';
import { DefaultPipe } from '../pipes/default.pipe';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { NgIf } from '@angular/common';


@Component({
  selector: 'app-studies',
  templateUrl: './studies.component.html',
  styleUrls: ['./studies.component.css'],
  standalone: true,
  imports: [NgIf,
    MatFormFieldModule, MatInputModule,
    MatButtonModule, MatIconModule,
    MatTableModule, MatSortModule,
    MatPaginatorModule, DefaultPipe,
    TruncatePipe]
})
export class StudiesComponent implements OnInit, AfterViewInit, OnDestroy {
  public displayedColumns: string[] = ['name'];
  public sizeLimit = 50;

  public studies: MatTableDataSource<StudyDTO> | undefined;

  defaultPageIndex = 0;
  defaultPageSize = 10;
  public rowSignal: WritableSignal<boolean[]> = signal([]);

  public defaultSortColumn = "name";
  public defaultSortOrder: "asc" | "desc" = "asc";

  defaultFilterColumn = "name";
  filterQuery?: string;

  // This subject is meant to listen to changes in text the search text box every second a new change is made
  filterTextChanged: Subject<string> = new Subject<string>();

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  isActive = false;

  constructor(
    private studyService: StudyService,
  ) {
  }

  ngOnInit(): void {
    this.isActive = true;
    this.loadData();
  }

  ngAfterViewInit(): void {
    //this.componentInitialized.emit(true);
    return;
  }

  ngOnDestroy(): void {
    this.filterTextChanged.complete();
  }

  rowClicked(curIndex: number): void {
    this.rowSignal.update(rows => {
      rows[curIndex] = !rows[curIndex];
      return rows;
    });
  }

  onFilterTextChanged(text: string) {
    if (!this.filterTextChanged.observed) {
      this.filterTextChanged
        .pipe(
          debounceTime(1000),
          distinctUntilChanged(),
        ).subscribe({

          next: (query) => {
            this.loadData(query);
          },
          error: err => console.log(err)
        });
    }
    this.filterTextChanged.next(text);
  }

  // This method when filtering and on start up.
  loadData(query?: string) {
    console.log("Calling loadData with query: " + query);
    const pageEvent = new PageEvent();
    pageEvent.pageIndex = this.defaultPageIndex;
    pageEvent.pageSize = this.defaultPageSize;
    this.filterQuery = query;
    this.getData(pageEvent);
  }

  // This function is called when the current page changes
  getData(event: PageEvent) {

    const sortColumn = (this.sort)
      ? this.sort.active
      : this.defaultSortColumn;

    const sortOrder = (this.sort)
      ? this.sort.direction
      : this.defaultSortOrder;

    const filterColumn = (this.filterQuery)
      ? this.defaultFilterColumn
      : undefined;

    const filterQuery = (this.filterQuery)
      ? this.filterQuery
      : undefined;

    this.studyService.getStudies(
      event.pageIndex,
      event.pageSize,
      sortColumn,
      sortOrder,
      filterColumn,
      filterQuery,
    ).subscribe({
      next: apiResult => {
        console.log(apiResult);

        this.paginator.length = apiResult.totalCount;
        this.paginator.pageIndex = apiResult.pageIndex;
        this.paginator.pageSize = apiResult.pageSize;

        const newRow: boolean[] = [];
        for (let i = 0; i < this.paginator.pageSize; i += 1) {
          newRow.push(false);
        }
        this.rowSignal.set(newRow);
        this.studies = new MatTableDataSource(apiResult.data);
      },
      error: (err) => {
        console.log(err);
      }
    });
  }
}
