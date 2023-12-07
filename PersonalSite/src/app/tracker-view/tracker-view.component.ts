import { Component, OnInit, WritableSignal, signal } from '@angular/core';
import { MapComponent } from '../google-maps/google-map.component';
import { SimpleSearchComponent } from '../simple-search/simple-search.component';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatButtonModule } from '@angular/material/button';
import { EventsComponent } from '../events/events.component';
import { StudyDTO } from '../studies/study';
import { EventJsonDTO } from '../studies/JsonResults/EventJsonDTO';

@Component({
  selector: 'app-tracker-view',
  templateUrl: './tracker-view.component.html',
  styleUrls: ['./tracker-view.component.css'],
  standalone: true,
  imports: [
    EventsComponent, MatSidenavModule,
    MatButtonModule, SimpleSearchComponent,
    MapComponent]
})
export class TrackerViewComponent implements OnInit {
  options = {
    fixed: true,
    bottom: 0,
    top: 0
  };
  searchOpened: WritableSignal<boolean> = signal(false);

  currentMarker: bigint | undefined;
  currentStudies: Map<bigint, StudyDTO> | undefined;

  displayedEvents: EventJsonDTO[] | undefined;

  currentStudy: StudyDTO | undefined;
  studyEventMessage: StudyDTO | undefined;

  constructor() {
    return;
  }

  ngOnInit(): void {
    return;
  }

  initializeSearchNav(): void {
    console.log("Initializing search component");
    this.searchOpened.set(true);
  }

  switchSearchMode(): void {
    return;
  }
  // This message is received on the event component
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

  toggleLeft(): void {
    return;
  }
}
