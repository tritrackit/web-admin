import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RegisterCbuComponent } from './register-cbu.component';

describe('RegisterCbuComponent', () => {
  let component: RegisterCbuComponent;
  let fixture: ComponentFixture<RegisterCbuComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ RegisterCbuComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RegisterCbuComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

