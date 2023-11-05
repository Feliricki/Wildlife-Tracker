import { Component, OnInit, ViewChild, signal, WritableSignal } from '@angular/core';
import { StudyService } from '../studies/study.service';
import { StudyDTO } from '../studies/study';
import { Observable, Subject, reduce, tap, distinctUntilChanged, debounceTime, forkJoin, map, catchError, of, filter, EMPTY, concat } from 'rxjs';
import { FormGroup, FormControl } from '@angular/forms';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatTableDataSource } from '@angular/material/table'
import { ENAAPIService } from '../ENA-API/ena-api.service';
import { WikipediaSearchService } from '../wikipedia/wikipedia-search.service';
import { Pages } from '../wikipedia/wikipedia-responses';

interface WikiLinks {
  title: string;
  link: string;
}

@Component({
  selector: 'app-simple-search',
  templateUrl: './simple-search.component.html',
  styleUrls: ['./simple-search.component.scss']
})
export class SimpleSearchComponent implements OnInit {

  studies: MatTableDataSource<StudyDTO> | undefined;
  displayedColumns = ["name"];

  panelExpanded: boolean[] | undefined;
  commonNames: (Observable<string> | undefined)[] = [];
  wikipediaLinks: (Observable<WikiLinks[] | undefined>)[] = [];

  defaultPageIndex: number = 0;
  defaultPageSize: number = 10;

  defaultSortColumn: string = "name";
  defaultFilterColumn: string = "name";
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
      this.commonNames.push(undefined);
      this.wikipediaLinks.push(of(undefined));
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

  getTaxa(taxaStr: string): Observable<string> {
    let taxaList = taxaStr.trim().split(",");
    if (!taxaList) {
      return of('');
    }

    let combined$ = forkJoin(
      taxaList.map(taxon => {

        return this.enaService.getCommonName(taxon.trim()).pipe(

          map(taxonIds => {
            if (taxonIds.length > 0) {
              return [taxon, taxonIds[0].commonName ?? null];
            } else {
              return [taxon, null];
            }
          }),
          catchError(_ => {
            console.error("Caught error in ENA service with taxon: " + taxon);
            return of([taxon, null]);
          }),
        );

      }));
    return combined$.pipe(

      map(result => {
        return result.reduce<string[]>((acc, value) => {
          if (value[1] === null) {
            acc.push(`${value[0]}`);
          } else {
            acc.push(`${value[0]} (${value[1]})`);
          }
          return acc;
        }, [] as string[]);
      }),

      map(acc => {
        if (acc.length === 1) {
          return acc[0];
        } else {
          return acc.join(", ");
        }
      }),

    );
  }

  getWikipediaLinks(taxaStr: string): Observable<WikiLinks[] | undefined> {
    let taxaList = taxaStr.trim().split(',');
    if (!taxaList) {
      return of([]);
    }

    // Make the initial http request and filters for results with pages and titles
    let combined$ = forkJoin(
      taxaList.map(taxon => {
        return this.wikipediaService.search(taxon).pipe(
          map(result => {
            return result.pages;
          }),
          catchError(_ => {
            console.error("Error retrieving wikipedia searches");
            return of([]);
          }),
          map(pages => pages.filter(page => page.title !== undefined)),
          map(pages => pages[0]?.title ?? ""),
        );
      })
    );

    // shape the data
    return combined$.pipe(
      map(titles => titles.filter(title => title !== "")),
      map(titles => titles.map(curTitle => {
        let obj: WikiLinks = { title: curTitle, link: `https://en.wikipedia.org/wiki/${encodeURIComponent(curTitle)}` };
        return obj;
      })),
    )
  }

  searchTitles(taxaStr: string): Observable<WikiLinks[]> {
    let taxaList = taxaStr.trim().split(',');
    if (!taxaList) {
      console.log(taxaList);
      return of([]);
    }
    // This function ensures that requests are done in sequence to avoid overloading the external server
    // TODO:
    // refactor function names
    // work on displaying event data
    let results = concat(...taxaList.map(taxa => {
      return this.wikipediaService.searchTitles(taxa).pipe(



        map(responses => {
          let ret: WikiLinks[] = [];

          responses[1].forEach((value, index) => {
            let obj: WikiLinks = { title: value, link: responses[3][index] };
            ret.push(obj);
          });
          return ret;
        }),

        catchError(_ => {
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

    let pageEvent = new PageEvent();
    pageEvent.pageIndex = 0;
    pageEvent.pageSize = this.paginator?.pageSize ?? this.defaultPageSize;
    this.getData(pageEvent);
  }

  loadData(query?: string) {
    console.log("Calling loadData with query: " + query);
    let pageEvent = new PageEvent();
    pageEvent.pageIndex = this.defaultPageIndex;
    pageEvent.pageSize = this.defaultPageSize
    this.getData(pageEvent);
  }

  // TODO: Use external api to get the common name for displayed taxa
  // look up rates of API usage vs bing's api
  getData(event: PageEvent) {
    let pageIndex = event.pageIndex;
    let pageSize = event.pageSize;
    // sortColumn should always be 'name'
    let sortColumn = this.defaultSortColumn;
    let sortOrder = this.dropDownList.value;
    // filterColumn should alwawys be 'name'
    let filterColumn = this.defaultFilterColumn;
    let filterQuery = this.filterQuery.value;

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
        this.commonNames = [];
        this.wikipediaLinks = [];
        for (let i = 0; i < this.paginator.pageSize; i++) {
          let cur_Obs = this.getTaxa(this.studies.data[i].taxonIds ?? "");
          // let wikiObj = this.getWikipediaLinks(this.studies.data[i].taxonIds ?? "");
          let wikiObj = this.searchTitles(this.studies.data[i].taxonIds ?? "");
          this.commonNames.push(cur_Obs);
          this.wikipediaLinks.push(wikiObj);
        }
      },
      error: error => {
        console.log(error);
      }
    }
    )
  }
}
