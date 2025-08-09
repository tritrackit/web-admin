import { TestBed } from '@angular/core/testing';

import { EmployeeUsersService } from './employee-users.service';

describe('EmployeeUsersService', () => {
  let service: EmployeeUsersService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(EmployeeUsersService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
