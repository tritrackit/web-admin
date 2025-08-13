import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CbuComponent } from './cbu.component';

describe('CbuComponent', () => {
  let component: CbuComponent;
  let fixture: ComponentFixture<CbuComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CbuComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CbuComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
