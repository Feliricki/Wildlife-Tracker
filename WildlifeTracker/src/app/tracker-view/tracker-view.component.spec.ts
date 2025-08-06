import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MapDashboardComponent } from './tracker-view.component';

describe('SideNavComponent', () => {
  let component: MapDashboardComponent;
  let fixture: ComponentFixture<MapDashboardComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [MapDashboardComponent]
    });
    fixture = TestBed.createComponent(MapDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
