import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, startWith, map, switchMap, catchError, of as observableOf, pipe } from 'rxjs';
import { AppConfigService } from 'src/app/services/app-config.service';
import { StorageService } from 'src/app/services/storage.service';
import { ENTER, COMMA } from '@angular/cdk/keycodes';
import { MatSnackBar } from '@angular/material/snack-bar';
import { convertNotationToObject } from 'src/app/shared/utility/utility';
import { EmployeeUsersTableColumn } from 'src/app/shared/utility/table';
import { EmployeeUsersService } from 'src/app/services/employee-users.service';

@Component({
  selector: 'app-employee-users',
  templateUrl: './employee-users.component.html',
  styleUrls: ['./employee-users.component.scss'],
  host: {
    class: "page-component"
  }
})
export class EmployeeUsersComponent implements OnInit {
  currentStaffUserCode: string;
  error: string;
  dataSource = new MatTableDataSource<EmployeeUsersTableColumn>();
  displayedColumns = [];
  isLoading = false;
  isProcessing = false;
  pageIndex = 0;
  pageSize = 10;
  total = 0;
  order: any = { employeeUserId: "DESC" };
  searchTerm: string = ''; 


  filter: {
    apiNotation: string;
    filter: string;
    name: string;
    type: string;
  }[] = [];

  // pageAccess: Access = {
  //   view: true,
  //   modify: false,
  // };
  constructor(
    private employeeUsersService: EmployeeUsersService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    public appConfig: AppConfigService,
    private storageService: StorageService,
    private route: ActivatedRoute,
    public router: Router) {
    this.dataSource = new MatTableDataSource([]);
    if (this.route.snapshot.data) {
      // this.pageAccess = {
      //   ...this.pageAccess,
      //   ...this.route.snapshot.data["access"]
      // };
    }
  }

  ngOnInit(): void {
    const profile = this.storageService.getLoginProfile();
    this.currentStaffUserCode = profile && profile["staffUserCode"];
    this.getUsersPaginated();
  }

  ngAfterViewInit() {
  }

  filterChange(event: {
    apiNotation: string;
    filter: string;
    name: string;
    type: string;
  }[]) {
    this.filter = event;
    this.getUsersPaginated();
  }

   // Add search method
   onSearch(): void {
    this.pageIndex = 0; // Reset to first page when searching
    this.getUsersPaginated();
  }

  // Add clear search method
  clearSearch(): void {
    this.searchTerm = '';
    this.pageIndex = 0;
    this.getUsersPaginated();
  }

  async pageChange(event: { pageIndex: number, pageSize: number }) {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    await this.getUsersPaginated();
  }

  async sortChange(event: { active: string, direction: string }) {
    const { active, direction } = event;
    const { apiNotation } = this.appConfig.config.tableColumns.employeeUsers.find(x => x.name === active);
    this.order = convertNotationToObject(apiNotation, direction.toUpperCase());
    this.getUsersPaginated()
  }

  getUsersPaginated() {
    try {
      this.isLoading = true;

         const searchFilter = this.searchTerm ? [
      {
        apiNotation: "firstName",
        filter: this.searchTerm.trim(),
        name: "firstName",
        type: "text"
      },
    ] : [];


      this.employeeUsersService.getAdvanceSearch({
        order: this.order,
        columnDef: [
          ...this.filter,
          ...searchFilter,
          {
            apiNotation: "accessGranted",
            filter: "yes",
            name: "accessGranted",
            type: "option-yes-no",
          }
        ],
        pageIndex: this.pageIndex, pageSize: this.pageSize
      })
        .subscribe(async res => {
          this.isLoading = false;
          if (res.success) {
            let data = res.data.results.map((d) => {
              return {
                employeeUserCode: d.employeeUserCode,
                userName: d.userName,
                name: d.firstName + ' ' + d.lastName,
                firstName: d.firstName,
                lastName: d.lastName,
                email: d.email,
                enable: d.accessGranted,
                role: d.role?.name,
                contactNo: d.contactNo, // New field
                dateCreated: d.dateCreated, // New field
                url: `/employee-users/${d.employeeUserCode}`,
              } as EmployeeUsersTableColumn
            });
            this.total = res.data.total;
            this.dataSource = new MatTableDataSource(data);
          }
          else {
            this.error = Array.isArray(res.message) ? res.message[0] : res.message;
            this.snackBar.open(this.error, 'close', { panelClass: ['style-error'] });
            this.isLoading = false;
          }
        }, async (err) => {
          this.error = Array.isArray(err.message) ? err.message[0] : err.message;
          this.snackBar.open(this.error, 'close', { panelClass: ['style-error'] });
          this.isLoading = false;
        });
    }
    catch (e) {
      this.error = Array.isArray(e.message) ? e.message[0] : e.message;
      this.snackBar.open(this.error, 'close', { panelClass: ['style-error'] });
    }

  }
}
