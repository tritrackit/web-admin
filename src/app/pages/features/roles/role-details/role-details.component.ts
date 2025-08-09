import { Component, ElementRef, TemplateRef, ViewChild } from '@angular/core';
import { FormGroup, FormBuilder, Validators, ValidatorFn, AbstractControl, ValidationErrors } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { Roles, AccessPages } from 'src/app/model/roles.model';
import { AppConfigService } from 'src/app/services/app-config.service';
import { RoleService } from 'src/app/services/roles.service';
import { StorageService } from 'src/app/services/storage.service';
import { AlertDialogModel } from 'src/app/shared/components/alert-dialog/alert-dialog-model';
import { AlertDialogComponent } from 'src/app/shared/components/alert-dialog/alert-dialog.component';
import { MyErrorStateMatcher } from 'src/app/shared/form-validation/error-state.matcher';
import { RoleFormComponent } from '../role-form/role-form.component';
import { MatTableDataSource } from '@angular/material/table';
import { AccessPagesTableComponent } from 'src/app/shared/components/access-pages-table/access-pages-table.component';
import { LoaderService } from 'src/app/services/loader.service';

@Component({
  selector: 'app-role-details',
  templateUrl: './role-details.component.html',
  styleUrls: ['./role-details.component.scss'],
  host: {
    class: "page-component"
  }
})
export class RoleDetailsComponent {
  code;
  isNew = false;
  // pageAccess: Access = {
  //   view: true,
  //   modify: false,
  // };

  isReadOnly = true;

  error;
  isLoading = false;

  mediaWatcher: Subscription;
  matcher = new MyErrorStateMatcher();
  isProcessing = false;
  isLoadingRoles = false;

  @ViewChild('roleForm', { static: true}) roleForm: RoleFormComponent;
  @ViewChild('accessPagesTable', { static: true}) accessPagesTable: AccessPagesTableComponent;


  pageAccess: AccessPages = {
    view: true,
    modify: false,
  } as any;

  constructor(
    private roleService: RoleService,
    private loaderService: LoaderService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private appconfig: AppConfigService,
    private storageService: StorageService,
    private route: ActivatedRoute,
    public router: Router,
    private formBuilder: FormBuilder
  ) {
    const { isNew, edit } = this.route.snapshot.data;
    this.isNew = isNew;
    this.code = this.route.snapshot.paramMap.get('roleCode');
    this.isReadOnly = !edit && !isNew;
    if (this.route.snapshot.data) {
      this.pageAccess = {
        ...this.pageAccess,
        ...this.route.snapshot.data['access'],
      };
    }
  }

  get pageRights() {
    let rights = {};
    // for(var right of this.pageAccess.rights) {
    //   rights[right] = this.pageAccess.modify;
    // }
    return rights;
  }

  ngOnInit(): void {
  }

  ngAfterViewInit() {
    this.initDetails();
  }

  accessGridChange(event) {
    this.roleForm.form.controls["accessPages"].setValue(event);
    this.roleForm.form.markAllAsTouched();
    this.roleForm.form.markAsDirty();
  }

  initDetails() {
    this.loaderService.show();
    this.roleService.getByCode(this.code).subscribe(res=> {
      this.loaderService.hide();
      if (res.success) {
        this.roleForm.setFormValue(res.data);
        if(res.data.accessPages) {
          this.accessPagesTable.setDataSource(res.data.accessPages);
        }

        if (this.isReadOnly) {
          this.roleForm.form.disable();
        }
        if(!this.pageAccess.modify) {
          this.router.navigate(['/roles/' + this.code]);
        }
      } else {
        this.error = Array.isArray(res.message) ? res.message[0] : res.message;
        this.snackBar.open(this.error, 'close', {
          panelClass: ['style-error'],
        });
      }
    });
  }
  compareFn(accessPages1: AccessPages, accessPages2: AccessPages) {
    return accessPages1 && accessPages2 ? accessPages1.page.toUpperCase() === accessPages1.page.toUpperCase() : accessPages1 === accessPages2;
  }

  checkPasswords: ValidatorFn = (
    group: AbstractControl
  ): ValidationErrors | null => {
    const pass = group.get('password').value;
    const confirmPass = group.get('confirmPassword').value;
    return pass === confirmPass ? null : { notMatched: true };
  };

  onDelete() {
    const dialogData = new AlertDialogModel();
    dialogData.title = 'Confirm';
    dialogData.message = 'Delete Access?';
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
        this.loaderService.show();
        let res = await this.roleService.delete(this.code).toPromise();
        this.loaderService.hide();
        if (res.success) {
          this.snackBar.open('Deleted!', 'close', {
            panelClass: ['style-success'],
          });
          this.router.navigate(['/roles/']);
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

  onUpdate(formData) {
    formData = {
      ...formData,
      ...this.accessPagesTable.accessPagesData
    }
    const dialogData = new AlertDialogModel();
    dialogData.title = 'Confirm';
    dialogData.message = 'Update Access?';
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
        this.loaderService.show();
        let res = await this.roleService.update(this.code, formData).toPromise();
        this.loaderService.hide();
        if (res.success) {
          this.snackBar.open('Saved!', 'close', {
            panelClass: ['style-success'],
          });
          this.router.navigate(['/roles/' + res.data.roleCode]);
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
