import { ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router } from '@angular/router';
import { debounceTime, distinctUntilChanged, filter, forkJoin, map, Observable, of, startWith, Subject, Subscription, switchMap, takeUntil } from 'rxjs';
import { AppConfigService } from 'src/app/services/app-config.service';
import { LocationsService } from 'src/app/services/locations.service';
import { StorageService } from 'src/app/services/storage.service';
import { AlertDialogModel } from 'src/app/shared/components/alert-dialog/alert-dialog-model';
import { AlertDialogComponent } from 'src/app/shared/components/alert-dialog/alert-dialog.component';
import { MyErrorStateMatcher } from 'src/app/shared/form-validation/error-state.matcher';
import { LocationFormComponent } from '../../locations/location-form/location-form.component';
import { UnitService } from 'src/app/services/unit.service';
import moment from 'moment';
import { ApiResponse } from 'src/app/model/api-response.model';
import { AuthService } from 'src/app/services/auth.service';
import { ImageViewerDialogComponent } from 'src/app/shared/components/image-viewer-dialog/image-viewer-dialog.component';
import { Units } from 'src/app/model/units.model';
import { ModelService } from 'src/app/services/model.service';
import { Locations } from 'src/app/model/locations.model';
import { PusherService } from 'src/app/services/pusher.service';
import { EmployeeUsers } from 'src/app/model/employee-users.model';
import { MatAutocompleteTrigger } from '@angular/material/autocomplete';

@Component({
  selector: 'app-cbu-details',
  templateUrl: './cbu-details.component.html',
  styleUrl: './cbu-details.component.scss',
  host: {
    class: "page-component"
  }
})
export class CBUDetailsComponent implements OnInit, OnDestroy {
  currentUserProfile: EmployeeUsers;
  currentChannel: any;
  unitCode;
  isNew = false;
  isReadOnly = true;
  error;
  isLoading = true;
  unitForm: FormGroup = new FormGroup({
    unitCode: new FormControl(),
    rfid: new FormControl(''),
    chassisNo: new FormControl('', [Validators.required]),
    modelId: new FormControl('', [Validators.required]),
    locationId: new FormControl('', [Validators.required]),
    color: new FormControl('', [Validators.required]),
    description: new FormControl('', [Validators.required]),
  }
  );
  mediaWatcher: Subscription;
  matcher = new MyErrorStateMatcher();
  isProcessing = false;
  isLoadingRoles = false;
  maxDate = moment(new Date().getFullYear() - 18).format('YYYY-MM-DD');

  location: Locations;

  modelSearchCtrl = new FormControl()
  isOptionsModelLoading = false;
  optionsModel: { name: string; code: string }[] = [];
  @ViewChild('modelSearchInput', { static: true }) modelSearchInput: ElementRef<HTMLInputElement>;

  unit: Units;

  private destroy$ = new Subject<void>();

  @ViewChild('modelTrig', { read: MatAutocompleteTrigger }) modelTrig!: MatAutocompleteTrigger;

  constructor(
    private unitService: UnitService,
    private modelService: ModelService,
    private locationsService: LocationsService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private appconfig: AppConfigService,
    private storageService: StorageService,
    private route: ActivatedRoute,
    public router: Router,
    private formBuilder: FormBuilder,
    private authService: AuthService,
    private pusher: PusherService,
    private cdr: ChangeDetectorRef,
  ) {
    const { isNew, edit } = this.route.snapshot.data;
    this.isNew = isNew ? isNew : false;
    this.unitCode = this.route.snapshot.paramMap.get('unitCode');
    this.isReadOnly = !edit && !isNew;

    this.currentUserProfile = this.storageService.getLoginProfile();
  }

  get pageRights() {
    let rights = {};
    // for(var right of this.pageAccess.rights) {
    //   rights[right] = this.pageAccess.modify;
    // }
    return rights;
  }

  get f() {
    return this.unitForm.controls;
  }
  get formIsValid() {
    return this.unitForm.valid && this.modelSearchCtrl.valid;
  }
  get formIsReady() {
    return this.unitForm.valid && this.modelSearchCtrl.valid && (this.unitForm.dirty || this.modelSearchCtrl.dirty);
  }
  get formData() {
    const data = this.unitForm.value;
    data.price = data?.price?.toString();
    return data;
  }

  get isRegistrationValid() {
    return this.location && this.location?.locationCode && this.formData.locationId && this.formData.rfid && this.formData.rfid.length > 0;
  }

