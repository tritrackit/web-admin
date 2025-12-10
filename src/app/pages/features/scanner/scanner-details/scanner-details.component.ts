import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { FormGroup, FormControl, Validators, FormBuilder } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router } from '@angular/router';
import moment from 'moment';
import { Subscription, debounceTime, distinctUntilChanged, forkJoin } from 'rxjs';
import { ApiResponse } from 'src/app/model/api-response.model';
import { Scanner } from 'src/app/model/scanner.model';
import { AppConfigService } from 'src/app/services/app-config.service';
import { AuthService } from 'src/app/services/auth.service';
import { EmployeeUsersService } from 'src/app/services/employee-users.service';
import { LocationsService } from 'src/app/services/locations.service';
import { ScannerService } from 'src/app/services/scanner.service';
import { StorageService } from 'src/app/services/storage.service';
import { AlertDialogModel } from 'src/app/shared/components/alert-dialog/alert-dialog-model';
import { AlertDialogComponent } from 'src/app/shared/components/alert-dialog/alert-dialog.component';
import { MyErrorStateMatcher } from 'src/app/shared/form-validation/error-state.matcher';

@Component({
  selector: 'app-scanner-details',
  templateUrl: './scanner-details.component.html',
  styleUrl: './scanner-details.component.scss',
  host: {
    class: "page-component"
  }
})
export class ScannerDetailsComponent implements OnInit {
  scannerCode;
  isNew = false;
  isReadOnly = true;
  error;
  isLoading = true;

  scannerTypeOptions = [
    { value: 'LOCATION', label: 'Location Scanner' },
    { value: 'REGISTRATION', label: 'Registration Scanner' }
  ];
  scannerForm: FormGroup = new FormGroup({
    scannerCode: new FormControl('', [Validators.required, Validators.minLength(3), Validators.maxLength(20), Validators.pattern(/^(?=.{1,20}$)([A-Z][A-Za-z0-9_-]*|[0-9][A-Za-z0-9_-]*)$/)]),
    name: new FormControl('', [Validators.required]),
    scannerType: new FormControl('LOCATION', [Validators.required]),
    locationId: new FormControl('', [Validators.required]),
    assignedEmployeeUserId: new FormControl('', [Validators.required]),
    statusId: new FormControl('', [Validators.required]),
  }
  );
  mediaWatcher: Subscription;
  matcher = new MyErrorStateMatcher();
  isProcessing = false;
  isLoadingRoles = false;
  maxDate = moment(new Date().getFullYear() - 18).format('YYYY-MM-DD');

  locationSearchCtrl = new FormControl()
  assignedEmployeeUserSearchCtrl = new FormControl()
  isOptionsLocationLoading = false;
  isOptionsAssignedEmployeeUserLoading = false;
  optionsLocation: { name: string; code: string }[] = [];
  optionsAssignedEmployeeUser: { name: string; code: string }[] = [];
  @ViewChild('locationSearchInput', { static: true }) locationSearchInput: ElementRef<HTMLInputElement>;
  @ViewChild('assignedEmployeeUserSearchInput', { static: true }) assignedEmployeeUserSearchInput: ElementRef<HTMLInputElement>;

  scanner: Scanner;

  constructor(
    private scannerService: ScannerService,
    private employeeUsersService: EmployeeUsersService,
    private locationsService: LocationsService,
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
    this.scannerCode = this.route.snapshot.paramMap.get('scannerCode');
    this.isReadOnly = !edit && !isNew;
  }

  get pageRights() {
    let rights = {};
    // for(var right of this.pageAccess.rights) {
    //   rights[right] = this.pageAccess.modify;
    // }
    return rights;
  }

  get f() {
    return this.scannerForm.controls;
  }
  get formIsValid() {
    return this.scannerForm.valid && this.locationSearchCtrl.valid && this.assignedEmployeeUserSearchCtrl.valid;
  }
  get formIsReady() {
    return this.scannerForm.valid && this.locationSearchCtrl.valid && this.assignedEmployeeUserSearchCtrl.valid && (this.scannerForm.dirty || this.locationSearchCtrl.dirty || this.assignedEmployeeUserSearchCtrl.dirty);
  }
  get formData() {
    const data = this.scannerForm.value;
    data.price = data?.price?.toString();
    return data;
  }

  async ngOnInit(): Promise<void> {
    this.isLoading = true;
    if (!this.isNew) {
      await this.initDetails();
    }
    this.locationSearchCtrl.valueChanges
      .pipe(
        debounceTime(2000),
        distinctUntilChanged()
      )
      .subscribe(async value => {
        await this.initLocationOptions();
      });
    this.assignedEmployeeUserSearchCtrl.valueChanges
      .pipe(
        debounceTime(2000),
        distinctUntilChanged()
      )
      .subscribe(async value => {
        await this.initAssignedEmployeeUserOptions();
      });
    await this.initLocationOptions();
    await this.initAssignedEmployeeUserOptions();
    this.scannerForm.valueChanges.subscribe(res=> {
      console.log("Form data", res);
    })
    this.isLoading = false;
  }

