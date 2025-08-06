import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AnimalDataPanelComponent } from './animal-data-panel.component';

describe('AnimalDataPanelComponent', () => {
    let component: AnimalDataPanelComponent;
    let fixture: ComponentFixture<AnimalDataPanelComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [AnimalDataPanelComponent]
        })
            .compileComponents();

        fixture = TestBed.createComponent(AnimalDataPanelComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
