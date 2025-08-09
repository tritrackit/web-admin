import { Component } from '@angular/core';
import { FormGroup, FormBuilder, AbstractControl, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router } from '@angular/router';
import { EmployeeUsers } from 'src/app/model/employee-users.model';
import { AppConfigService } from 'src/app/services/app-config.service';
import { AuthService } from 'src/app/services/auth.service';
import { LoaderService } from 'src/app/services/loader.service';
import { StorageService } from 'src/app/services/storage.service';
import { EmployeeUsersService } from 'src/app/services/employee-users.service';
import { AlertDialogModel } from 'src/app/shared/components/alert-dialog/alert-dialog-model';
import { AlertDialogComponent } from 'src/app/shared/components/alert-dialog/alert-dialog.component';
import { MyErrorStateMatcher } from 'src/app/shared/form-validation/error-state.matcher';

@Component({
  selector: 'app-change-password',
  templateUrl: './change-password.component.html',
  styleUrls: ['./change-password.component.scss'],
  host: {
    class: "page-component"
  }
})
export class ChangePasswordComponent {
  currentUserCode;
  isProcessing = false;
  error;
  changePasswordForm: FormGroup;
  matcher = new MyErrorStateMatcher();
  user: EmployeeUsers;
  constructor(
    private employeeUsersService: EmployeeUsersService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private appconfig: AppConfigService,
    private loaderService: LoaderService,
    private storageService: StorageService,
    private route: ActivatedRoute,
    public router: Router,
    private formBuilder: FormBuilder,
    private authService: AuthService
  ) {
    this.user = this.storageService.getLoginProfile();
    if(!this.user || !this.user.employeeUserCode || !this.user.employeeUserId) {
      this.router.navigate(['/auth/']);
    }
    this.currentUserCode = this.user.employeeUserCode;
  }
  ngOnInit(): void {
    //Called after the constructor, initializing input properties, and the first call to ngOnChanges.
    //Add 'implements OnInit' to the class.

    this.changePasswordForm = this.formBuilder.group(
      {
        currentPassword: ['', [Validators.required]],
        password: [
          '',
          [
            Validators.minLength(6),
            Validators.maxLength(16),
            Validators.required,
          ],
        ],
        confirmPassword: '',
      },
      { validators: this.checkPasswords }
    );
  }

  checkPasswords: ValidatorFn = (
    group: AbstractControl
  ): ValidationErrors | null => {
    const pass = group.get('password').value;
    const confirmPass = group.get('confirmPassword').value;
    return pass === confirmPass ? null : { notMatched: true };
  };

  get f() {
    return this.changePasswordForm.controls;
  }
  get formIsValid() {
    return this.changePasswordForm.valid;
  }
  get formIsReady() {
    return this.changePasswordForm.valid && this.changePasswordForm.dirty;
  }
  get formData() {
    return this.changePasswordForm.value;
  }

  getError(key: string) {
    if (key === 'confirmPassword') {
      this.formData.confirmPassword !== this.formData.password
        ? this.f[key].setErrors({ notMatched: true })
        : this.f[key].setErrors(null);
    }
    return this.f[key].errors;
  }

  onSubmitChangePassword() {
    if (this.changePasswordForm.invalid || this.changePasswordForm.invalid) {
      return;
    }

    const dialogData = new AlertDialogModel();
    dialogData.title = 'Confirm';
    dialogData.message = 'Update your password?';
    dialogData.confirmButton = {
      visible: true,
      text: 'Yes, Update now',
      color: 'primary',
    };
    dialogData.dismissButton = {
      visible: true,
      text: 'cancel',
    };
    const dialogRef = this.dialog.open(AlertDialogComponent, {
      maxWidth: '400px',
      closeOnNavigation: true,
    });
    dialogRef.componentInstance.alertDialogConfig = dialogData;

    dialogRef.componentInstance.conFirm.subscribe(async (data: any) => {
      this.isProcessing = true;
      dialogRef.componentInstance.isProcessing = this.isProcessing;
      try {
        const params = this.formData;
        this.isProcessing = true;
        this.loaderService.show();
        let res = await this.authService.login({
          userName: this.user.userName,
          password: params.currentPassword,
        }).toPromise();
        if(!res.success) {
          this.isProcessing = false;
          this.f["currentPassword"].setErrors( { invalid: true });
          this.f["currentPassword"].markAllAsTouched();
          dialogRef.close();
          dialogRef.componentInstance.isProcessing = this.isProcessing;
          this.loaderService.hide();
          return;
        }
        this.f["currentPassword"].setErrors(null);
        res = await this.employeeUsersService.profileResetPassword(this.currentUserCode, params).toPromise();

        if (res.success) {
          this.loaderService.hide();
          this.snackBar.open('Password updated!', 'close', {
            panelClass: ['style-success'],
          });
          this.isProcessing = false;
          dialogRef.componentInstance.isProcessing = this.isProcessing;
          dialogRef.close();
          this.changePasswordForm.markAsPristine();
          this.changePasswordForm.markAsUntouched();
        } else {
          this.loaderService.hide();
          this.isProcessing = false;
          dialogRef.componentInstance.isProcessing = this.isProcessing;
          this.error = Array.isArray(res.message)
            ? res.message[0]
            : res.message;
          this.snackBar.open(this.error, 'close', {
            panelClass: ['style-error'],
          });
          dialogRef.close();
        }
      } catch (e) {
        this.loaderService.hide();
        this.isProcessing = false;
        dialogRef.componentInstance.isProcessing = this.isProcessing;
        this.error = Array.isArray(e.message) ? e.message[0] : e.message;
        this.snackBar.open(this.error, 'close', {
          panelClass: ['style-error'],
        });
        dialogRef.close();
      }
    });
  }
}
