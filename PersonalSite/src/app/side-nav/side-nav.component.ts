import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { StudyService } from '../studies/study.service';

@Component({
  selector: 'app-side-nav',
  templateUrl: './side-nav.component.html',
  styleUrls: ['./side-nav.component.css']
})
export class SideNavComponent {
  options = {
    fixed: true,
    bottom: 0,
    top: 0
  };
  constructor(
    private studyService: StudyService
  ) {
  }

  switchSearchMode(): void {

  }
}