  async initDetails() {
    try {
      forkJoin([
        this.scannerService.getByCode(this.scannerCode).toPromise(),
        this.locationsService.getAdvanceSearch({
          columnDef: [{
            filter: this.locationSearchInput.nativeElement.value,
            apiNotation: "name"
          }],
          order: {
            "firstName": "ASC"
          } as any,
          pageIndex: 0,
          pageSize: 0
        }),
        this.employeeUsersService.getAdvanceSearch({
          columnDef: [{
            filter: this.assignedEmployeeUserSearchInput.nativeElement.value,
            apiNotation: "name"
          }],
          order: {
            "firstName": "ASC"
          } as any,
          pageIndex: 0,
          pageSize: 0
        }),
      ]).subscribe(([scanner, locationOptions, assignedEmployeeUserOptions]) => {
        if (locationOptions.success) {
          this.optionsLocation = locationOptions.data.results.map(x => {
            return { name: x.name, code: x.locationId }
          });
        }
        if (assignedEmployeeUserOptions.success) {
          this.optionsAssignedEmployeeUser = assignedEmployeeUserOptions.data.results.map(x => {
            return { name: `${x.firstName} ${x.lastName}`, code: x.employeeUserId }
          });
        }
        if (scanner.success) {
          this.scanner = scanner.data;
          this.scannerForm.setValue({
            scannerCode: scanner.data.scannerCode,
            name: scanner.data.name,
            scannerType: scanner.data.scannerType || 'LOCATION',
            assignedEmployeeUserId: scanner.data.assignedEmployeeUser?.employeeUserId,
            locationId: scanner.data.location?.locationId,
            statusId: scanner.data.status?.statusId
          });
          this.scannerForm.updateValueAndValidity();
          if (this.isReadOnly) {
            this.scannerForm.disable();
            this.assignedEmployeeUserSearchCtrl.disable();
            this.locationSearchCtrl.disable();
          }
          this.locationSearchCtrl.setValue({
            name: scanner.data.location?.name,
            code: scanner.data.location?.locationId
          });
          this.assignedEmployeeUserSearchCtrl.setValue({
            name: `${scanner.data.assignedEmployeeUser?.firstName} ${scanner.data.assignedEmployeeUser?.lastName}`,
            code: scanner.data.assignedEmployeeUser?.employeeUserId
          });

          this.scannerForm.markAsPristine();
          this.scannerForm.markAsUntouched();
          this.isLoading = false;
        } else {
          this.isLoading = false;
          if(scanner.message || scanner.message !== "") {
            throw new Error(scanner.message);
          }
          if(locationOptions.message || locationOptions.message !== "") {
            throw new Error(locationOptions.message);
          }
          if(assignedEmployeeUserOptions.message || assignedEmployeeUserOptions.message !== "") {
            throw new Error(assignedEmployeeUserOptions.message);
          }
          this.snackBar.open(this.error, 'close', {
            panelClass: ['style-error'],
          });
        }
      });
    } catch (ex) {
      this.isLoading = false;
      this.error = Array.isArray(ex.message) ? ex.message[0] : ex.message;
      this.snackBar.open(this.error, 'close', {
        panelClass: ['style-error'],
      });
    }
  }

  async initLocationOptions() {
    this.isOptionsLocationLoading = true;
    const res = await this.locationsService.getAdvanceSearch({
      columnDef: [{
        filter: this.locationSearchInput.nativeElement.value,
        apiNotation: "name"
      }],
      order: {
        "name": "ASC"
      } as any,
      pageIndex: 0,
      pageSize: 10
    }).toPromise();
    this.optionsLocation = res.data.results.map(a => { return { name: a.name, code: a.locationId } });
    this.mapSearchLocation();
    this.isOptionsLocationLoading = false;
  }

  async initAssignedEmployeeUserOptions() {
    this.isOptionsAssignedEmployeeUserLoading = true;
    const res = await this.employeeUsersService.getAdvanceSearch({
      columnDef: [{
        filter: this.assignedEmployeeUserSearchInput.nativeElement.value,
        apiNotation: "name"
      }],
      order: {
        "firstName": "ASC"
      } as any,
      pageIndex: 0,
      pageSize: 10
    }).toPromise();
    this.optionsAssignedEmployeeUser = res.data.results.map(a => { return { name: `${a.firstName} ${a.lastName}`, code: a.employeeUserId } });
    this.mapSearchAssignedEmployeeUser();
    this.isOptionsAssignedEmployeeUserLoading = false;
  }

