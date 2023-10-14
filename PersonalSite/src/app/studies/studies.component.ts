import { Component, OnInit, AfterViewInit, OnDestroy, ViewChild } from '@angular/core';
// import { HttpClient, HttpParams } from '@angular/common/http';
//import { ActivatedRoute, Router } from '@angular/router';
import { Observable, Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, map, takeUntil } from 'rxjs/operators';
import { StudyDTO } from './study';
import { MatTableDataSource } from '@angular/material/table';
import { MatSort } from '@angular/material/sort';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { StudyService } from './study.service';

//interface StudyDTO {
//  name: string;
//  id: bigint;
//  timestampFirstDeployedLocation?: Date;
//  timestampLastDeployedLocation?: Date;
//  numberOfIndividuals: number;
//  taxonIds: string;
//}

@Component({
  selector: 'app-studies',
  templateUrl: './studies.component.html',
  styleUrls: ['./studies.component.css']
})
export class StudiesComponent implements OnInit, OnDestroy {
  public displayedColumns: string[] = ['name', 'timestampFirstDeployedLocation', 'timestampLastDeployedLocation', 'numberOfIndividuals', 'taxonIds'];
  public expandedRow: boolean[] = this.displayedColumns.map(() => false);

  public studies!: MatTableDataSource<StudyDTO>;

  defaultPageIndex: number = 0;
  defaultPageSize: number = 10;

  public defaultSortColumn: string = "name";
  public defaultSortOrder: "asc" | "desc" = "asc";

  defaultFilterColumn: string = "name";
  filterQuery?: string;

  //filterTextChanged: WritableSignal<string> = signal("");
  filterTextChanged: Subject<string> = new Subject<string>();

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  isActive: boolean = false;

  constructor(
    private studyService: StudyService,
    //
  ) {
  }
  // TODO: implement
  ngOnInit(): void {
    this.isActive = true;
    this.loadData();
  }

  ngOnDestroy(): void {
    this.filterTextChanged.complete();
  }

  rowClicked(row: StudyDTO, curRow: any): void {
    //this.studies.
    console.log(curRow);
    return;
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
    let pageEvent = new PageEvent();
    pageEvent.pageIndex = this.defaultPageIndex;
    pageEvent.pageSize = this.defaultPageSize;
    this.filterQuery = query;
    this.getData(pageEvent);
  }

  // This function is called when the current page changes
  getData(event: PageEvent) {

    var sortColumn = (this.sort)
      ? this.sort.active
      : this.defaultSortColumn;

    var sortOrder = (this.sort)
      ? this.sort.direction
      : this.defaultSortOrder;

    var filterColumn = (this.filterQuery)
      ? this.defaultFilterColumn
      : undefined;

    var filterQuery = (this.filterQuery)
      ? this.filterQuery
      : undefined;

    console.log(`getData: event.page=${event.pageIndex} event.pageSize=${event.pageSize} sortColumn=${sortColumn} sortOrder=${sortOrder} filterColumn=${filterColumn} filterQuery=${filterQuery}`)
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

        this.studies = new MatTableDataSource(apiResult.data);
      },
      error: (err) => {
        console.log(err);
      }
    });
  }
}

//let asStudies: StudyDTO[] = apiResult.data.map(studyDTO => {
//  let study: StudyDTO = {
//    name: studyDTO.name,
//    id: studyDTO.id,
//    timestampFirstDeployedLocation: studyDTO.timestampFirstDeployedLocation,
//    timestampLastDeployedLocation: studyDTO.timestampLastDeployedLocation,
//    numberOfIndividuals: studyDTO.numberOfIndividuals,
//    taxonIds: studyDTO.taxonIds ?? ""
//  };
//  return study;
//});
