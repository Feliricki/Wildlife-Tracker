import { Component, OnInit } from '@angular/core';
import { MapComponent } from '../google-maps/google-map.component';
import { SimpleSearchComponent } from '../simple-search/simple-search.component';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatButtonModule } from '@angular/material/button';
import { EventsComponent } from '../events/events.component';
import { StudyDTO } from '../studies/study';
import { EventJsonDTO } from '../studies/JsonResults/EventJsonDTO';
import { Observable } from 'rxjs';
import { JsonResponseData } from '../studies/JsonResults/JsonDataResponse';

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
  currentMarker: bigint | undefined;
  currentStudies: Map<bigint, StudyDTO> | undefined;

  // toggledStudies: Map<bigint, StudyDTO> | undefined;
  toggledStudy: StudyDTO | undefined;
  displayedEvents: EventJsonDTO[] | undefined;
  jsonPayload: Observable<JsonResponseData[]> | undefined;

  constructor() {
    return;
  }

  ngOnInit(): void {
    return;
  }

  sendJsonSubscription(jsonData: Observable<JsonResponseData[]>): void {
    this.jsonPayload = jsonData;
  }

  toggleEventForStudy(studyDTO: StudyDTO): void {
    console.log(`Sending request for study ${studyDTO.id}`);
    this.toggledStudy = studyDTO;
  }

  updateMarkers(studies: Map<bigint, StudyDTO>): void {
    console.log("Updated studies in tracker view");
    this.currentStudies = studies;
  }
  switchSearchMode(): void {
    return;
  }

  panToMarker(studyId: bigint): void {
    this.currentMarker = studyId;
  }

  toggleLeft(): void {
    return;
  }
}
