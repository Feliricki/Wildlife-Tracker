import { Component, OnInit, ViewChild, signal, WritableSignal } from '@angular/core';
import { StudyService } from '../studies/study.service';
import { StudyDTO } from '../studies/study';
import { Observable, Subject, reduce, distinctUntilChanged, debounceTime, map, catchError, of, concat, EMPTY } from 'rxjs';
import { FormGroup, FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatPaginator, PageEvent, MatPaginatorModule } from '@angular/material/paginator';
import { MatTableDataSource, MatTableModule } from '@angular/material/table'
import { ENAAPIService } from '../ENA-API/ena-api.service';
import { WikipediaSearchService } from '../wikipedia/wikipedia-search.service';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatOptionModule } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { NgIf, NgFor, AsyncPipe, DatePipe } from '@angular/common';

interface WikiLinks {
  title: string;
  link: string;
}

@Component({
  selector: 'app-simple-search',
  templateUrl: './simple-search.component.html',
  styleUrls: ['./simple-search.component.scss'],
  standalone: true,
  imports: [NgIf, MatTableModule, FormsModule, ReactiveFormsModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatOptionModule, MatExpansionModule,
    NgFor, MatPaginatorModule, AsyncPipe, DatePipe]
})
export class SimpleSearchComponent implements OnInit {

  studies: MatTableDataSource<StudyDTO> | undefined;
  displayedColumns = ["name"];

  panelExpanded: boolean[] | undefined;
  commonNames$: (Observable<string> | undefined)[] = [];
  wikipediaLinks$: (Observable<WikiLinks[]> | undefined)[] = [];

  defaultPageIndex = 0;
  defaultPageSize = 10;

  defaultSortColumn = "name";
  defaultFilterColumn = "name";
  filterTextChanged: Subject<string> = new Subject<string>();

  studiesLoaded: WritableSignal<boolean> = signal(false);
  // This form group is the source of truth
  searchForm = new FormGroup({
    filterQuery: new FormControl<string>("", { nonNullable: true }),
    dropDownList: new FormControl<"asc" | "desc">("asc", { nonNullable: true })
  });

  @ViewChild(MatPaginator) paginator!: MatPaginator;

  constructor(
    private studyService: StudyService,
    private enaService: ENAAPIService,
    private wikipediaService: WikipediaSearchService) {
  }

  ngOnInit(): void {
    // this.panelExpanded = [];
    for (let i = 0; i < this.defaultPageSize; i += 1) {
      // this.panelExpanded.push(false);
      this.commonNames$.push(undefined);
      this.wikipediaLinks$.push(undefined);
    }
    this.loadData();
  }


  filterEvent(text?: string): void {
    if (!text) {
      return;
    }
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

  // getters
  get filterQuery(): FormControl<string> {
    return this.searchForm.controls.filterQuery;
  }


  get dropDownList(): FormControl<"asc" | "desc"> {
    return this.searchForm.controls.dropDownList;
  }

  // TODO: Change this method to use the concat functions
  getTaxa(taxaStr: string): Observable<string> {
    const taxaList = taxaStr.trim().split(",");
    if (!taxaStr || taxaList.length === 0) {
      console.log("empty observable in getTaxa");
      return EMPTY;
      // return of('');
    }

    const combined$ = concat(...taxaList.map(taxon => {

      return this.enaService.getCommonName(taxon.trim()).pipe(

        map(taxonIds => {
          if (taxonIds.length > 0) {
            return [taxon, taxonIds[0].commonName ?? null];
          } else {
            return [taxon, null];
          }
        }),
        catchError(() => {
          console.error("Caught error in ENA service with taxon: " + taxon);
          return of([taxon, null]);
        }),
      );

    }));
    return combined$.pipe(
      reduce((acc, value) => {
        if (value[1] !== null) {
          acc.push(`${value[0]} (${value[1]})`);
        } else {
          acc.push(`${value[0]}`)
        }
        return acc;
      }, [] as string[]),
      map(strValues => {
        return strValues.join(', ');
      })
    );
  }


  searchWikipedia(taxaStr: string): Observable<WikiLinks[]> {
    const taxaList = taxaStr.trim().split(',');
    if (!taxaStr || taxaList.length === 0) {
      return of([]);
    }
    // This function ensures that requests are done in sequence to avoid overloading the external server
    const results = concat(...taxaList.map(taxa => {
      return this.wikipediaService.searchTitles(taxa).pipe(

        map(responses => {
          const ret: WikiLinks[] = [];

          responses[1].forEach((value, index) => {
            const obj: WikiLinks = { title: value, link: responses[3][index] };
            ret.push(obj);
          });
          return ret;
        }),

        catchError(() => {
          console.error("Error searching for wikipedia article.")
          return of([]);
        }),
      );
    }));


    return results.pipe(
      // Combine all emitted results into one list
      reduce((acc, value) => {
        acc.push(...value);
        return acc;
      }, [] as WikiLinks[]));

  }

  isExpanded(index: number): boolean {
    if (!this.panelExpanded) {
      return false;
    }
    return 0 <= index && index < this.panelExpanded.length
      && this.panelExpanded[index];
  }

  sortData(ordering: "asc" | "desc"): void {
    console.log(`New ordering: ` + ordering);
    this.searchForm.controls.dropDownList.setValue(ordering);

    const pageEvent = new PageEvent();
    pageEvent.pageIndex = 0;
    pageEvent.pageSize = this.paginator?.pageSize ?? this.defaultPageSize;
    this.getData(pageEvent);
  }

  loadData(query?: string) {
    console.log("Calling loadData with query: " + query);
    const pageEvent = new PageEvent();
    pageEvent.pageIndex = this.defaultPageIndex;
    pageEvent.pageSize = this.defaultPageSize
    this.getData(pageEvent);
  }

  // look up rates of API usage vs bing's api
  getData(event: PageEvent) {
    const pageIndex = event.pageIndex;
    const pageSize = event.pageSize;
    // sortColumn should always be 'name'
    const sortColumn = this.defaultSortColumn;
    const sortOrder = this.dropDownList.value;
    // filterColumn should alwawys be 'name'
    const filterColumn = this.defaultFilterColumn;
    const filterQuery = this.filterQuery.value;

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
        console.log(apiResult.data);
        this.studies = new MatTableDataSource(apiResult.data);
        this.commonNames$ = [];
        this.wikipediaLinks$ = [];
        for (let i = 0; i < Math.min(this.paginator.pageSize, apiResult.data.length); i++) {
          if (this.studies.data[i].taxonIds) {
            this.commonNames$.push(this.getTaxa(this.studies.data[i].taxonIds ?? ""));
            this.wikipediaLinks$.push(this.searchWikipedia(this.studies.data[i].taxonIds ?? ""));
          } else {
            this.commonNames$.push(undefined);
            this.wikipediaLinks$.push(undefined);
          }
        }
      },
      error: error => {
        console.log(error);
      }
    }
    )
  }
}
