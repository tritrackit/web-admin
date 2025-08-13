import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UnitTrackerComponent } from './unit-tracker.component';

describe('UnitTrackerComponent', () => {
  let component: UnitTrackerComponent;
  let fixture: ComponentFixture<UnitTrackerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UnitTrackerComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UnitTrackerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
