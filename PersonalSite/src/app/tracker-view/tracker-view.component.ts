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
import { BreakpointObserver } from '@angular/cdk/layout';
import { Subscription } from 'rxjs';

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

    trigger('toggleClick', [

      transition('void => *', [
        style({ transform: 'translateX(-100%)' }),
        animate('.3s ease-in')
      ]),

    ]),

  ]
})
export class TrackerViewComponent implements OnInit, OnDestroy {
  options = {
    fixed: true,
    bottom: 0,
    top: 0
  };
  searchOpened: WritableSignal<boolean> = signal(false);

  currentMarker?: bigint;
  currentStudies?: Map<bigint, StudyDTO>;

  displayedEvents?: EventJsonDTO[];

  currentStudy?: StudyDTO;
  studyEventMessage?: StudyDTO;
  @ViewChild(MatSidenav) sidenav!: MatSidenav;

  buttonFlag: WritableSignal<boolean> = signal(false);

  breakpointSubcriptions: Subscription[] = [];

  constructor(private breakpointObserver: BreakpointObserver) {
    return;
  }

  ngOnInit(): void {
    return;
  }

  ngOnDestroy(): void {
    for (const subscription of this.breakpointSubcriptions) {
      subscription.unsubscribe();
    }
  }

  initializeSearchNav(): void {
    console.log("Initializing search component");
    this.searchOpened.set(true);
  }

  switchSearchMode(): void {
    return;
  }
  // NOTE: This message is received on the event component
  studyMessage(study: StudyDTO): void {
    this.currentStudy = study;
  }

  studiesMessage(studies: Map<bigint, StudyDTO>): void {
    console.log(`studiesMessage: size = ${studies.size}`);
    this.currentStudies = studies;
  }

  panToMarker(studyId: bigint): void {
    this.currentMarker = studyId;
  }

  closeSearchNav(): void {
    this.sidenav.close();
    // this.sidenav.close().then(() => {
    //   console.log("closed nav.");
    //   this.buttonFlag.set(true);
    // });
    this.buttonFlag.set(true);
  }

  openSearchNav(): void {
    this.sidenav.open().then(() => {
      this.buttonFlag.set(false);
    })
  }
}
