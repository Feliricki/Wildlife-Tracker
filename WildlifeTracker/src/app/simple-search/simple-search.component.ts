import { Component, OnInit, signal, WritableSignal, ChangeDetectionStrategy, inject, DestroyRef } from '@angular/core';
import { StudyService } from '../studies/study.service';
import { StudyDTO } from '../studies/study';
import { Observable, Subject, reduce, distinctUntilChanged, debounceTime, map, catchError, of, concat, EMPTY } from 'rxjs';
import { FormControl, FormsModule, ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { PageEvent, MatPaginatorModule } from '@angular/material/paginator';
import { MatRadioModule } from '@angular/material/radio';
import { MatTableDataSource, MatTableModule } from '@angular/material/table'
import { ENAAPIService } from '../ENA-API/ena-api.service';
import { WikipediaSearchService } from '../wikipedia/wikipedia-search.service';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatOptionModule } from '@angular/material/core';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { NgIf, AsyncPipe, DatePipe, NgStyle } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete'
import { AutoComplete } from '../auto-complete/auto-complete';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { BreakpointObserver, BreakpointState, Breakpoints } from '@angular/cdk/layout';
import { MatSelectModule } from '@angular/material/select';

// Import state services
import { UIStateService } from '../services/ui-state.service';
import { MapStateService } from '../services/map-state.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

interface WikiLinks {
  title: string;
  link: string;
}

@Component({
    selector: 'app-simple-search',
    templateUrl: './simple-search.component.html',
    styleUrls: ['./simple-search.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        NgIf, MatTableModule, MatTooltipModule,
        FormsModule, ReactiveFormsModule,
        MatFormFieldModule, MatInputModule,
        MatOptionModule, MatExpansionModule, MatIconModule,
        NgStyle, MatPaginatorModule, MatDividerModule,
        AsyncPipe, DatePipe, MatProgressSpinnerModule,
        MatRadioModule, MatButtonModule, MatAutocompleteModule,
        MatSelectModule
    ]
})
export class SimpleSearchComponent implements OnInit {
  // Inject services
  private readonly studyService = inject(StudyService);
  private readonly enaService = inject(ENAAPIService);
  private readonly wikipediaService = inject(WikipediaSearchService);
  private readonly breakpointObserver = inject(BreakpointObserver);
  private readonly fb = inject(FormBuilder);
  private readonly uiStateService = inject(UIStateService);
  private readonly mapStateService = inject(MapStateService);
  private readonly destroyRef = inject(DestroyRef);

  // State from services
  readonly allStudies = this.mapStateService.studies;
  readonly isSmallScreen = this.uiStateService.isSmallScreen;

  studies: WritableSignal<MatTableDataSource<StudyDTO> | undefined> = signal(undefined);
  displayedColumns = ["name"];

  panelExpanded: boolean[] | undefined;
  commonNames$: (Observable<string> | undefined)[] = [];
  wikipediaLinks$: (Observable<WikiLinks[]> | undefined)[] = [];
  autoComplete?: AutoComplete;

  defaultPageIndex = 0;
  defaultPageSize = 20;
  defaultSortColumn = "name";
  defaultFilterColumn = "name";
  filterTextChanged: Subject<string> = new Subject<string>();

  // UI signals
  screenIsSmall: WritableSignal<boolean> = signal(false);
  currentOptions: WritableSignal<string[]> = signal([]);
  studiesLoaded: WritableSignal<boolean> = signal(false);
  studyNames: WritableSignal<string[]> = signal([]);

  // Pagination state
  paginatorLength: WritableSignal<number> = signal(0);
  paginatorPageIndex: WritableSignal<number> = signal(0);
  paginatorPageSize: WritableSignal<number> = signal(20);

  searchForm = this.fb.nonNullable.group({
    filterQuery: "",
    dropDownList: this.fb.nonNullable.control<"asc" | "desc">("asc"),
    sortColumn: "name",
    filterColumn: "name",
  });

  // Styling for display of text content
  smallHeaderStyle = {
    'min-width': '80px',
    'max-width': '350px',
    'word-break': 'break-word'
  }

