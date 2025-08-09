
import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormControl,
  FormGroup,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableDataSource } from '@angular/material/table';
import { ActivatedRoute, Router } from '@angular/router';
import moment from 'moment';
import { Observable, Subscription, debounceTime, distinctUntilChanged, forkJoin, of, map } from 'rxjs';
import { AppConfigService } from 'src/app/services/app-config.service';
import { AuthService } from 'src/app/services/auth.service';
import { StorageService } from 'src/app/services/storage.service';
import { MyErrorStateMatcher } from 'src/app/shared/form-validation/error-state.matcher';
import { AccessPagesTableComponent } from 'src/app/shared/components/access-pages-table/access-pages-table.component';
import { AlertDialogModel } from 'src/app/shared/components/alert-dialog/alert-dialog-model';
import { AlertDialogComponent } from 'src/app/shared/components/alert-dialog/alert-dialog.component';
import { ImageViewerDialogComponent } from 'src/app/shared/components/image-viewer-dialog/image-viewer-dialog.component';
import { ChangePasswordComponent } from './change-password/change-password.component';
import { RoleService } from 'src/app/services/roles.service';
import { EmployeeUsers } from 'src/app/model/employee-users.model';
import { EmployeeUsersService } from 'src/app/services/employee-users.service';

@Component({
  selector: 'app-employee-user-details',
  templateUrl: './employee-user-details.component.html',
  styleUrls: ['./employee-user-details.component.scss'],
  host: {
    class: 'page-component',
  },
})
export class EmployeeUserDetailsComponent implements OnInit {
  currentUserCode;
  employeeUserCode;
  isNew = false;
  isReadOnly = true;

  error;
  isLoading = true;

  employeeUserForm: FormGroup;
  mediaWatcher: Subscription;
  matcher = new MyErrorStateMatcher();
  isProcessing = false;
  isLoadingRoles = false;
  maxDate = moment(new Date().getFullYear() - 18).format('YYYY-MM-DD');

  roleSearchCtrl = new FormControl()
  isOptionsRoleLoading = false;
  optionsRole: { name: string; code: string}[] = [];
  @ViewChild('accessPagesTable', { static: true}) accessPagesTable: AccessPagesTableComponent;
  @ViewChild('roleSearchInput', { static: true}) roleSearchInput: ElementRef<HTMLInputElement>;

  employeeUser: EmployeeUsers;
  userProfilePicSource: any;
  userProfilePic;
  userProfilePicLoaded = false;

  constructor(
    private employeeUsersService: EmployeeUsersService,
    private roleService: RoleService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private appconfig: AppConfigService,
    private storageService: StorageService,
    private route: ActivatedRoute,
    public router: Router,
    private formBuilder: FormBuilder,
    private authService: AuthService
  ) {
    const { isNew, edit } = this.route.snapshot.data;
    this.isNew = isNew ? isNew : false;
    this.employeeUserCode = this.route.snapshot.paramMap.get('employeeUserCode');
    const profile = this.storageService.getLoginProfile();
    this.currentUserCode = profile["employeeUserCode"];
    this.isReadOnly = !edit && !isNew;
    if(!isNew && edit && edit !== undefined && this.currentUserCode ===this.employeeUserCode) {
      this.router.navigate(['/staff-user/' + this.employeeUserCode]);
    }
    if (this.route.snapshot.data) {
      // this.pageAccess = {
      //   ...this.pageAccess,
      //   ...this.route.snapshot.data['access'],
      // };
    }
  }

  get pageRights() {
    let rights = {};
    // for(var right of this.pageAccess.rights) {
    //   rights[right] = this.pageAccess.modify;
    // }
    return rights;
  }

  get f() {
    return this.employeeUserForm.controls;
  }
  get formIsValid() {
    return this.employeeUserForm.valid && this.roleSearchCtrl.valid;
  }
  get formIsReady() {
    return (this.employeeUserForm.valid && this.roleSearchCtrl.valid) && (this.employeeUserForm.dirty || this.roleSearchCtrl.dirty);
  }
  get formData() {
    return this.employeeUserForm.value;
  }

  ngOnInit(): void {
    this.isLoading = true;
    this.initDetails();
  }

