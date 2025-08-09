import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OptionSheetComponent } from './option-sheet.component';

describe('OptionSheetComponent', () => {
  let component: OptionSheetComponent;
  let fixture: ComponentFixture<OptionSheetComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ OptionSheetComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(OptionSheetComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
