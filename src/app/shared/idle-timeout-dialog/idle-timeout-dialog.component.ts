import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'app-idle-timeout-dialog',
  template: `
    <h3 mat-dialog-title>Session Expiring</h3>
    <div mat-dialog-content>
      <p>Your session is about to expire due to inactivity.</p>
      <p>Do you want to continue? Logging out in {{ countdown }}s...</p>
    </div>
    <div mat-dialog-actions>
      <button mat-button color="primary" (click)="resume()">Resume</button>
      <button mat-button color="warn" (click)="cancel()">Logout</button>
    </div>
  `
})
export class IdleTimeoutDialogComponent {
  countdown = 10;
  interval: any;

  constructor(
    public dialogRef: MatDialogRef<IdleTimeoutDialogComponent>
  ) {
    this.startCountdown();
  }

  startCountdown() {
    this.interval = setInterval(() => {
      this.countdown--;
      if (this.countdown === 0) {
        this.dialogRef.close('timeout');
      }
    }, 1000);
  }

  resume() {
    clearInterval(this.interval);
    this.dialogRef.close('resume');
  }

  cancel() {
    clearInterval(this.interval);
    this.dialogRef.close('logout');
  }
}
