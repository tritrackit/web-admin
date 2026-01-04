import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject, takeUntil } from 'rxjs';
import { UnitService } from 'src/app/services/unit.service';
import { Units } from 'src/app/model/units.model';
import { UnitLogs } from 'src/app/model/unit-logs.model';
import moment from 'moment';

interface ActivityLogRow {
  location: string;
  status: string;
  date: string;
}

@Component({
  selector: 'app-unit-details',
  templateUrl: './unit-details.component.html',
  styleUrls: ['./unit-details.component.scss'],
  host: {
    class: "page-component"
  }
})
export class UnitDetailsComponent implements OnInit, OnDestroy {
  unitCode: string;
  unit: Units | null = null;
  activityLogs: ActivityLogRow[] = [];
  
  // Pagination for activity history
  activityPageIndex = 0;
  activityPageSize = 10;
  activityTotal = 0;
  
  loading = false;
  loadingActivity = false;
  error: string = '';

  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private unitService: UnitService,
    private snackBar: MatSnackBar
  ) {
    this.unitCode = this.route.snapshot.paramMap.get('unitCode') || '';
  }

  ngOnInit(): void {
    if (!this.unitCode) {
      this.error = 'Unit code is required';
      return;
    }
    this.loadUnitDetails();
    this.loadActivityHistory();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadUnitDetails(): void {
    this.loading = true;
    this.error = '';

    this.unitService.getByCode(this.unitCode)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.loading = false;
          if (response.success && response.data) {
            this.unit = response.data;
          } else {
            this.error = response.message || 'Failed to load unit details';
            this.snackBar.open(this.error, 'Close', { duration: 3000 });
          }
        },
        error: (error) => {
          this.loading = false;
          this.error = 'Error loading unit details';
          this.snackBar.open('Error loading unit details', 'Close', { duration: 3000 });
        }
      });
  }

  loadActivityHistory(): void {
    this.loadingActivity = true;

    this.unitService.getActivityHistory(this.unitCode, this.activityPageIndex, this.activityPageSize)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.loadingActivity = false;
          if (response.success && response.data) {
            this.activityLogs = response.data.results.map((log: UnitLogs) => ({
              location: log.location?.name || 'N/A',
              status: log.status?.name || 'N/A',
              date: this.formatDate(log.timestamp)
            }));
            this.activityTotal = response.data.total;
          } else {
            this.snackBar.open(response.message || 'Failed to load activity history', 'Close', { duration: 3000 });
          }
        },
        error: (error) => {
          this.loadingActivity = false;
          this.snackBar.open('Error loading activity history', 'Close', { duration: 3000 });
        }
      });
  }

  formatDate(date: Date | string): string {
    if (!date) return 'N/A';
    return moment(date).format('MMMM DD, YYYY hh:mm A');
  }

  goBack(): void {
    this.router.navigate(['/unit-tracker']);
  }

  getRfidDisplay(): string {
    if (!this.unit?.rfid) return 'N/A';
    // Format RFID: 3034 5A7B C8D9 E012
    const rfid = this.unit.rfid.replace(/\s/g, '');
    return rfid.match(/.{1,4}/g)?.join(' ') || this.unit.rfid;
  }

  // Pagination methods for activity history
  getActivityStartRecord(): number {
    return this.activityPageIndex * this.activityPageSize + 1;
  }

  getActivityEndRecord(): number {
    return Math.min((this.activityPageIndex + 1) * this.activityPageSize, this.activityTotal);
  }

  hasPreviousActivityPage(): boolean {
    return this.activityPageIndex > 0;
  }

  hasNextActivityPage(): boolean {
    return this.getActivityEndRecord() < this.activityTotal;
  }

  goToPreviousActivityPage(): void {
    if (this.hasPreviousActivityPage()) {
      this.activityPageIndex--;
      this.loadActivityHistory();
    }
  }

  goToNextActivityPage(): void {
    if (this.hasNextActivityPage()) {
      this.activityPageIndex++;
      this.loadActivityHistory();
    }
  }
}