  async initDetails() {
    try {
      if (this.isNew) {
        this.employeeUserForm = this.formBuilder.group(
          {
            firstName: new FormControl('', [Validators.required, Validators.pattern('^[a-zA-Z0-9\\-\\s]+$')]),
            lastName: new FormControl('', [Validators.required, Validators.pattern('^[a-zA-Z0-9\\-\\s]+$')]),
            email: new FormControl('', [Validators.required]),
            contactNo: new FormControl('', [Validators.required]),
            userName: new FormControl(
              '',
              [
                Validators.required,
              ]),
            password: new FormControl(
              '',
              [
                Validators.minLength(6),
                Validators.maxLength(16),
                Validators.required,
              ]),
            confirmPassword: new FormControl(),
            roleCode: new FormControl(),
          },
          { validators: this.checkPasswords }
        );
        this.isLoading = false;
      } else {
        this.employeeUserForm = this.formBuilder.group({
          firstName: new FormControl('', [Validators.required, Validators.pattern('^[a-zA-Z0-9\\-\\s]+$')]),
          lastName: new FormControl('', [Validators.required, Validators.pattern('^[a-zA-Z0-9\\-\\s]+$')]),
          email: new FormControl('', [Validators.required]),
          contactNo: new FormControl('', [Validators.required]),
          userName: new FormControl(
            '',
            [
              Validators.required,
            ]),
            roleCode: new FormControl(),
        });


        forkJoin([
          this.employeeUsersService.getByCode(this.employeeUserCode).toPromise(),
          this.roleService.getByAdvanceSearch({
          order: {},
          columnDef: [],
          pageIndex: 0,
          pageSize: 10
        })
        ]).subscribe(([user, accessOptions])=> {
          if(accessOptions.success) {
            this.optionsRole = accessOptions.data.results.map(x=> {
              return { name: x.name, code: x.roleCode }
            });
          }
          if (user.success) {
            this.employeeUser = user.data;
            this.employeeUserForm.patchValue({
              firstName: user.data.firstName,
              lastName: user.data.lastName,
              userName: user.data.userName,
              email: user.data.email,
              contactNo: user.data.contactNo,
              accessCode: user.data.role?.roleCode,
            });
            this.employeeUserForm.updateValueAndValidity();
            if(user.data.role?.accessPages) {
              this.accessPagesTable.setDataSource(user.data.role?.accessPages);
            }
            if (this.isReadOnly) {
              this.employeeUserForm.disable();
              this.roleSearchCtrl.disable();
            }
            this.roleSearchCtrl.setValue(user.data.role?.roleCode);
            this.isLoading = false;
          } else {
            this.isLoading = false;
            this.error = Array.isArray(user.message) ? user.message[0] : user.message;
            this.snackBar.open(this.error, 'close', {
              panelClass: ['style-error'],
            });
          }
        });
      }
      this.f['roleCode'].valueChanges.subscribe(async res=> {
        // this.spinner.show();
        const staffAccess = await this.roleService.getByCode(res).toPromise();
        if(staffAccess.data && staffAccess.data.accessPages) {
          this.accessPagesTable.setDataSource(staffAccess.data.accessPages)
        }
        // this.spinner.hide();
      })
      this.roleSearchCtrl.valueChanges
      .pipe(
          debounceTime(2000),
          distinctUntilChanged()
      )
      .subscribe(async value => {
          await this.initRoleOptions();
      });
      await this.initRoleOptions();
    } catch(ex) {
      this.isLoading = false;
      this.error = Array.isArray(ex.message) ? ex.message[0] : ex.message;
      this.snackBar.open(this.error, 'close', {
        panelClass: ['style-error'],
      });
    }
  }

  onShowImageViewer() {
    const dialogRef = this.dialog.open(ImageViewerDialogComponent, {
        disableClose: true,
        panelClass: "image-viewer-dialog"
    });
    const img: HTMLImageElement = document.querySelector(".profile-pic img");
    dialogRef.componentInstance.imageSource = img?.src;
    dialogRef.componentInstance.canChange = false;

    dialogRef.componentInstance.changed.subscribe(res=> {
      this.userProfilePicLoaded = false;
      this.userProfilePicSource = res.base64;
      dialogRef.close();

      this.userProfilePic = {
        fileName: `${moment().format("YYYY-MM-DD-hh-mm-ss")}.png`,
        data: res.base64.toString().split(',')[1]
      };
    })
  }

