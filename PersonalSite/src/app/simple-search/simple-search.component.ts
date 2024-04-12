import { Component, OnInit, ViewChild, signal, WritableSignal, Output, EventEmitter, Input, OnChanges, SimpleChanges, AfterViewInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { StudyService } from '../studies/study.service';
import { StudyDTO } from '../studies/study';
import { Observable, Subject, reduce, distinctUntilChanged, debounceTime, map, catchError, of, concat, EMPTY } from 'rxjs';
import { FormGroup, FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatPaginator, PageEvent, MatPaginatorModule } from '@angular/material/paginator';
import { MatRadioModule } from '@angular/material/radio';
import { MatTableDataSource, MatTableModule } from '@angular/material/table'
import { ENAAPIService } from '../ENA-API/ena-api.service';
import { WikipediaSearchService } from '../wikipedia/wikipedia-search.service';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatOptionModule } from '@angular/material/core';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { NgIf, NgFor, AsyncPipe, DatePipe, NgStyle } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete'
import { AutoComplete } from '../auto-complete/auto-complete';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { BreakpointObserver, BreakpointState, Breakpoints } from '@angular/cdk/layout';


interface WikiLinks {
  title: string;
  link: string;
}

@Component({
  selector: 'app-simple-search',
  templateUrl: './simple-search.component.html',
  styleUrls: ['./simple-search.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgIf, MatTableModule, MatTooltipModule,
    FormsModule, ReactiveFormsModule,
    MatFormFieldModule, MatInputModule,
    MatOptionModule, MatExpansionModule, MatIconModule,
    NgStyle, NgFor, MatPaginatorModule, MatDividerModule,
    AsyncPipe, DatePipe, MatProgressSpinnerModule,
    MatRadioModule, MatButtonModule, MatAutocompleteModule,
    ]
})
export class SimpleSearchComponent implements OnInit, OnChanges, AfterViewInit, OnDestroy {

  studies: MatTableDataSource<StudyDTO> | undefined;
  displayedColumns = ["name"];

  panelExpanded: boolean[] | undefined;
  commonNames$: (Observable<string> | undefined)[] = [];
  wikipediaLinks$: (Observable<WikiLinks[]> | undefined)[] = [];
  autoComplete?: AutoComplete;

  defaultPageIndex = 0;
  defaultPageSize = 10;

  defaultSortColumn = "name";
  defaultFilterColumn = "name";
  filterTextChanged: Subject<string> = new Subject<string>();

  currentOptions: WritableSignal<string[]> = signal([]);
  studiesLoaded: WritableSignal<boolean> = signal(false);

  // This form group is the source of truth
  searchForm = new FormGroup({
    filterQuery: new FormControl<string>("", { nonNullable: true }),
    dropDownList: new FormControl<"asc" | "desc">("asc", { nonNullable: true }),
  });

  @ViewChild(MatPaginator) paginator!: MatPaginator;

  // NOTE: This message is sent to the tracker component and is then sent to the map component
  @Output() panToMarkerEvent = new EventEmitter<bigint>();
  @Output() componentInitialized = new EventEmitter<true>();
  @Output() closeComponent = new EventEmitter<true>();

  @Input() allStudies?: Map<bigint, StudyDTO>;
  studyNames: string[] = [];

  // We can use the breakpoint observer to change the expanded and collapsed height dynamically.
  breakpointMatches: WritableSignal<boolean> = signal(false);
  screenChange?: Observable<boolean>;

  smallHeaderStyle = {
    'min-width': '80px',
    'max-width': '350px',
    'word-break': 'break-word'
  }

  largeHeaderStyle = {
    'width': '350px',
    'word-break' : 'break-word'
  }

  smallContentStyle = {
    'min-width': '80px',
    'max-width': '310px',
    'word-break': 'break-word'
  }

  largeContentStyle = {
    'width': '310px',
    'word-break': 'break-word'
  }

  constructor(
    private studyService: StudyService,
    private enaService: ENAAPIService,
    private wikipediaService: WikipediaSearchService,
    private breakpointObserver: BreakpointObserver,
  ) {
    return;
  }

  currentDate(): Date {
    const date = new Date();
    return date;
  }

