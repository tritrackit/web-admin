import { ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router } from '@angular/router';
import { debounceTime, distinctUntilChanged, filter, Subject, takeUntil } from 'rxjs';
import { AppConfigService } from 'src/app/services/app-config.service';
import { StorageService } from 'src/app/services/storage.service';
import { AlertDialogModel } from 'src/app/shared/components/alert-dialog/alert-dialog-model';
import { AlertDialogComponent } from 'src/app/shared/components/alert-dialog/alert-dialog.component';
import { MyErrorStateMatcher } from 'src/app/shared/form-validation/error-state.matcher';
import { UnitService } from 'src/app/services/unit.service';
import { ApiResponse } from 'src/app/model/api-response.model';
import { Units } from 'src/app/model/units.model';
import { ModelService } from 'src/app/services/model.service';
import { Locations } from 'src/app/model/locations.model';
import { EmployeeUsers } from 'src/app/model/employee-users.model';
import { MatAutocompleteTrigger } from '@angular/material/autocomplete';

@Component({
  selector: 'app-register-cbu',
  templateUrl: './register-cbu.component.html',
  styleUrl: './register-cbu.component.scss',
  host: {
    class: "page-component"
  }
})
export class RegisterCbuComponent implements OnInit, OnDestroy {
  currentUserProfile: EmployeeUsers;
  error: string;
  isLoading = false; // Start as false - form fields are always ready
  
  // Scanner code from RFID scan
  scannerCode: string;
  
  // Form for registration
  unitForm: FormGroup = new FormGroup({
    rfid: new FormControl('', [Validators.required]),
    chassisNo: new FormControl('', [Validators.required]),
    modelId: new FormControl('', [Validators.required]),
    locationId: new FormControl('', [Validators.required]),
    color: new FormControl('', [Validators.required]),
    description: new FormControl('', [Validators.required]),
  });
  
  matcher = new MyErrorStateMatcher();
  isProcessing = false;

  location: Locations;

  modelSearchCtrl = new FormControl();
  isOptionsModelLoading = false;
  optionsModel: { name: string; code: string }[] = [];
  @ViewChild('modelSearchInput', { static: true }) modelSearchInput: ElementRef<HTMLInputElement>;
  @ViewChild('modelTrig', { read: MatAutocompleteTrigger }) modelTrig!: MatAutocompleteTrigger;

  private destroy$ = new Subject<void>();

