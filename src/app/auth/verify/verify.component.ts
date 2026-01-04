import { AuthService } from './../../services/auth.service';
import { Component } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-verify',
  templateUrl: './verify.component.html',
  styleUrl: './verify.component.scss'
})
export class VerifyComponent {
  email!: string;
  code!: string;
  showLoader = true;
  error: string;
  constructor(
    private route: ActivatedRoute,
    private authService: AuthService,
    private snackBar: MatSnackBar,
  ) {

    this.route.queryParamMap.subscribe(params => {
      this.email = params.get('email') || '';
      this.code = params.get('code') || '';


      // TODO: Call your API to verify using email & code
    });
  }
  ngOnInit(): void {
    if (!this.email || !this.code) {
      this.showLoader = false;
      window.location.href = '/auth/login'
    }
    this.authService.verify({
      email: this.email,
      hashCode: this.code,
    }).subscribe(res => {
      this.showLoader = false;
      if (res.success) {
        window.location.href = '/auth/login'
      } else {
        this.error = res.message;
        this.snackBar.open(this.error, 'close', { panelClass: ['style-error'] });
      }
    }, (res) => {
      this.showLoader = false;
      this.error = res.error.message;
      this.snackBar.open(this.error, 'close', { panelClass: ['style-error'] });
    });
  }
}
