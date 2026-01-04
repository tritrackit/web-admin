import { ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router } from '@angular/router';
import { debounceTime, distinctUntilChanged, forkJoin, Subject, Subscription, takeUntil } from 'rxjs';
import { AppConfigService } from 'src/app/services/app-config.service';
import { LocationsService } from 'src/app/services/locations.service';
import { StorageService } from 'src/app/services/storage.service';
import { AlertDialogModel } from 'src/app/shared/components/alert-dialog/alert-dialog-model';
import { AlertDialogComponent } from 'src/app/shared/components/alert-dialog/alert-dialog.component';
import { MyErrorStateMatcher } from 'src/app/shared/form-validation/error-state.matcher';
import { UnitService } from 'src/app/services/unit.service';
import moment from 'moment';
import { ApiResponse } from 'src/app/model/api-response.model';
import { AuthService } from 'src/app/services/auth.service';
import { Units } from 'src/app/model/units.model';
import { ModelService } from 'src/app/services/model.service';
import { Locations } from 'src/app/model/locations.model';
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
  unitCode: string;
  isNew = false;
  isReadOnly = true;
  error: string;
  isLoading = true;
  
  // Add scannerCode property (not used for view/edit, kept for compatibility)
  scannerCode: string;
  
  unitForm: FormGroup = new FormGroup({
    unitCode: new FormControl(),
    rfid: new FormControl(''),
    chassisNo: new FormControl('', [Validators.required]),
    modelId: new FormControl('', [Validators.required]),
    locationId: new FormControl('', [Validators.required]),
    color: new FormControl('', [Validators.required]),
    description: new FormControl('', [Validators.required]),
  });
  
  mediaWatcher: Subscription;
  matcher = new MyErrorStateMatcher();
  isProcessing = false;
  isLoadingRoles = false;
  maxDate = moment(new Date().getFullYear() - 18).format('YYYY-MM-DD');

  location: Locations;

  modelSearchCtrl = new FormControl();
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
    // Add locationId from the scanned location
    if (this.location) {
      data.locationId = this.location.locationId;
    }
    return data;
  }


  async ngOnInit(): Promise<void> {
    this.isLoading = true;
    
    // 🔥 CBU Details is ONLY for viewing/editing existing units
    // Registration is handled by RegisterCbuComponent
    if (this.isNew) {
      // Redirect to register page if somehow accessed as new
      this.router.navigate(['/cbu/register']);
      return;
    }
    
    // Load existing unit details
    await this.initDetails();
    
    // 🔥 Listen to model search changes
    this.modelSearchCtrl.valueChanges
      .pipe(
        debounceTime(2000),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe(async value => {
        await this.initModelOptions();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async initDetails(retryCount: number = 0, maxRetries: number = 3) {
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
          this.optionsModel = modelOptions.data.results.map(x => ({
            name: x.modelName, 
            code: x.modelId 
          }));
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
          // 🔄 Retry logic: If unit not found and we haven't exceeded retries, retry with exponential backoff
          const errorMessage = Array.isArray(unit.message) ? unit.message[0] : unit.message;
          const isNotFound = errorMessage?.toLowerCase().includes('not found') || 
                            errorMessage?.toLowerCase().includes('404') ||
                            !unit.data;
          
          if (isNotFound && retryCount < maxRetries) {
            const delay = Math.min(300 * Math.pow(2, retryCount), 2000); // Exponential backoff: 300ms, 600ms, 1200ms, max 2000ms
            
            setTimeout(() => {
              this.initDetails(retryCount + 1, maxRetries);
            }, delay);
            return; // Don't show error yet, will retry
          }
          
          // Max retries exceeded or different error - show error
          this.isLoading = false;
          this.error = errorMessage;
          this.snackBar.open(this.error, 'close', {
            panelClass: ['style-error'],
          });
        }
      });
    } catch (ex) {
      // Handle network/connection errors with retry
      if (retryCount < maxRetries) {
        const delay = Math.min(300 * Math.pow(2, retryCount), 2000);
        
        setTimeout(() => {
          this.initDetails(retryCount + 1, maxRetries);
        }, delay);
        return;
      }
      
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
    
    this.optionsModel = res.data.results.map(a => ({ 
      name: a.modelName, 
      code: a.modelId 
    }));
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
    this.f['modelId'].setValue(model?.code);
    this.modelSearchCtrl.setValue(model);
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
    dialogData.title = 'Confirm Update';
    dialogData.message = 'Update this unit?';
    dialogData.confirmButton = {
      visible: true,
      text: 'Yes, Update',
      color: 'primary',
    };
    dialogData.dismissButton = {
      visible: true,
      text: 'Cancel',
    };
    
    const dialogRef = this.dialog.open(AlertDialogComponent, {
      maxWidth: '400px',
      closeOnNavigation: true,
    });
    dialogRef.componentInstance.alertDialogConfig = dialogData;

    dialogRef.componentInstance.conFirm.subscribe(async () => {
      this.isProcessing = true;
      dialogRef.componentInstance.isProcessing = this.isProcessing;
      
      try {
        // Use regular update for existing units
        const params = this.formData;
        const res: ApiResponse<Units> = await this.unitService.update(this.unitCode, params).toPromise();
        
        this.isProcessing = false;
        dialogRef.componentInstance.isProcessing = this.isProcessing;

        if (res.success) {
          this.snackBar.open('✅ Unit updated successfully!', 'close', {
            panelClass: ['style-success'],
            duration: 2000
          });
          
          // Reload unit details to show updated data
          await this.initDetails();
          
          dialogRef.close();
        } else {
          this.error = Array.isArray(res.message) ? res.message[0] : res.message;
          this.snackBar.open(this.error, 'close', {
            panelClass: ['style-error'],
          });
          
          dialogRef.close();
        }
      } catch (e) {
        this.isProcessing = false;
        dialogRef.componentInstance.isProcessing = this.isProcessing;
        this.error = Array.isArray(e.message) ? e.message[0] : e.message;
        this.snackBar.open('Update failed: ' + this.error, 'close', {
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

    dialogRef.componentInstance.conFirm.subscribe(async () => {
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
          this.error = Array.isArray(res.message) ? res.message[0] : res.message;
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
    event.target.src = this.getDefaultProfilePicture();
  }

  getDefaultProfilePicture() {
    return '../../../../../assets/img/person.png';
  }

  // Add this method to test location scanning
  testLocationScan() {
    if (!this.unitForm.value.rfid || !this.scannerCode) {
      this.snackBar.open('Please scan RFID first', 'close', {
        panelClass: ['style-error'],
      });
      return;
    }

    const dialogData = new AlertDialogModel();
    dialogData.title = 'Scan Location';
    dialogData.message = `Scan unit ${this.unitForm.value.rfid} at location?`;
    dialogData.confirmButton = {
      visible: true,
      text: 'Scan',
      color: 'primary',
    };
    dialogData.dismissButton = {
      visible: true,
      text: 'Cancel',
    };
    
    const dialogRef = this.dialog.open(AlertDialogComponent, {
      maxWidth: '400px',
      closeOnNavigation: true,
    });
    dialogRef.componentInstance.alertDialogConfig = dialogData;

    dialogRef.componentInstance.conFirm.subscribe(async () => {
      try {
        this.isProcessing = true;
        const res = await this.unitService.scanLocation({
          scannerCode: this.scannerCode,
          rfid: this.unitForm.value.rfid
        }).toPromise();
        
        if (res.success) {
          this.snackBar.open('Location updated successfully!', 'close', {
            panelClass: ['style-success'],
          });
          // Refresh unit details if we're viewing an existing unit
          if (!this.isNew) {
            await this.initDetails();
          }
        } else {
          this.snackBar.open(res.message, 'close', {
            panelClass: ['style-error'],
          });
        }
      } catch (e) {
        this.snackBar.open(e.message || 'Scan failed', 'close', {
          panelClass: ['style-error'],
        });
      } finally {
        this.isProcessing = false;
        dialogRef.close();
      }
    });
  }
}