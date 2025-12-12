import { ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router } from '@angular/router';
import { debounceTime, distinctUntilChanged, filter, forkJoin, Subject, Subscription, takeUntil } from 'rxjs';
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
  unitCode: string;
  isNew = false;
  isReadOnly = true;
  error: string;
  isLoading = true;
  
  // Add scannerCode property to store from pusher data
  scannerCode: string;
  
  // 🔥 PREDICTIVE: New properties
  isPredictiveRegistration = false;
  predictiveTransactionId: string | null = null;
  
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

  get isRegistrationValid() {
    return this.location && this.location?.locationId && this.formData.rfid && this.formData.rfid.length > 0 && this.scannerCode;
  }

  async ngOnInit(): Promise<void> {
    this.isLoading = true;
    
    // 🔥 STEP 1: Check query params IMMEDIATELY (synchronous check first)
    const queryParams = this.route.snapshot.queryParams;
    if (this.isNew && queryParams['rfid'] && queryParams['locationId']) {
      console.log('📡 CBUDetails: Query params detected (immediate)', queryParams);
      this.scannerCode = queryParams['scannerCode'] || '';
      this.isPredictiveRegistration = queryParams['predictive'] === 'true';
      this.predictiveTransactionId = queryParams['transactionId'] || null;
      
      // Set form values directly from query params IMMEDIATELY
      this.unitForm.controls["rfid"].patchValue(queryParams['rfid'], { emitEvent: false });
      this.unitForm.controls["locationId"].patchValue(queryParams['locationId'], { emitEvent: false });
      
      // Create a minimal location object for the form
      this.location = {
        locationId: queryParams['locationId'],
        name: queryParams['location'] || 'Open Area' // Use passed location name or default
      } as Locations;
      
      this.cdr.detectChanges();
      
      // Open model autocomplete after component is ready
      setTimeout(() => {
        if (this.modelTrig) {
          this.modelTrig.openPanel();
        }
      }, 500);
    }
    
    // 🔥 STEP 2: Also listen to query params changes (for dynamic updates)
    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(params => {
      if (this.isNew && params['rfid'] && params['locationId'] && !this.unitForm.value.rfid) {
        console.log('📡 CBUDetails: Query params changed', params);
        this.scannerCode = params['scannerCode'] || '';
        this.isPredictiveRegistration = params['predictive'] === 'true';
        this.predictiveTransactionId = params['transactionId'] || null;
        
        // Set form values directly from query params
        this.unitForm.controls["rfid"].patchValue(params['rfid'], { emitEvent: true });
        this.unitForm.controls["locationId"].patchValue(params['locationId'], { emitEvent: true });
        
        // Create a minimal location object for the form
        this.location = {
          locationId: params['locationId'],
          name: params['location'] || 'Open Area'
        } as Locations;
        
        this.cdr.detectChanges();
        
        // Open model autocomplete after a short delay
        setTimeout(() => {
          if (this.modelTrig) {
            this.modelTrig.openPanel();
          }
        }, 300);
      }
    });
    
    if (!this.isNew) {
      await this.initDetails();
    } else {
      // 🔥 STEP 3: Listen to real-time RFID updates (for direct scans when already on page)
      this.unitService.data$
        .pipe(
          filter((d: any) => !!d),   // ignore null clears
          takeUntil(this.destroy$)
        ).subscribe(data => {
          if (data?.rfid && data?.location?.locationId && data?.scannerCode) {
            // Only update if form is empty or different RFID
            if (!this.unitForm.value.rfid || this.unitForm.value.rfid !== data.rfid) {
              console.log('📡 CBUDetails: Real-time RFID data received', data);
              this.scannerCode = data.scannerCode; // Store scanner code for registration
              
              // Check if this is a predictive update
              if (data._predictive) {
                console.log('⚡ CBUDetails: Predictive data received', data);
                this.unitForm.controls["rfid"].patchValue(data?.rfid, { emitEvent: true });
                this.unitForm.controls["locationId"].patchValue(data?.location?.locationId, { emitEvent: true });
                this.location = data?.location;
                
                // Mark as predictive
                this.isPredictiveRegistration = true;
                this.predictiveTransactionId = data._transactionId;
                
                this.cdr.detectChanges();
              } else {
                // Regular registration flow
                console.log('CBUDetails: Regular data received', data);
                this.unitForm.controls["rfid"].patchValue(data?.rfid, { emitEvent: true });
                this.unitForm.controls["locationId"].patchValue(data?.location?.locationId, { emitEvent: true });
                this.location = data?.location;
                this.cdr.detectChanges();
              }

              // Open model autocomplete
              setTimeout(() => {
                if (this.modelTrig) {
                  this.modelTrig.openPanel();
                }
              }, 300);
              
              // Clear scanned data after processing
              setTimeout(() => {
                this.unitService.clearScannedData();
              }, 500);
            }
          }
        });
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
    
    // Different message for predictive registration
    if (this.isPredictiveRegistration) {
      dialogData.message = 'Confirm registration for scanned RFID?';
    } else {
      dialogData.message = this.isNew ? 'Register unit via scanner?' : 'Update unit?';
    }
    
    dialogData.title = 'Confirm';
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
      this.isProcessing = true;
      dialogRef.componentInstance.isProcessing = this.isProcessing;
      
      try {
        let res: ApiResponse<Units>;
        
        if (this.isNew) {
          // 🔥 Use PREDICTIVE registration if applicable
          // The UI was already updated predictively, now send the actual registration
          res = await this.unitService.registerViaScanner({
            scannerCode: this.scannerCode,
            rfid: this.unitForm.value.rfid,
            chassisNo: this.unitForm.value.chassisNo,
            color: this.unitForm.value.color,
            description: this.unitForm.value.description,
            modelId: this.unitForm.value.modelId
          }).toPromise();
        } else {
          // Use regular update for existing units
          const params = this.formData;
          res = await this.unitService.update(this.unitCode, params).toPromise();
        }
        
        this.isProcessing = false;
        dialogRef.componentInstance.isProcessing = this.isProcessing;

        if (res.success) {
          const message = this.isPredictiveRegistration ? 
            '✅ Unit registered!' : 
            (this.isNew ? 'Unit registered via scanner!' : 'Unit updated!');
          
          this.snackBar.open(message, 'close', {
            panelClass: ['style-success'],
            duration: 2000
          });
          
          // 🔥 Navigate to unit details page to see the registered unit
          if (res.data && res.data.unitCode) {
            setTimeout(() => {
              this.router.navigate([`/cbu/${res.data.unitCode}`]);
            }, 500);
          } else {
            // Fallback to unit tracker if no unitCode
            this.router.navigate(['/unit-tracker']);
          }
          
          dialogRef.close();
        } else {
          this.error = Array.isArray(res.message) ? res.message[0] : res.message;
          this.snackBar.open(this.error, 'close', {
            panelClass: ['style-error'],
          });
          
          // Handle specific errors
          if (res.message?.toLowerCase().includes("already exist")) {
            this.unitForm.get("rfid").setErrors({ exist: true });
          }
          if (res.message?.toLowerCase().includes("registration scanner not found")) {
            this.snackBar.open('Please scan RFID again with a valid registration scanner', 'close', {
              panelClass: ['style-error'],
            });
          }
          
          dialogRef.close();
        }
      } catch (e) {
        this.isProcessing = false;
        dialogRef.componentInstance.isProcessing = this.isProcessing;
        this.error = Array.isArray(e.message) ? e.message[0] : e.message;
        this.snackBar.open('Registration failed: ' + this.error, 'close', {
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