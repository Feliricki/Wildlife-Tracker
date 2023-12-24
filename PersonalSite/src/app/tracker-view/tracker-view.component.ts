import { Component, OnDestroy, OnInit, ViewChild, WritableSignal, signal } from '@angular/core';
import { MapComponent } from '../google-maps/google-map.component';
import { SimpleSearchComponent } from '../simple-search/simple-search.component';
import { MatSidenav, MatSidenavModule } from '@angular/material/sidenav';
import { MatButtonModule } from '@angular/material/button';
import { EventsComponent } from '../events/events.component';
import { StudyDTO } from '../studies/study';
import { EventJsonDTO } from '../studies/JsonResults/EventJsonDTO';
import { MatIconModule } from '@angular/material/icon';
import { animate, style, transition, trigger } from '@angular/animations';
import { BreakpointObserver, BreakpointState, Breakpoints } from '@angular/cdk/layout';
import { Observable, firstValueFrom, map } from 'rxjs';
import { LineStringFeatureCollection } from '../deckGL/GoogleOverlay';

@Component({
  selector: 'app-tracker-view',
  templateUrl: './tracker-view.component.html',
  styleUrls: ['./tracker-view.component.css'],
  standalone: true,
  imports: [
    EventsComponent, MatSidenavModule,
    MatButtonModule, SimpleSearchComponent,
    MapComponent, MatIconModule],
  animations: [

    trigger('leftToggleClick', [

      transition('void => *', [
        style({ transform: 'translateX(-100%)' }),
        animate('.3s ease-in'),
      ]),

    ]),

    trigger('rightToggleClick', [

      transition('void => *', [
        style({ transform: 'translateX(100%)' }),
        animate('.3s ease-in'),
      ]),
    ])

  ]
})
export class TrackerViewComponent implements OnInit, OnDestroy {
  options = {
    fixed: true,
    bottom: 0,
    top: 0
  };
  activeMap: 'google' | 'mapbox' = 'google';
  mapLoaded: WritableSignal<boolean> = signal(false);

  searchOpened: WritableSignal<boolean> = signal(false);

  currentEventLineData$?: Observable<LineStringFeatureCollection[] | null>;

  currentMarker?: bigint;
  currentStudies?: Map<bigint, StudyDTO>;

  displayedEvents?: EventJsonDTO[];

  currentStudy?: StudyDTO;
  studyEventMessage?: StudyDTO;

  @ViewChild('sidenav', { static: true }) sidenav!: MatSidenav;
  @ViewChild('rightSidenav', { static: true }) rightNav!: MatSidenav;
  @ViewChild('eventComponent') event!: EventsComponent;

  leftButtonFlag: WritableSignal<boolean> = signal(false);
  rightButtonFlag: WritableSignal<boolean> = signal(true);

  // breakpointSubcription?: Subscription;
  // breakpointMatches: WritableSignal<boolean> = signal(false);

  constructor(private breakpointObserver: BreakpointObserver) { }

  ngOnInit(): void {
    const observer = this.breakpointObserver
      .observe([Breakpoints.XSmall, Breakpoints.Small]).pipe(
        map((state: BreakpointState) => {
          return state.matches;
        }),
      );

    // Close the search component on smaller screens.
    firstValueFrom(observer).then(value => {
      if (value) {
        this.closeSearchNav();
      }
    });
    return;
  }

  ngOnDestroy(): void {
    return;
  }

  updateMapState(state: boolean): void {
    this.mapLoaded.set(state);
  }

  initializeSearchNav(): void {
    this.searchOpened.set(true);
  }

  switchSearchMode(): void {
    return;
  }

  updateLineStringData(
    event: Observable<LineStringFeatureCollection[] | null>): void {
    this.currentEventLineData$ = event;
  }

  // NOTE: This message is received on the event component
  // On mobile this should close the left sidenav if it's open.
  studyMessage(study: StudyDTO): void {
    if (study === undefined) {
      return;
    }
    this.openRightNav();
    this.currentStudy = study;
  }

  // NOTE: This message comes from the google maps component and is received in the search component
  // for it's autocomplete feature.
  studiesMessage(studies: Map<bigint, StudyDTO>): void {
    this.currentStudies = studies;
  }

  panToMarker(studyId: bigint): void {
    this.currentMarker = studyId;
  }

  closeRightNav(): void {
    this.rightNav.close();
    this.rightButtonFlag.set(true);
  }

  openRightNav(): void {
    console.log("Opening the event component.");
    if (this.rightNav.opened) {
      return;
    }
    this.rightNav.open().then(() => {
      this.rightButtonFlag.set(false);
    });
  }

  closeSearchNav(): void {
    this.sidenav.close();
    this.leftButtonFlag.set(true);
  }

  openSearchNav(): void {
    this.sidenav.open().then(() => {
      this.leftButtonFlag.set(false);
    })
  }
}
