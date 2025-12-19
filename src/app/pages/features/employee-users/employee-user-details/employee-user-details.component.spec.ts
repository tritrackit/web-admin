import { EmployeeUserDetailsComponent } from "./employee-user-details.component";
import { ComponentFixture, TestBed } from '@angular/core/testing';


describe('UserDetailsComponent', () => {
  let component: EmployeeUserDetailsComponent;
  let fixture: ComponentFixture<EmployeeUserDetailsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ EmployeeUserDetailsComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EmployeeUserDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
