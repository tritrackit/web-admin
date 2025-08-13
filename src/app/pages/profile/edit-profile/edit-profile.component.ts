import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router } from '@angular/router';
import moment from 'moment';
import { Subscription } from 'rxjs';
import { EmployeeUsers } from 'src/app/model/employee-users.model';
import { AppConfigService } from 'src/app/services/app-config.service';
import { AuthService } from 'src/app/services/auth.service';
import { LoaderService } from 'src/app/services/loader.service';
import { StorageService } from 'src/app/services/storage.service';
import { EmployeeUsersService } from 'src/app/services/employee-users.service';
import { AlertDialogModel } from 'src/app/shared/components/alert-dialog/alert-dialog-model';
import { AlertDialogComponent } from 'src/app/shared/components/alert-dialog/alert-dialog.component';

@Component({
  selector: 'app-edit-profile',
  templateUrl: './edit-profile.component.html',
  styleUrls: ['./edit-profile.component.scss'],
  host: {
    class: "page-component"
  }
})
export class EditProfileComponent {
  currentUserCode;
  isNew = false;

  isReadOnly = true;

  error;
  isLoading = true;

  profileForm: FormGroup;
  mediaWatcher: Subscription;
  isProcessing = false;
  isLoadingRoles = false;
  maxDate = moment(new Date().getFullYear() - 18).format('YYYY-MM-DD');

  user: EmployeeUsers;
  userProfilePicSource: any;
  userProfilePic;
  userProfilePicLoaded = false;
  constructor(
    private employeeUsersService: EmployeeUsersService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private loaderService: LoaderService,
    private appconfig: AppConfigService,
    private storageService: StorageService,
    private route: ActivatedRoute,
    public router: Router,
    private formBuilder: FormBuilder,
    private authService: AuthService,
  ) {
    this.user = this.storageService.getLoginProfile();
    if(!this.user || !this.user.employeeUserCode || !this.user.employeeUserId) {
      this.router.navigate(['/auth/']);
    }
    this.currentUserCode = this.user.employeeUserCode;
  }

  get f() {
    return this.profileForm.controls;
  }
  get formIsValid() {
    return this.profileForm.valid;
  }
  get formIsReady() {
    return this.profileForm.valid && this.profileForm.dirty;
  }
  get formData() {
    return this.profileForm.value
  }

  ngOnInit(): void {
    //Called after the constructor, initializing input properties, and the first call to ngOnChanges.
    //Add 'implements OnInit' to the class.

    this.profileForm = this.formBuilder.group(
      {
        firstName: [
          this.user.firstName,
          [Validators.required, Validators.pattern('^[a-zA-Z0-9\\-\\s]+$')],
        ],
        lastName: [
          this.user.lastName,
          [Validators.required, Validators.pattern('^[a-zA-Z0-9\\-\\s]+$')],
        ],
        email: [
          this.user.email,
          [
            Validators.email,
            Validators.required,
          ],
        ],
        contactNo: [
          this.user.contactNo,
          [Validators.required],
        ],
      }
    );
    this.profileForm.markAllAsTouched();
  }

  getError(key: string) {
    return this.f[key].errors;
  }


  onSubmitUpdateProfile() {
    if (!this.profileForm.valid) {
      return;
    }

    const dialogData = new AlertDialogModel();
    dialogData.title = 'Confirm';
    dialogData.message = 'Update profile?';
    dialogData.confirmButton = {
      visible: true,
      text: 'yes',
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
        this.isProcessing = true;
        const params = this.formData;
        this.loaderService.show();
        const res = await this.employeeUsersService.updateProfile(params).toPromise();
        this.loaderService.hide();
        if (res.success) {
          this.snackBar.open('Saved!', 'close', {
            panelClass: ['style-success'],
          });
          this.isProcessing = false;
          dialogRef.componentInstance.isProcessing = this.isProcessing;
          dialogRef.close();
          this.profileForm.markAsPristine();
          this.user.firstName = this.formData.firstName;
          this.user.lastName = this.formData.lastName;
          this.user.email = this.formData.email;
          this.storageService.saveLoginProfile(this.user);
          this.loaderService.hide();
          window.location.reload();
        } else {
          this.isProcessing = false;
          dialogRef.componentInstance.isProcessing = this.isProcessing;
          this.error = Array.isArray(res.message)
            ? res.message[0]
            : res.message;
          this.snackBar.open(this.error, 'close', {
            panelClass: ['style-error'],
          });
          dialogRef.close();
          this.loaderService.hide();
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
