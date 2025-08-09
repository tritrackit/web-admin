import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AccessPagesTableComponent } from './access-pages-table.component';

describe('AccessPagesTableComponent', () => {
  let component: AccessPagesTableComponent;
  let fixture: ComponentFixture<AccessPagesTableComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ AccessPagesTableComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AccessPagesTableComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