  ngOnInit(): void {
    for (let i = 0; i < this.defaultPageSize; i++) {
      this.commonNames$.push(undefined);
      this.wikipediaLinks$.push(undefined);
    }

    this.loadData();
    this.screenChange = this.breakpointObserver
      .observe([Breakpoints.XSmall, Breakpoints.Small]).pipe(
        map((state: BreakpointState) => {
          this.breakpointMatches.set(state.matches)
          return state.matches;
        }),
      );
  }

  ngOnChanges(changes: SimpleChanges): void {
    for (const propertyName in changes) {
      const currentValue = changes[propertyName].currentValue;
      if (currentValue === undefined) {
        continue;
      }
      switch (propertyName) {
        // INFO: This component recieves studies retreived from the map component to use autocomplete.
        case "allStudies":
          this.allStudies = currentValue as Map<bigint, StudyDTO>;
          this.studyNames = Array.from(this.allStudies.values()).map(value => value.name);
          this.initializeAutoComplete(this.studyNames);
          break;
        default:
          break;
      }
    }
  }

  ngAfterViewInit(): void {
    this.componentInitialized.emit(true);
  }

  ngOnDestroy(): void {
    return;
  }

  emitCloseComponentMessage(): void {
    this.closeComponent.emit(true);
  }

  getAutoCompleteOptions(query: string): string[] {
    return this.autoComplete?.getWordsWithPrefix(query, 5) ?? [];
  }

  // NOTE: The list of studies are initialized only once.
  initializeAutoComplete(words: string[]): void {
    if (this.autoComplete !== undefined) {
      return;
    }
    this.autoComplete = new AutoComplete(words);
  }

  trackStudy(index: number, item: StudyDTO): string {
    return `${item.id}`;
  }


  hasLocation(study: StudyDTO): boolean {
    if (!this.studies) {
      return false;
    }
    return study.mainLocationLat !== undefined && study.mainLocationLon !== undefined;
  }

  filterEvent(text?: string): void {
    if (text === undefined) {
      return;
    }
    if (!this.filterTextChanged.observed) {
      this.filterTextChanged
        .pipe(
          debounceTime(100),
          distinctUntilChanged(),
        ).subscribe({

          next: (query) => {
            this.currentOptions.set(this.getAutoCompleteOptions(query));
          },
          error: err => console.log(err)
        });
    }
    this.filterTextChanged.next(text);
  }

  panToMarker(studyId: bigint): void {
    this.panToMarkerEvent.emit(studyId);
    // TODO: This message emits for smaller screens.
    if (this.breakpointMatches()) {
      this.emitCloseComponentMessage();
    }
  }

  // getters
  get filterQuery(): FormControl<string> {
    return this.searchForm.controls.filterQuery;
  }

  get dropDownList(): FormControl<"asc" | "desc"> {
    return this.searchForm.controls.dropDownList;
  }

  getTaxa(taxaStr: string): Observable<string> {
    const taxaList = taxaStr.trim().split(",");
    if (!taxaStr || taxaList.length === 0) {
      return EMPTY;
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

        catchError((err) => {
          console.error(err)
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
    this.searchForm.controls.dropDownList.setValue(ordering);

    const pageEvent = new PageEvent();
    pageEvent.pageIndex = 0;
    pageEvent.pageSize = this.paginator?.pageSize ?? this.defaultPageSize;
    this.getData(pageEvent);
  }

  clearInput() {
    if (this.filterQuery.value !== ""){
      this.filterQuery.setValue("");
      this.loadData();
    }
  }

  loadData(query?: string) {
    if (query) {
      this.filterQuery.setValue(query);
    }
    const pageEvent = new PageEvent();
    pageEvent.pageIndex = this.defaultPageIndex;
    pageEvent.pageSize = this.defaultPageSize
    this.getData(pageEvent);
  }

  selectOption(event: MatAutocompleteSelectedEvent) {
    this.loadData(event.option.viewValue);
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

    // TODO: Test loading speed with local database.
    this.studyService.getStudies(
      pageIndex,
      pageSize,
      sortColumn,
      sortOrder,
      filterColumn,
      filterQuery).
      subscribe({
        next: apiResult => {
          this.studiesLoaded.set(true);

          this.paginator.length = apiResult.totalCount;
          this.paginator.pageIndex = apiResult.pageIndex;
          this.paginator.pageSize = apiResult.pageSize;


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
          console.error(error);
        }
      }
      );
  }
}
