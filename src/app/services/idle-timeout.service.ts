import { Injectable, NgZone } from "@angular/core";
import { MatDialog } from "@angular/material/dialog";
import { Router } from "@angular/router";
import { fromEvent, merge, Subscription, timer } from "rxjs";
import { environment } from "src/environments/environment";
import { IdleTimeoutDialogComponent } from "../shared/idle-timeout-dialog/idle-timeout-dialog.component";
import { AuthService } from "./auth.service";
import { StorageService } from "./storage.service";
@Injectable({ providedIn: 'root' })
export class IdleTimeoutService {
  private timeoutInMs = environment.idleTimeoutMinutes * 60 * 1000;
  private idleCountdownSub: Subscription | null = null;
  private activityEventsSub: Subscription | null = null;
  private loggingInterval: any;
  private secondsRemaining: number;

  constructor(
    private ngZone: NgZone,
    private dialog: MatDialog,
    private router: Router,
    private authService: AuthService,
    private storageService: StorageService
  ) {}

  startWatching(): void {
    this.ngZone.runOutsideAngular(() => {
      const activityEvents$ = merge(
        fromEvent(window, 'mousemove'),
        fromEvent(window, 'keydown'),
        fromEvent(window, 'mousedown'),
        fromEvent(window, 'touchstart'),
        fromEvent(window, 'scroll')
      );

      if (!this.activityEventsSub) {
        this.activityEventsSub = activityEvents$.subscribe(() => {
          this.resetIdleTimer(); // ✅ Don't remove this!
        });
      }

      this.resetIdleTimer(); // Start first idle countdown
    });
  }

  stopWatching(): void {
    this.idleCountdownSub?.unsubscribe();
    this.activityEventsSub?.unsubscribe();
    clearInterval(this.loggingInterval);
    this.idleCountdownSub = null;
    this.activityEventsSub = null;
  }

  private resetIdleTimer(): void {
    this.idleCountdownSub?.unsubscribe();
    clearInterval(this.loggingInterval);

    // Start logging countdown
    this.secondsRemaining = this.timeoutInMs / 1000;
    this.loggingInterval = setInterval(() => {
      this.secondsRemaining--;
      if (this.secondsRemaining <= 0) {
        clearInterval(this.loggingInterval);
      }
    }, 1000);

    this.idleCountdownSub = timer(this.timeoutInMs).subscribe(() => {
      this.ngZone.run(() => this.showIdleDialog());
    });
  }

  private showIdleDialog(): void {
    clearInterval(this.loggingInterval);

    const dialogRef = this.dialog.open(IdleTimeoutDialogComponent, {
      disableClose: true
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result === 'resume') {
        this.resetIdleTimer(); // Resume idle tracking
      } else {
        this.logout(); // Force logout
      }
    });
  }

  private logout(): void {
    this.stopWatching();
    this.storageService.saveLoginProfile(null);
    this.authService.redirectToPage(true);
  }
}
