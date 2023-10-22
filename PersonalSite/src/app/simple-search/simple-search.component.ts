import { Component, OnInit, ViewChild } from '@angular/core';
import { StudyService } from '../studies/study.service';
import { StudyDTO } from '../studies/study';
import { Observable } from 'rxjs';
import { FormGroup, FormControl } from '@angular/forms';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatTableDataSource } from '@angular/material/table'


@Component({
  selector: 'app-simple-search',
  templateUrl: './simple-search.component.html',
  styleUrls: ['./simple-search.component.css']
})
export class SimpleSearchComponent implements OnInit {

  // studySource$: Observable<StudyDTO[]> | undefined;
  studies: MatTableDataSource<StudyDTO> | undefined;
  displayedColumns = ["name"];

  panelExpanded: boolean[] | undefined;

  defaultPageIndex: number = 0;
  defaultPageSize: number = 10;

  defaultSortColumn: string = "name";
  defaultFilterColumn: string = "name";
  // defaultSortOrder: "asc" | "desc" = "asc";

  // This form group is the source of truth
  searchForm = new FormGroup({
    filterQuery: new FormControl<string>("", { nonNullable: true }),
    dropDownList: new FormControl<"asc" | "desc">("asc", { nonNullable: true })
  });

  @ViewChild(MatPaginator) paginator!: MatPaginator;

  constructor(private studyService: StudyService) {
  }


  entryClicked(index: number): void {
  }

  ngOnInit(): void {
    this.panelExpanded = [];
    for (let i = 0; i < this.defaultPageSize; i += 1) {
      this.panelExpanded.push(false);
    }
    this.loadData();
  }


  filterEvent(): void {
  }


  // getters
  get filterQuery(): FormControl<string> {
    return this.searchForm.controls.filterQuery;
  }


  get dropDownList(): FormControl<"asc" | "desc"> {
    return this.searchForm.controls.dropDownList;
  }

  isExpanded(index: number): boolean {
    if (!this.panelExpanded) {
      return false;
    }
    return 0 <= index && index < this.panelExpanded.length
      && this.panelExpanded[index];
  }

  // TODO - display at most 3 columns of information
  loadData(query?: string) {
    console.log("Calling loadData with query: " + query);
    let pageEvent = new PageEvent();
    pageEvent.pageIndex = this.defaultPageIndex;
    pageEvent.pageSize = this.defaultPageSize
    this.getData(pageEvent);
  }

  getData(event: PageEvent) {
    let pageIndex = event.pageIndex;
    let pageSize = event.pageSize;
    // sortColumn should always be 'name'
    let sortColumn = this.defaultSortColumn;
    let sortOrder = this.dropDownList.value;
    // filterColumn should alwawys be 'name'
    let filterColumn = this.defaultFilterColumn;
    let filterQuery = this.filterQuery.value;

    console.log(`Sending request for pageIndex=${pageIndex} pageSize=${pageSize} sortColumn=${sortColumn} sortOrder=${sortOrder} filterColumn=${filterColumn} filterQuery=${filterQuery}`)
    this.studyService.getStudies(
      pageIndex,
      pageSize,
      sortColumn,
      sortOrder,
      filterColumn,
      filterQuery
    ).subscribe({
      next: apiResult => {
        this.paginator.length = apiResult.totalCount;
        this.paginator.pageIndex = apiResult.pageIndex;
        this.paginator.pageSize = apiResult.pageSize;
        console.log("Got api response");
        console.log(apiResult.data);
        this.studies = new MatTableDataSource(apiResult.data);
      },
      error: error => {
        console.log(error);
      }
    }
    )
  }
}
