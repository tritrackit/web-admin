import { Component, ViewChild } from '@angular/core';
// Depending on whether rollup is used, moment needs to be imported differently.
// Since Moment.js doesn't have a default export, we normally need to import using the `* as`
// syntax. However, rollup creates a synthetic default module and we thus need to import it using
// the `default as` syntax.
import * as _moment from 'moment';
// tslint:disable-next-line:no-duplicate-imports
import { MatSnackBar } from '@angular/material/snack-bar';
import { Observable, Subject, catchError, forkJoin, of, takeUntil } from 'rxjs';
import { DashboardService } from 'src/app/services/dashboard.service';
import { StorageService } from 'src/app/services/storage.service';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { FormControl } from '@angular/forms';


@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
  host: {
    class: 'page-component',
  },
})
export class DashboardComponent {
  isLoading = false;
  isLoadingMap = false;
  showMap = true;
  totalUsers = 0;
  totalMaintenance = 0;
  totalRooms = 0;
  totalUserAccess = 0;
  error;
  geolocationPosition;
  protected ngUnsubscribe: Subject<void> = new Subject<void>();

  eventStatusCtrl = new FormControl("ALL");

  constructor(
    private snackBar: MatSnackBar,
    private storageService: StorageService,
    private dialog: MatDialog,
    private router: Router
  ) {
  }

  async ngAfterViewInit(): Promise<void> {
    //Called after ngAfterContentInit when the component's view has been initialized. Applies to components only.
    //Add 'implements AfterViewInit' to the class.
    this.initDashboardUsers();
  }

  initDashboardUsers() {
  }

  handleError<T>(operation = 'operation', result?: any) {
    this.ngUnsubscribe.next();
    this.ngUnsubscribe.complete();
    return (error: any): Observable<any> => {
      return of(error.error as any);
    };
  }
}