  displayLocationName(value?: { name: string; code: string }): string {
    return value?.name ?? '';
  }

  displaymapSearchAssignedEmployeeUser(value?: { name: string; code: string }): string {
    return value?.name ?? '';
  }

  onLocationSelected(value?: number) {
    const location = this.optionsLocation.find(_ => _.code === value?.toString());
    this.f['locationId'].setValue(location?.code);
    this.locationSearchCtrl.setValue(location); // ensure the full object is set for displayWith
  }

  onAssignedEmployeeUserSelected(value?: number) {
    const user = this.optionsAssignedEmployeeUser.find(_ => _.code === value?.toString());
    this.f['assignedEmployeeUserId'].setValue(user?.code);
    this.assignedEmployeeUserSearchCtrl.setValue(user); // ensure the full object is set for displayWith
  }

  mapSearchLocation() {
    const selected = this.optionsLocation.find(x => x.name === this.locationSearchCtrl.value?.name);
    if (selected && selected.code !== this.locationSearchCtrl.value?.code) {
      this.f['locationId'].setValue(selected.code);
      this.f['locationId'].setErrors(null);
      this.locationSearchCtrl.setValue(selected);
    } else if(!selected || !selected?.code) {
      this.f['locationId'].setValue(null);
      this.f['locationId'].setErrors({ required: true });
    }
    if (this.f['locationId'].errors) {
      this.locationSearchCtrl.setErrors(this.f['locationId'].errors);
    }
  }

  mapSearchAssignedEmployeeUser() {
    const selected = this.optionsAssignedEmployeeUser.find(x => x.name === this.assignedEmployeeUserSearchCtrl.value?.name);
    if (selected && selected.code !== this.assignedEmployeeUserSearchCtrl.value?.code) {
      this.f['assignedEmployeeUserId'].setValue(selected.code);
      this.f['assignedEmployeeUserId'].setErrors(null);
      this.assignedEmployeeUserSearchCtrl.setValue(selected);
    } else if(!selected || !selected?.code) {
      this.f['assignedEmployeeUserId'].setValue(null);
      this.f['assignedEmployeeUserId'].setErrors({ required: true });
    }
    if (this.f['assignedEmployeeUserId'].errors) {
      this.assignedEmployeeUserSearchCtrl.setErrors(this.f['assignedEmployeeUserId'].errors);
    }
  }


  getError(key: string) {
    return this.f[key].errors;
  }

  onSubmit() {
    if (this.scannerForm.invalid || this.assignedEmployeeUserSearchCtrl.invalid) {
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
        let res: ApiResponse<Scanner>;
        if (this.isNew) {
          res = await this.scannerService.create(params).toPromise();
        } else {
          res = await this.scannerService.update(this.scannerCode, params).toPromise();
        }
        this.isProcessing = false;

        if (res.success) {
          this.snackBar.open('Saved!', 'close', {
            panelClass: ['style-success'],
          });
          this.router.navigate(['/scanner/' + res.data.scannerCode]);
          dialogRef.componentInstance.isProcessing = this.isProcessing;
          dialogRef.close();
        } else {
          dialogRef.componentInstance.isProcessing = this.isProcessing;
          this.error = Array.isArray(res.message)
            ? res.message[0]
            : res.message;
          this.snackBar.open(this.error, 'close', {
            panelClass: ['style-error'],
          });
          dialogRef.close();
          if (res?.message?.toString().toLowerCase().includes("code") && res?.message?.toString().toLowerCase().includes("already exist")) {
            this.scannerForm.get("scannerCode").setErrors({
              exist: true
            })
          }
          if (res?.message?.toString().toLowerCase().includes("invalid") || res?.message?.toString().toLowerCase().includes("characters")) {
            this.scannerForm.get("scannerCode").setErrors({
              pattern: true
            })
          }
          if (res?.message?.toString().toLowerCase().includes("name") && res?.message?.toString().toLowerCase().includes("already exist")) {
            this.scannerForm.get("name").setErrors({
              exist: true
            })
          }
          if (res?.message?.toString().toLowerCase().includes("size must be") && res?.message?.toString().toLowerCase().includes("following values")) {
            this.scannerForm.get("size").setErrors({
              invalid: true
            })
          }
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

  onDeleteProduct() {
    const dialogData = new AlertDialogModel();
    dialogData.title = 'Delete scanner';
    dialogData.message = 'Are you sure you want to delete this scanner?';
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

        const res = await this.scannerService.delete(this.scannerCode).toPromise();
        if (res.success) {
          this.snackBar.open('Scanner deleted!', 'close', {
            panelClass: ['style-success'],
          });
          this.router.navigate(['/Scanner/']);
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