  largeHeaderStyle = {
    'width': '350px',
    'word-break': 'break-word'
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

  constructor() {
    this.setupStateSubscriptions();
  }

  private setupStateSubscriptions(): void {
    // Watch for studies changes from the map state service
    this.mapStateService.studies$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(studies => {
        if (studies && studies.size > 0) {
          const studyNamesArray = Array.from(studies.values()).map(study => study.name);
          this.studyNames.set(studyNamesArray);
          this.initializeAutoComplete(studyNamesArray);
        }
      });

    // Set up screen size observation
    this.breakpointObserver
      .observe([Breakpoints.XSmall, Breakpoints.Small])
      .pipe(
        map((state: BreakpointState) => state.matches),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(isSmall => {
        this.uiStateService.setScreenSize(isSmall, false);
        this.screenIsSmall.set(isSmall);
      });
  }

  currentDate(): Date {
    return new Date();
  }

  ngOnInit(): void {
    for (let i = 0; i < this.defaultPageSize; i++) {
      this.commonNames$.push(undefined);
      this.wikipediaLinks$.push(undefined);
    }

    this.loadData();
  }

  emitCloseComponentMessage(): void {
    this.uiStateService.closeLeftPanel();
  }

  getAutoCompleteOptions(query: string): string[] {
    return this.autoComplete?.getWordsWithPrefix(query, 5) ?? [];
  }

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
          takeUntilDestroyed(this.destroyRef)
        ).subscribe({
          next: (query) => {
            this.currentOptions.set(this.getAutoCompleteOptions(query));
          },
          error: err => console.error(err)
        });
    }
    this.filterTextChanged.next(text);
  }

  panToMarker(studyId: bigint): void {
    // Update the focused study in the map state service
    this.mapStateService.setFocusedStudy(studyId);

    // Get the study and set it as current
    const studies = this.allStudies();
    const study = studies.get(studyId);
    if (study) {
      this.mapStateService.setCurrentStudy(study);
      this.uiStateService.openRightPanel();
    }

    // Close search panel on small screens
    if (this.isSmallScreen()) {
      this.uiStateService.closeLeftPanel();
    }
  }

  // getters
  get getFilterQuery(): FormControl<string> {
    return this.searchForm.controls.filterQuery;
  }

  get getDropDownList(): FormControl<"asc" | "desc"> {
    return this.searchForm.controls.dropDownList;
  }

  get getSortColumn(): FormControl<string> {
    return this.searchForm.controls.sortColumn;
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
          acc.push(`${value[0]}`);
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
      reduce((acc, value) => {
        acc.push(...value);
        return acc;
      }, [] as WikiLinks[])
    );
  }

  isExpanded(index: number): boolean {
    if (!this.panelExpanded) {
      return false;
    }

    return 0 <= index && index < this.panelExpanded.length
      && this.panelExpanded[index];
  }

  selectSortBy(obj: object) {
    console.log("Sorting by " + obj);
    const pageEvent = new PageEvent();
    pageEvent.pageIndex = 0;
    pageEvent.pageSize = this.paginatorPageSize();
    this.getData(pageEvent);
  }

  sortData(ordering: "asc" | "desc"): void {
    this.searchForm.controls.dropDownList.setValue(ordering);

    const pageEvent = new PageEvent();
    pageEvent.pageIndex = 0;
    pageEvent.pageSize = this.paginatorPageSize();
    this.getData(pageEvent);
  }

  clearInput() {
    if (this.getFilterQuery.value !== "") {
      this.getFilterQuery.setValue("");
      this.loadData();
    }
  }

  selectOption(event: MatAutocompleteSelectedEvent) {
    this.loadData(event.option.viewValue);
  }

  loadData(query?: string) {
    if (query) {
      this.getFilterQuery.setValue(query);
    }

    const pageEvent = new PageEvent();
    pageEvent.pageIndex = this.defaultPageIndex;
    pageEvent.pageSize = this.defaultPageSize
    this.getData(pageEvent);
  }

  getData(event: PageEvent) {
    const pageIndex = event.pageIndex;
    const pageSize = event.pageSize;

    const sortOrder = this.searchForm.controls.dropDownList.value;
    const sortColumn = this.searchForm.controls.sortColumn.value;

    const filterColumn = this.searchForm.controls.filterColumn.value;
    const filterQuery = this.searchForm.controls.filterQuery.value;

    this.studyService.getStudies(
      pageIndex,
      pageSize,
      sortColumn,
      sortOrder,
      filterColumn,
      filterQuery
    ).pipe()
      .subscribe({
        next: apiResult => {
          this.studiesLoaded.set(true);

          // Update pagination state
          this.paginatorLength.set(apiResult.totalCount);
          this.paginatorPageIndex.set(apiResult.pageIndex);
          this.paginatorPageSize.set(apiResult.pageSize);

          this.studies.set(new MatTableDataSource(apiResult.data));
          this.commonNames$ = [];
          this.wikipediaLinks$ = [];

          for (let i = 0; i < Math.min(this.paginatorPageSize(), apiResult.data.length); i++) {
            if (this.studies()?.data[i].taxonIds) {
              this.commonNames$.push(this.getTaxa(this.studies()?.data[i].taxonIds ?? ""));
              this.wikipediaLinks$.push(this.searchWikipedia(this.studies()?.data[i].taxonIds ?? ""));
            } else {
              this.commonNames$.push(undefined);
              this.wikipediaLinks$.push(undefined);
            }
          }

          // Update studies in the map state service
          const studiesMap = new Map<bigint, StudyDTO>();
          apiResult.data.forEach(study => studiesMap.set(study.id, study));
          this.mapStateService.setStudies(studiesMap);
        },
        error: error => {
          console.error(error);
        }
      });
  }
}
