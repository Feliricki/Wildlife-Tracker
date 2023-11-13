import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TrackerViewComponent } from './tracker-view.component';

describe('SideNavComponent', () => {
  let component: TrackerViewComponent;
  let fixture: ComponentFixture<TrackerViewComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TrackerViewComponent]
    });
    fixture = TestBed.createComponent(TrackerViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
