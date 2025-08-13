import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CBUDetailsComponent } from './cbu-details.component';

describe('CBUDetailsComponent', () => {
  let component: CBUDetailsComponent;
  let fixture: ComponentFixture<CBUDetailsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CBUDetailsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CBUDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
