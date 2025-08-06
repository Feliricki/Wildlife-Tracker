import { HttpClient } from '@angular/common/http';
//import { HttpClientTestingModule } from '@angular/common/http/testing';
//import { TestBed } from '@angular/core/testing';
import { StudyService } from './study.service';

describe('StudyService', () => {
  let httpSpy: jasmine.SpyObj<HttpClient>;
  let studyService: StudyService;

  beforeEach(() => {
    httpSpy = jasmine.createSpyObj('HttpClient', ['get']);
    studyService = new StudyService(httpSpy);
  });

  it('should be created', () => {
    expect(studyService).toBeTruthy();
  });

  it('#jsonRequest should return a valid jsonDTO', (done: DoneFn) => {
    const entityType: "study" | "individual" | "tag" = "study";
    const studyId = 2911040n;
    const sub = studyService.jsonRequest(entityType, studyId);

    sub.subscribe({
      next: (value) => {
        expect(value).toBeTruthy();
        done();
      },
      error: (err) => {
        console.error(err);
        done.fail;
      }
    })
  })

});
