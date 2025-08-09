import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DataTableRangeFilterComponent } from './data-table-range-filter.component';

describe('DataTableRangeFilterComponent', () => {
  let component: DataTableRangeFilterComponent;
  let fixture: ComponentFixture<DataTableRangeFilterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ DataTableRangeFilterComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DataTableRangeFilterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