  async ngOnInit(): Promise<void> {
    this.isLoading = true;
    if (!this.isNew) {
      await this.initDetails();
    } else {
      if (this.isNew) {

        this.unitService.data$
        .pipe(
          filter((d: any) => !!d),   // ignore null clears
          takeUntil(this.destroy$)
        ).subscribe(data => {
          if(data?.rfid && data?.location?.locationId){
            this.unitForm.controls["rfid"].patchValue(data?.rfid, {
              emitEvent: true
            });

            this.unitForm.controls["locationId"].patchValue(data?.location?.locationId, {
              emitEvent: true
            });

            this.location = data?.location;

            this.cdr.detectChanges();
            this.snackBar.open('RFID Detected!', 'close', {
              panelClass: ['style-success'],
            });

            this.modelTrig.openPanel();
            setTimeout(() => {
              this.unitService.clearScannedData();
            }, 500);
          }
        });
      }
    }
    this.modelSearchCtrl.valueChanges
      .pipe(
        debounceTime(2000),
        distinctUntilChanged()
      )
      .subscribe(async value => {
        await this.initModelOptions();
      });
    await this.initModelOptions();
    this.isLoading = false;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async initDetails() {
    try {
      forkJoin([
        this.unitService.getByCode(this.unitCode).toPromise(),
        this.modelService.getAdvanceSearch({
          keywords: this.modelSearchInput?.nativeElement?.value,
          order: {
            "modelName": "ASC"
          } as any,
          pageIndex: 0,
          pageSize: 0
        }),
      ]).subscribe(([unit, modelOptions]) => {
        if (modelOptions.success) {
          this.optionsModel = modelOptions.data.results.map(x => {
            return { name: x.modelName, code: x.modelId }
          });
        }
        if (unit.success) {
          this.unit = unit.data;
          this.unitForm.setValue({
            unitCode: unit.data.unitCode,
            rfid: unit.data.rfid,
            chassisNo: unit.data.chassisNo,
            color: unit.data.color,
            description: unit.data.description,
            modelId: unit.data.model?.modelId,
            locationId: unit.data.location?.locationId,
          });
          this.location = unit.data.location;
          this.unitForm.updateValueAndValidity();
          if (this.isReadOnly) {
            this.unitForm.disable();
            this.modelSearchCtrl.disable();
          }
          this.modelSearchCtrl.setValue({
            name: unit.data.model?.modelName,
            code: unit.data.model?.modelId
          });

          this.unitForm.markAsPristine();
          this.unitForm.markAsUntouched();
          this.isLoading = false;
        } else {
          this.isLoading = false;
          this.error = Array.isArray(unit.message) ? unit.message[0] : unit.message;
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

  async initModelOptions() {
    this.isOptionsModelLoading = true;
    const res = await this.modelService.getAdvanceSearch({
      keywords: this.modelSearchInput?.nativeElement?.value,
      order: {
        "modelName": "ASC"
      } as any,
      pageIndex: 0,
      pageSize: 10
    }).toPromise();
    this.optionsModel = res.data.results.map(a => { return { name: a.modelName, code: a.modelId } });
    this.mapSearchModel();
    this.isOptionsModelLoading = false;
  }

  displayLocationName(value?: { name: string; code: string }): string {
    return value?.name ?? '';
  }

  displayModelName(value?: { name: string; code: string }): string {
    return value?.name ?? '';
  }

  onModelSelected(value?: number) {
    const model = this.optionsModel.find(_ => _.code === value?.toString());
    this.f['modelId'].setValue(model);
    this.modelSearchCtrl.setValue(model); // ensure the full object is set for displayWith
  }

  mapSearchModel() {
    const selected = this.optionsModel.find(x => x.name === this.modelSearchCtrl.value?.name);
    if (selected) {
      this.f['modelId'].setValue(selected.code);
      this.f['modelId'].setErrors(null);
      if (this.modelSearchCtrl.value?.code !== selected?.code) {
        this.modelSearchCtrl.setValue(selected);
      }
    } else {
      this.f['modelId'].setValue(null);
      this.f['modelId'].setErrors({ required: true });
    }
    if (this.f['modelId'].errors) {
      this.modelSearchCtrl.setErrors(this.f['modelId'].errors);
    }
  }


  getError(key: string) {
    return this.f[key].errors;
  }

  onSubmit() {
    if (this.unitForm.invalid || this.modelSearchCtrl.invalid) {
      return;
    }

    const dialogData = new AlertDialogModel();
    dialogData.title = 'Confirm';
    dialogData.message = 'Save CBU?';
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
        let res: ApiResponse<Units>;
        if (this.isNew) {
          res = await this.unitService.create(params).toPromise();
        } else {
          res = await this.unitService.update(this.unitCode, params).toPromise();
        }
        this.isProcessing = false;

        if (res.success) {
          this.snackBar.open('Saved!', 'close', {
            panelClass: ['style-success'],
          });
          this.router.navigate(['/cbu/' + res.data.unitCode]);
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
          if (res?.message?.toString().toLowerCase().includes("already exist")) {
            this.unitForm.get("name").setErrors({
              exist: true
            })
          }
          if (res?.message?.toString().toLowerCase().includes("size must be") && res?.message?.toString().toLowerCase().includes("following values")) {
            this.unitForm.get("size").setErrors({
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
    dialogData.title = 'Delete CBU';
    dialogData.message = 'Are you sure you want to delete this CBU?';
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

        const res = await this.unitService.delete(this.unitCode).toPromise();
        if (res.success) {
          this.snackBar.open('CBU deleted!', 'close', {
            panelClass: ['style-success'],
          });
          this.router.navigate(['/cbu/']);
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