  async initRoleOptions() {
    this.isOptionsRoleLoading = true;
    const res = await this.roleService.getByAdvanceSearch({
      order: {},
      columnDef: [{
        apiNotation: "name",
        filter: this.roleSearchInput.nativeElement.value
      }],
      pageIndex: 0,
      pageSize: 10
    }).toPromise();
    this.optionsRole = res.data.results.map(a=> { return { name: a.name, code: a.roleCode }});
    this.mapSearchRole();
    this.isOptionsRoleLoading = false;
  }

  displayRoleName(value?: number) {
    return value ? this.optionsRole.find(_ => _.code === value?.toString())?.name : undefined;
  }

  mapSearchRole() {
    if(this.f['roleCode'].value !== this.roleSearchCtrl.value) {
      this.f['roleCode'].setErrors({ required: true});
      const selected = this.optionsRole.find(x=>x.code === this.roleSearchCtrl.value);
      if(selected) {
        this.f["roleCode"].setValue(selected.code);
      } else {
        this.f["roleCode"].setValue(null);
      }
      if(!this.f["roleCode"].value) {
        this.f["roleCode"].setErrors({required: true});
      } else {
        this.f['roleCode'].setErrors(null);
        this.f['roleCode'].markAsPristine();
      }
    }
    this.roleSearchCtrl.setErrors(this.f["roleCode"].errors);
  }

  getError(key: string) {
    if (key === 'confirmPassword') {
      this.formData.confirmPassword !== this.formData.password
        ? this.f[key].setErrors({ notMatched: true })
        : this.f[key].setErrors(null);
    }
    return this.f[key].errors;
  }

  checkPasswords: ValidatorFn = (
    group: AbstractControl
  ): ValidationErrors | null => {
    const pass = group.get('password').value;
    const confirmPass = group.get('confirmPassword').value;
    return pass === confirmPass ? null : { notMatched: true };
  };

  onSubmit() {
    if (this.employeeUserForm.invalid || this.roleSearchCtrl.invalid) {
      return;
    }

    const dialogData = new AlertDialogModel();
    dialogData.title = 'Confirm';
    dialogData.message = 'Save user?';
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
        let res;
        if(this.isNew) {
          res = await this.employeeUsersService.createUser(params).toPromise();
        } else {
          res = await this.employeeUsersService.updateUser(this.employeeUserCode, params).toPromise();
        }

        if (res.success) {
          this.snackBar.open('Saved!', 'close', {
            panelClass: ['style-success'],
          });
          this.router.navigate(['/employee-users/' + res.data.employeeUserCode]);
          this.isProcessing = false;
          dialogRef.componentInstance.isProcessing = this.isProcessing;
          dialogRef.close();
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
        }
      } catch (e) {
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

  openChangePasswordDialog() {
    const dialogRef = this.dialog.open(ChangePasswordComponent, {
      maxWidth: '720px',
      width: '720px',
      disableClose: true,
    });
    dialogRef.componentInstance.employeeUserCode = this.employeeUserCode;
  }

  onDeleteUser() {
    const dialogData = new AlertDialogModel();
    dialogData.title = 'Delete User';
    dialogData.message = 'Are you sure you want to delete this user?';
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
      try {

        const res = await this.employeeUsersService.delete(this.employeeUserCode).toPromise();
        if (res.success) {
          this.snackBar.open('User deleted!', 'close', {
            panelClass: ['style-success'],
          });
          this.router.navigate(['/staff-user/']);
          this.isProcessing = false;
          dialogRef.componentInstance.isProcessing = this.isProcessing;
          dialogRef.close();
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
        }
      } catch (e) {
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

  profilePicErrorHandler(event) {
    event.target.src = this.getDeafaultProfilePicture();
  }

  getDeafaultProfilePicture() {
    return '../../../../../assets/img/person.png';
  }
}