  constructor(
    private unitService: UnitService,
    private modelService: ModelService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private appconfig: AppConfigService,
    private storageService: StorageService,
    private route: ActivatedRoute,
    public router: Router,
    private formBuilder: FormBuilder,
    private cdr: ChangeDetectorRef,
  ) {
    this.currentUserProfile = this.storageService.getLoginProfile();
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
    // 🔥 STEP 1: ALWAYS check query params FIRST (synchronous, no await)
    const queryParams = this.route.snapshot.queryParams;
    
    // 🔥 Handle query params if RFID was scanned
    if (queryParams['rfid']) {
      const paramStart = Date.now();
      console.log('🚨 Register CBU: Query params detected', queryParams);
      
      // ⚡ ALWAYS SET required values with defaults to ensure form displays (SYNCHRONOUS)
      this.scannerCode = queryParams['scannerCode'] || '';
      
      // ⚡ SET FORM VALUES IMMEDIATELY (0ms delay - synchronous operation)
      this.unitForm.patchValue({
        rfid: queryParams['rfid'] || '',
        locationId: queryParams['locationId'] || 'OPEN_AREA'
      }, { emitEvent: false });
      
      // ⚡ CREATE location object immediately (with defaults)
      this.location = {
        locationId: queryParams['locationId'] || 'OPEN_AREA',
        name: queryParams['location'] || queryParams['locationName'] || 'Open Area'
      } as Locations;
      
      const paramTime = Date.now() - paramStart;
      console.log(`⚡ Query params processed in ${paramTime}ms - Form ready!`);
      
      // ⚡ FORCE form to be valid for display
      if (this.unitForm.value.rfid) {
        this.unitForm.get('rfid').setValidators([Validators.required]);
        this.unitForm.get('rfid').updateValueAndValidity();
      }
      
      // ⚡ AUTO-OPEN model dropdown after view init (reduced delay)
      // Use requestAnimationFrame for better performance
      requestAnimationFrame(() => {
        setTimeout(() => {
          if (this.modelTrig) {
            this.modelTrig.openPanel();
            // ⚡ AUTO-FOCUS on chassisNo field (reduced delay)
            requestAnimationFrame(() => {
              const chassisInput = document.querySelector('input[formControlName="chassisNo"]') as HTMLInputElement;
              if (chassisInput) {
                chassisInput.focus();
              }
            });
          }
        }, 50); // Reduced from 200ms to 50ms
      });
      
      // ⚡ SHOW INSTANT NOTIFICATION (only for instant flag)
      if (queryParams['instant'] === 'true') {
        this.snackBar.open(`⚡ RFID Scanned: ${queryParams['rfid']}`, 'Ready', {
          duration: 2000,
          panelClass: ['instant-toast'],
          horizontalPosition: 'end',
          verticalPosition: 'top'
        });
      }
      
      // 🔥 Load model options in BACKGROUND (non-blocking)
      this.initModelOptions().catch(err => {
        console.error('Error loading model options:', err);
      });
    } else {
      // 🔥 If no query params, form is still ready (user can manually enter RFID)
      console.log('📝 Register CBU: Empty form ready for manual entry');
      
      // Load model options in background
      this.initModelOptions().catch(err => {
        console.error('Error loading model options:', err);
      });
    }
    
    // 🔥 STEP 2: Listen to query params changes (for dynamic updates when navigating)
    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(params => {
      if (params['rfid'] && (!this.unitForm.value.rfid || this.unitForm.value.rfid !== params['rfid'])) {
        console.log('🚨 Register CBU: Query params changed/updated', params);
        
        // ⚡ UPDATE form values
        this.scannerCode = params['scannerCode'] || this.scannerCode || '';
        
        this.unitForm.patchValue({
          rfid: params['rfid'],
          locationId: params['locationId'] || this.unitForm.value.locationId || 'OPEN_AREA'
        }, { emitEvent: false });
        
        this.location = {
          locationId: params['locationId'] || this.location?.locationId || 'OPEN_AREA',
          name: params['location'] || params['locationName'] || this.location?.name || 'Open Area'
        } as Locations;
        
        // ⚡ Use requestAnimationFrame for immediate UI update
        requestAnimationFrame(() => {
          if (this.modelTrig) {
            this.modelTrig.openPanel();
            requestAnimationFrame(() => {
              const chassisInput = document.querySelector('input[formControlName="chassisNo"]') as HTMLInputElement;
              if (chassisInput) {
                chassisInput.focus();
              }
            });
          }
        });
        
        this.cdr.detectChanges();
      }
    });
    
    // 🔥 STEP 3: Listen to UnitService for direct events (when already on page)
    // Use distinctUntilChanged to prevent duplicate processing
    console.log(`🔍 Register CBU: Setting up data$ subscription`);
    
    this.unitService.data$
      .pipe(
        filter((d: any) => {
          const shouldProcess = !!d && d._instant && !d._handled;
          console.log(`🔍 Register CBU: Filter check`, {
            hasData: !!d,
            isInstant: d?._instant,
            isHandled: d?._handled,
            shouldProcess: shouldProcess,
            rfid: d?.rfid
          });
          return shouldProcess;
        }), // ⚡ Only instant, unhandled events
        distinctUntilChanged((prev, curr) => {
          const isSame = prev?.rfid === curr?.rfid;
          console.log(`🔍 Register CBU: distinctUntilChanged check`, {
            prevRfid: prev?.rfid,
            currRfid: curr?.rfid,
            isSame: isSame,
            willEmit: !isSame
          });
          return isSame;
        }), // ⚡ Prevent duplicate RFIDs
        takeUntil(this.destroy$)
      )
      .subscribe(data => {
        const receiveTime = Date.now();
        console.log('🔍 Register CBU: Event received in data$ subscription', {
          rfid: data.rfid,
          latency: data._latency || 0,
          _handled: data._handled,
          currentFormRfid: this.unitForm.value.rfid,
          willProcess: !this.unitForm.value.rfid || this.unitForm.value.rfid !== data.rfid
        });
        
        // 🔍 DEBUG: Check if already processed
        if (data._handled) {
          console.log(`⏭️ Register CBU: Event already handled, skipping`, {
            rfid: data.rfid,
            _handled: data._handled
          });
          return;
        }
        
        // Mark as handled to prevent other components from processing
        data._handled = true;
        console.log(`🔍 Register CBU: Marked as handled`, {
          rfid: data.rfid,
          _handled: data._handled
        });
        
        if (!this.unitForm.value.rfid || this.unitForm.value.rfid !== data.rfid) {
          console.log('🔍 Register CBU: Form will be updated', {
            currentRfid: this.unitForm.value.rfid,
            newRfid: data.rfid,
            reason: !this.unitForm.value.rfid ? 'FORM_EMPTY' : 'DIFFERENT_RFID'
          });
          // ⚡ UPDATE FORM INSTANTLY (0ms delay - synchronous)
          const populateStart = Date.now();
          this.scannerCode = data.scannerCode || this.scannerCode || '';
          
          this.unitForm.patchValue({
            rfid: data.rfid,
            locationId: data.location?.locationId || this.unitForm.value.locationId || 'OPEN_AREA'
          }, { emitEvent: false });
          
          // ⚡ ENSURE location is set (with fallback)
          this.location = data.location || this.location || {
            locationId: 'OPEN_AREA',
            name: 'Open Area'
          } as Locations;
          
          const populateTime = Date.now() - populateStart;
          console.log(`⚡ Form populated in ${populateTime}ms`);
          
          // ⚡ OPEN MODEL DROPDOWN (immediate, no delay)
          // Use requestAnimationFrame for better performance
          requestAnimationFrame(() => {
            if (this.modelTrig) {
              this.modelTrig.openPanel();
              // Auto-focus chassisNo field (immediate)
              requestAnimationFrame(() => {
                const chassisInput = document.querySelector('input[formControlName="chassisNo"]') as HTMLInputElement;
                if (chassisInput) {
                  chassisInput.focus();
                }
              });
            }
          });
          
          // ⚡ Force immediate change detection
          this.cdr.detectChanges();
          
          // 🔍 DEBUG: Clear data after processing to allow new scans
          console.log(`🔍 Register CBU: Clearing scanned data after form population`, {
            rfid: data.rfid,
            formRfid: this.unitForm.value.rfid
          });
          
          // ⚡ Clear data after a short delay to allow form to update
          setTimeout(() => {
            this.unitService.clearScannedData();
            console.log(`🔍 Register CBU: Scanned data cleared`);
          }, 500);
        } else {
          console.log(`🔍 Register CBU: Form already has this RFID, skipping update`, {
            formRfid: this.unitForm.value.rfid,
            eventRfid: data.rfid
          });
          
          // ⚡ Still clear data even if form already has it
          setTimeout(() => {
            this.unitService.clearScannedData();
            console.log(`🔍 Register CBU: Scanned data cleared (form already had RFID)`);
          }, 200);
        }
      });
    
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

  async initModelOptions() {
    this.isOptionsModelLoading = true;
    try {
      const res = await this.modelService.getAdvanceSearch({
        keywords: this.modelSearchInput?.nativeElement?.value || '',
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
    } catch (error) {
      console.error('Error loading model options:', error);
    } finally {
      this.isOptionsModelLoading = false;
    }
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

    if (!this.scannerCode) {
      this.snackBar.open('Please scan RFID with a registration scanner', 'close', {
        panelClass: ['style-error'],
      });
      return;
    }

    const dialogData = new AlertDialogModel();
    dialogData.title = 'Confirm Registration';
    dialogData.message = 'Register this unit via scanner?';
    dialogData.confirmButton = {
      visible: true,
      text: 'Yes, Register',
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
        const res: ApiResponse<Units> = await this.unitService.registerViaScanner({
          scannerCode: this.scannerCode,
          rfid: this.unitForm.value.rfid,
          chassisNo: this.unitForm.value.chassisNo,
          color: this.unitForm.value.color,
          description: this.unitForm.value.description,
          modelId: this.unitForm.value.modelId
        }).toPromise();
        
        this.isProcessing = false;
        dialogRef.componentInstance.isProcessing = this.isProcessing;

        if (res.success) {
          console.log(`🔍 Register CBU: Registration successful, clearing data`, {
            unitCode: res.data?.unitCode,
            rfid: res.data?.rfid
          });
          
          // ⚡ Clear scanned data immediately after successful registration
          this.unitService.clearScannedData();
          
          dialogRef.close();
          
          this.snackBar.open('✅ Unit registered successfully!', 'close', {
            panelClass: ['style-success'],
            duration: 2000
          });
          
          // 🔥 Navigate immediately to unit details page (backend already returned success)
          if (res.data && res.data.unitCode) {
            // Navigate immediately - no delay needed since backend already confirmed creation
            this.router.navigate([`/cbu/${res.data.unitCode}`], {
              replaceUrl: false
            }).catch((err) => {
              console.error('Navigation error:', err);
              // Fallback to CBU list if navigation fails
              this.router.navigate(['/cbu']);
            });
          } else {
            // Fallback to CBU list if no unitCode
            this.router.navigate(['/cbu']);
          }
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
}

