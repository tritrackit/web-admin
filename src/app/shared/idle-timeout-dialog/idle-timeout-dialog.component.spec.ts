import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IdleTimeoutDialogComponent } from './idle-timeout-dialog.component';

describe('IdleTimeoutDialogComponent', () => {
  let component: IdleTimeoutDialogComponent;
  let fixture: ComponentFixture<IdleTimeoutDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IdleTimeoutDialogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(IdleTimeoutDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
