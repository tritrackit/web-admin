import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NotificationWindowComponent } from './notification-window.component';

describe('NotificationWindowComponent', () => {
  let component: NotificationWindowComponent;
  let fixture: ComponentFixture<NotificationWindowComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ NotificationWindowComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NotificationWindowComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
