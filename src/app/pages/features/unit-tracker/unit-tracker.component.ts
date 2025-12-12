import { Component, OnInit, OnDestroy, NgZone } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableDataSource } from '@angular/material/table';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { UnitService } from 'src/app/services/unit.service';
import { StatisticsService } from 'src/app/services/statistics.service';
import { StorageService } from 'src/app/services/storage.service';
import { Units } from 'src/app/model/units.model';
import { FilterLocation, FilterStatus, FilterModel } from 'src/app/model/statistics.model';
import { EmployeeUsers } from 'src/app/model/employee-users.model';
import { AlertDialogComponent } from 'src/app/shared/components/alert-dialog/alert-dialog.component';
import { AlertDialogModel } from 'src/app/shared/components/alert-dialog/alert-dialog-model';
import { BulkUpdateDialogComponent } from './unit-bulk-update/bulk-update-dialog.component';
import { UltraRealtimeService } from 'src/app/services/ultra-realtime.service';

interface UnitTableRow {
  unitId: string;
  unitCode: string;
  rfid: string;
  chassisNo: string;
  color: string;
  model: string;
  modelId: string;
  location: string;
  locationId: string;
  status: string;
  statusId: string;
  description?: string;
  selected?: boolean;
  _predictive?: boolean;
  _transactionId?: string;
  _pending?: boolean;
  _highlight?: boolean;
  _updating?: boolean;
  _confirmed?: boolean;
}

@Component({
  selector: 'app-unit-tracker',
  templateUrl: './unit-tracker.component.html',
  styleUrls: ['./unit-tracker.component.scss'],
  host: {
    class: "page-component"
  }
})
export class UnitTrackerComponent implements OnInit, OnDestroy {
  // Search and filters
  searchControl = new FormControl('');
  selectedColorFilter: string | null = null;
  selectedModelFilter: string | null = null;
  selectedWarehouseFilter: string | null = null;
  selectedStatusFilter: string | null = null;

  // Filter options
  colors: string[] = [];
  models: FilterModel[] = [];
  locations: FilterLocation[] = [];
  statuses: FilterStatus[] = [];

  // Table data
  dataSource = new MatTableDataSource<UnitTableRow>([]);
  displayedColumns: string[] = ['select', 'rfid', 'chassisNo', 'color', 'model', 'location', 'status', 'actions'];
  
  // Pagination
  pageIndex = 0;
  pageSize = 10;
  total = 0;
  
  // Loading states
  loading = false;
  updatingUnit: { [unitId: string]: boolean } = {};
  bulkUpdating = false;

  // Selection state
  selectedUnits: Set<string> = new Set();
  selectAllChecked = false;
  selectAllIndeterminate = false;

  // Current user
  currentUser: EmployeeUsers;
  
  // Access control flags
  hasModifyAccess: boolean = false;
  hasViewAccess: boolean = false;

  // 🔥 PREDICTIVE: New properties
  private predictiveUnits = new Map<string, UnitTableRow>();

  private destroy$ = new Subject<void>();

  constructor(
    private unitService: UnitService,
    private statisticsService: StatisticsService,
    private storageService: StorageService,
    private snackBar: MatSnackBar,
    private router: Router,
    private dialog: MatDialog,
    private ultraRealtime: UltraRealtimeService,
    private zone: NgZone
  ) {
    this.currentUser = this.storageService.getLoginProfile();
    this.checkAccessRights();
  }
  
  /**
   * Check if user has modify or view access for Unit Tracker page
   */
  checkAccessRights(): void {
    if (!this.currentUser || !this.currentUser.role || !this.currentUser.role.accessPages) {
      this.hasViewAccess = false;
      this.hasModifyAccess = false;
      return;
    }
    
    const unitTrackerAccess = this.currentUser.role.accessPages.find(
      (access: any) => access.page && access.page.trim().toUpperCase() === 'UNIT TRACKER'
    );
    
    if (unitTrackerAccess) {
      this.hasViewAccess = unitTrackerAccess.view === true;
      this.hasModifyAccess = unitTrackerAccess.modify === true;
    } else {
      this.hasViewAccess = false;
      this.hasModifyAccess = false;
    }
  }

  ngOnInit(): void {
    this.loadFilterOptions();
    this.loadUnits();
    
    // Subscribe to search changes with debouncing
    this.searchControl.valueChanges
      .pipe(
        debounceTime(300), // Wait 300ms after user stops typing
        distinctUntilChanged(), // Only trigger if value actually changed
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        this.pageIndex = 0;
        this.loadUnits();
      });

    // Subscribe to real-time updates via Pusher
    this.unitService.refresh$
      .pipe(
        takeUntil(this.destroy$),
        debounceTime(300) // Small debounce to avoid rapid refreshes
      )
      .subscribe(() => {
        console.log('🔄 UnitTracker: Pusher update received, reloading units...');
        // 🔥 Auto-reload silently for location updates and other changes
        this.loadUnits();
      });
    
    // 🔥 PREDICTIVE: Listen for ultra-fast updates
    this.setupPredictiveListeners();
  }
  
  private setupPredictiveListeners() {
    // 🔥 PREDICTIVE UPDATES: Show unit BEFORE backend confirms (5-10ms)
    this.unitService.predictiveUpdates$
      .pipe(takeUntil(this.destroy$))
      .subscribe(update => {
        this.zone.run(() => {
          console.log('🎯 UnitTracker: Predictive update', update);
          this.handlePredictiveUpdate(update);
        });
      });
    
    // 🔥 CONFIRMED UPDATES: Replace predictive with real data (20-30ms)
    this.unitService.confirmedUpdates$
      .pipe(takeUntil(this.destroy$))
      .subscribe(update => {
        this.zone.run(() => {
          console.log('✅ UnitTracker: Confirmed update', update);
          this.handleConfirmedUpdate(update);
        });
      });
  }
  
  // 🔥 HANDLE PREDICTIVE UPDATE: Show unit immediately
  private handlePredictiveUpdate(update: any) {
    if (update.action === 'UNIT_REGISTERING_PREDICTIVE') {
      this.addPredictiveRow(update);
    } else if (update.action === 'LOCATION_UPDATED_PREDICTIVE') {
      this.updatePredictiveLocation(update);
    }
  }
  
  // 🔥 ADD PREDICTIVE ROW: Show unit BEFORE it exists in database
  private addPredictiveRow(update: any) {
    const predictiveRow: UnitTableRow = {
      unitId: `predictive_${update.rfid}_${Date.now()}`,
      unitCode: 'Loading...',
      rfid: update.rfid,
      chassisNo: '...',
      color: '...',
      model: '...',
      modelId: '',
      location: update.location || 'Scanning...',
      locationId: '',
      status: 'Processing...',
      statusId: '',
      selected: false,
      _predictive: true,
      _transactionId: update._transactionId,
      _pending: true,
      _highlight: true
    };
    
    // Store in predictive map
    this.predictiveUnits.set(update.rfid, predictiveRow);
    
    // Add to table IMMEDIATELY
    this.zone.run(() => {
      const currentData = [...this.dataSource.data];
      currentData.unshift(predictiveRow); // Add to top
      this.dataSource.data = currentData.slice(0, this.pageSize);
      this.total++;
      
      // Visual feedback
      this.showPredictiveNotification(update.rfid);
      this.highlightNewRow(predictiveRow.unitId);
    });
  }
  
  // 🔥 UPDATE PREDICTIVE LOCATION: Show location change immediately (SILENT - no toast)
  private updatePredictiveLocation(update: any) {
    // Update existing predictive row
    let rowUpdated = false;
    
    // Check predictive units first
    const predictiveRow = this.predictiveUnits.get(update.rfid);
    if (predictiveRow) {
      predictiveRow.location = 'Updating...';
      predictiveRow._updating = true;
      rowUpdated = true;
    }
    
    // Check regular table rows
    if (!rowUpdated) {
      const currentData = [...this.dataSource.data];
      const rowIndex = currentData.findIndex(row => row.rfid === update.rfid);
      
      if (rowIndex > -1) {
        currentData[rowIndex].location = 'Updating...';
        currentData[rowIndex]._updating = true;
        currentData[rowIndex]._highlight = true;
        this.dataSource.data = currentData;
        rowUpdated = true;
        
        // Visual feedback (silent - no toast for location updates)
        this.highlightRow(currentData[rowIndex].unitId);
      }
    }
    
    // 🔥 NO TOAST for location updates - just update silently
    // Location updates are for existing units, no need to notify user
  }
  
  // 🔥 HANDLE CONFIRMED UPDATE: Replace predictive with real data
  private handleConfirmedUpdate(update: any) {
    if (update.action === 'UNIT_REGISTERED_CONFIRMED') {
      this.replacePredictiveWithReal(update);
    } else if (update.action === 'LOCATION_UPDATED_CONFIRMED' || 
               update.action === 'LOCATION_UPDATED' ||
               update.action === 'ENTERED_WAREHOUSE_5' ||
               update.action === 'EXITED_WAREHOUSE_5') {
      // 🔥 Location updates for existing units - update silently
      this.updateRealLocation(update);
    } else if (update.action === 'UNIT_UPDATED') {
      this.updateExistingUnit(update);
    } else {
      // 🔥 Any other update - reload to ensure data consistency
      this.loadUnits();
    }
  }
  
  // 🔥 REPLACE PREDICTIVE WITH REAL: When backend confirms registration
  private replacePredictiveWithReal(update: any) {
    const currentData = [...this.dataSource.data];
    
    // Find predictive row
    const predictiveIndex = currentData.findIndex(row => 
      row._predictive && (row.rfid === update.rfid || row._transactionId === update._transactionId)
    );
    
    if (predictiveIndex > -1) {
      // Replace with real data
      const realRow = this.createRowFromUnit(update);
      currentData[predictiveIndex] = realRow;
      this.dataSource.data = currentData;
      
      // Remove from predictive map
      this.predictiveUnits.delete(update.rfid);
      
      // Show success
      this.showSuccessNotification(`Unit ${update.rfid} registered!`);
      this.animateRowSuccess(realRow.unitId);
      
    } else {
      // Add as new row (predictive might have been filtered out)
      const realRow = this.createRowFromUnit(update);
      currentData.unshift(realRow);
      this.dataSource.data = currentData.slice(0, this.pageSize);
      this.total++;
    }
  }
  
  // 🔥 UPDATE REAL LOCATION: When backend confirms location change (SILENT - no toast)
  private updateRealLocation(update: any) {
    const currentData = [...this.dataSource.data];
    const rowIndex = currentData.findIndex(row => row.rfid === update.rfid);
    
    if (rowIndex > -1) {
      currentData[rowIndex].location = update.location?.name || update.location || currentData[rowIndex].location;
      currentData[rowIndex].locationId = update.locationId || update.location?.locationId || currentData[rowIndex].locationId;
      currentData[rowIndex].status = update.status?.name || update.status || currentData[rowIndex].status;
      currentData[rowIndex].statusId = update.statusId || update.status?.statusId || currentData[rowIndex].statusId;
      currentData[rowIndex]._updating = false;
      currentData[rowIndex]._highlight = false;
      this.dataSource.data = currentData;
      
      // 🔥 SILENT UPDATE - No toast for location updates of existing units
      // Just animate the row to show it was updated
      this.animateRowUpdate(currentData[rowIndex].unitId);
    } else {
      // Unit not in current view - reload to get updated data
      this.loadUnits();
    }
  }
  
  // 🔥 UPDATE EXISTING UNIT: Handle other unit updates
  private updateExistingUnit(update: any) {
    const currentData = [...this.dataSource.data];
    const rowIndex = currentData.findIndex(row => row.rfid === update.rfid || row.unitId === update.unitId);
    
    if (rowIndex > -1) {
      const updatedRow = this.createRowFromUnit(update);
      currentData[rowIndex] = { ...currentData[rowIndex], ...updatedRow };
      this.dataSource.data = currentData;
    }
  }
  
  // 🔥 VISUAL FEEDBACK METHODS
  private showPredictiveNotification(rfid: string) {
    this.snackBar.open(`Scanning RFID: ${rfid}...`, 'Dismiss', {
      duration: 2000,
      panelClass: ['predictive-toast']
    });
  }
  
  private showSuccessNotification(message: string) {
    this.snackBar.open(`✅ ${message}`, 'Dismiss', {
      duration: 2000,
      panelClass: ['success-toast'],
      horizontalPosition: 'end',
      verticalPosition: 'top'
    });
  }
  
  private highlightNewRow(rowId: string) {
    setTimeout(() => {
      const rowElement = document.getElementById(`row-${rowId}`);
      if (rowElement) {
        rowElement.classList.add('predictive-highlight');
        setTimeout(() => rowElement.classList.remove('predictive-highlight'), 2000);
      }
    }, 10);
  }
  
  private highlightRow(rowId: string) {
    const rowElement = document.getElementById(`row-${rowId}`);
    if (rowElement) {
      rowElement.classList.add('updating-highlight');
      setTimeout(() => rowElement.classList.remove('updating-highlight'), 1000);
    }
  }
  
  private animateRowSuccess(rowId: string) {
    const rowElement = document.getElementById(`row-${rowId}`);
    if (rowElement) {
      rowElement.animate([
        { backgroundColor: '#e8f5e8' },
        { backgroundColor: 'transparent' }
      ], { duration: 1000 });
    }
  }
  
  private animateRowUpdate(rowId: string) {
    const rowElement = document.getElementById(`row-${rowId}`);
    if (rowElement) {
      rowElement.animate([
        { backgroundColor: '#fff3e0' },
        { backgroundColor: 'transparent' }
      ], { duration: 800 });
    }
  }
  
  // 🔥 CREATE ROW FROM UNIT: Helper method
  private createRowFromUnit(unit: any): UnitTableRow {
    return {
      unitId: unit.unitId || `real_${unit.rfid}`,
      unitCode: unit.unitCode || '',
      rfid: unit.rfid,
      chassisNo: unit.chassisNo || '',
      color: unit.color || '',
      model: unit.model?.modelName || unit.model || '',
      modelId: unit.modelId || unit.model?.modelId || '',
      location: unit.location?.name || unit.location || '',
      locationId: unit.locationId || unit.location?.locationId || '',
      status: unit.status?.name || unit.status || '',
      statusId: unit.statusId || unit.status?.statusId || '',
      selected: false,
      _predictive: false,
      _confirmed: true
    };
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadFilterOptions(): void {
    // Load colors from units (we'll extract unique colors)
    // Load models
    this.statisticsService.getModels().subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.models = response.data;
        }
      },
      error: (error) => {
        // Error handled silently
      }
    });

    // Load locations
    this.statisticsService.getLocations().subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.locations = response.data;
        }
      },
      error: (error) => {
        // Error handled silently
      }
    });

    // Load statuses
    this.statisticsService.getStatuses().subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.statuses = response.data;
        }
      },
      error: (error) => {
        // Error handled silently
      }
    });
  }

  loadUnits(): void {
    this.loading = true;
    
    const columnDef: { apiNotation: string; filter: any; type?: string }[] = [];

    // Add search filter - search by chassisNo (string type for ILike partial matching)
    if (this.searchControl.value && this.searchControl.value.trim()) {
      const searchValue = this.searchControl.value.trim();
      columnDef.push({
        apiNotation: 'chassisNo',
        filter: searchValue,
        type: 'string' // Explicitly set type to 'string' for ILike matching
      });
    }

    // Add color filter (string type for exact or partial matching)
    if (this.selectedColorFilter) {
      columnDef.push({
        apiNotation: 'color',
        filter: this.selectedColorFilter,
        type: 'string' // Use string type for ILike matching
      });
    }

    // Add model filter - use modelId with number type for exact match
    if (this.selectedModelFilter) {
      columnDef.push({
        apiNotation: 'modelId',
        filter: String(this.selectedModelFilter), // Ensure it's a string, backend will convert to number
        type: 'number' // Use number type for exact match
      });
    }

    // Add location filter - handle both location codes and numeric IDs
    if (this.selectedWarehouseFilter) {
      // Check if the value is a numeric locationId or a location code
      const numValue = Number(this.selectedWarehouseFilter);
      const isNumeric = !isNaN(numValue) && this.selectedWarehouseFilter.toString() === numValue.toString();
      
      if (isNumeric) {
        // It's a numeric ID - use locationId with number type
        columnDef.push({
          apiNotation: 'locationId', // Backend maps this to location.locationId when type is 'number'
          filter: String(numValue),
          type: 'number'
        });
      } else {
        // It's a location code (like "OPEN_AREA", "WAREHOUSE_4") - use locationCode with precise type for exact match
        // Find the location to get the locationCode
        const location = this.locations.find(l => l.locationId === this.selectedWarehouseFilter);
        if (location && location.locationCode) {
          columnDef.push({
            apiNotation: 'location.locationCode', // Filter by location code via relation
            filter: location.locationCode,
            type: 'precise' // Use precise type for exact match (backend uses exact equality)
          });
        } else {
          // Fallback: try using the value directly as locationCode
          columnDef.push({
            apiNotation: 'location.locationCode',
            filter: this.selectedWarehouseFilter,
            type: 'precise' // Exact match
          });
        }
      }
    }

    // Add status filter - backend will map statusId to status.statusId
    if (this.selectedStatusFilter) {
      // Backend expects statusId (not status.statusId) and will map it internally
      // Filter value should be a string that represents a number (backend converts it)
      columnDef.push({
        apiNotation: 'statusId', // Backend maps this to status.statusId when type is 'number'
        filter: String(this.selectedStatusFilter), // Ensure it's a string
        type: 'number' // Backend will map statusId -> status.statusId for number type
      });
    }

    const params = {
      order: { dateCreated: 'DESC' },
      columnDef: columnDef,
      pageSize: this.pageSize,
      pageIndex: this.pageIndex
    };

    // Keep predictive rows visible during load
    const predictiveRows = Array.from(this.predictiveUnits.values());
    
    this.unitService.getByAdvanceSearch(params).subscribe({
      next: (response) => {
        this.loading = false;
        if (response.success && response.data) {
          const apiRows: UnitTableRow[] = response.data.results.map((unit: Units) => ({
            unitId: unit.unitId,
            unitCode: unit.unitCode || '',
            rfid: unit.rfid,
            chassisNo: unit.chassisNo,
            color: unit.color,
            model: unit.model?.modelName || '',
            modelId: unit.modelId,
            location: unit.location?.name || '',
            locationId: unit.location?.locationId || '',
            status: unit.status?.name || '',
            statusId: unit.status?.statusId || '',
            description: unit.description || '',
            selected: this.selectedUnits.has(unit.unitId) // Restore selection state
          }));

          // Extract unique colors for filter
          const uniqueColors = [...new Set(apiRows.map(u => u.color))].sort();
          this.colors = uniqueColors;

          // Combine API rows with predictive rows
          // Filter out predictive rows that might have been confirmed
          const filteredPredictiveRows = predictiveRows.filter(predRow => 
            !apiRows.some(apiRow => apiRow.rfid === predRow.rfid)
          );
          
          this.dataSource.data = [...filteredPredictiveRows, ...apiRows];
          this.total = response.data.total + filteredPredictiveRows.length;
          
          // Update select all state
          this.updateSelectAllState();
        } else {
          // Keep predictive rows even on error
          this.dataSource.data = predictiveRows;
          this.snackBar.open(response.message || 'Failed to load units', 'Close', { duration: 3000 });
        }
      },
      error: (error) => {
        this.loading = false;
        // Keep predictive rows even on error
        this.dataSource.data = predictiveRows;
        this.snackBar.open('Error loading units', 'Close', { duration: 3000 });
      }
    });
  }


  onColorFilterChange(color: string | null): void {
    this.selectedColorFilter = color;
    this.pageIndex = 0;
    this.loadUnits();
  }

  onModelFilterChange(modelId: string | null): void {
    this.selectedModelFilter = modelId;
    this.pageIndex = 0;
    this.loadUnits();
  }

  onWarehouseFilterChange(locationId: string | null): void {
    this.selectedWarehouseFilter = locationId;
    this.pageIndex = 0;
    this.loadUnits();
  }

  onStatusFilterChange(statusId: string | null): void {
    this.selectedStatusFilter = statusId;
    this.pageIndex = 0;
    this.loadUnits();
  }

  onLocationChange(unit: UnitTableRow, locationId: string): void {
    // Check modify access
    if (!this.hasModifyAccess) {
      this.snackBar.open('You do not have permission to modify units', 'Close', { 
        duration: 3000,
        panelClass: ['style-error']
      });
      return;
    }
    
    if (!locationId || unit.locationId === locationId) {
      return;
    }

    const newLocationName = this.getSelectedLocationName(locationId);
    
    // Show confirmation dialog
    const dialogData = new AlertDialogModel();
    dialogData.title = 'Confirmation';
    dialogData.message = `Are you sure you want to update this unit with the chassis no ${unit.chassisNo}? Change location into "${newLocationName}"`;
    dialogData.confirmButton = {
      visible: true,
      text: 'Yes, Confirm',
      color: 'accent', // Orange button
    };
    dialogData.dismissButton = {
      visible: true,
      text: 'No, Cancel',
      color: 'primary', // Blue button
    };

    const dialogRef = this.dialog.open(AlertDialogComponent, {
      maxWidth: '400px',
      closeOnNavigation: true,
    });
    dialogRef.componentInstance.alertDialogConfig = dialogData;

    dialogRef.componentInstance.conFirm.subscribe(() => {
      this.updatingUnit[unit.unitId] = true;
      dialogRef.componentInstance.isProcessing = true;
      
      const updateData = {
        locationId: locationId,
        modelId: unit.modelId,
        color: unit.color,
        chassisNo: unit.chassisNo,
        rfid: unit.rfid,
        description: unit.description || ''
      };

      this.unitService.update(unit.unitCode, updateData).subscribe({
        next: (response) => {
          this.updatingUnit[unit.unitId] = false;
          dialogRef.componentInstance.isProcessing = false;
          
          if (response.success) {
            dialogRef.close();
            // Show success toast from the right
            this.snackBar.open('Updated successfully', 'Close', {
              duration: 3000,
              horizontalPosition: 'end',
              verticalPosition: 'top',
              panelClass: ['success-toast']
            });
            // Update local data immediately
            const row = this.dataSource.data.find(r => r.unitId === unit.unitId);
            if (row) {
              row.locationId = locationId;
              row.location = newLocationName;
            }
            // Data will refresh automatically via Pusher
          } else {
            dialogRef.close();
            this.snackBar.open(response.message || 'Failed to update location', 'Close', { 
              duration: 3000,
              panelClass: ['style-error']
            });
            this.loadUnits(); // Reload on error
          }
        },
        error: (error) => {
          this.updatingUnit[unit.unitId] = false;
          dialogRef.componentInstance.isProcessing = false;
          dialogRef.close();
          this.snackBar.open('Error updating location', 'Close', { 
            duration: 3000,
            panelClass: ['style-error']
          });
          this.loadUnits(); // Reload on error
        }
      });
    });
  }

  onStatusChange(unit: UnitTableRow, statusId: string): void {
    // Check modify access
    if (!this.hasModifyAccess) {
      this.snackBar.open('You do not have permission to modify units', 'Close', { 
        duration: 3000,
        panelClass: ['style-error']
      });
      return;
    }
    
    if (!statusId || unit.statusId === statusId) {
      return;
    }

    const newStatusName = this.getSelectedStatusName(statusId);
    
    // Show confirmation dialog
    const dialogData = new AlertDialogModel();
    dialogData.title = 'Confirmation';
    dialogData.message = `Are you sure you want to update this unit with the chassis no ${unit.chassisNo}? Change status into "${newStatusName}"`;
    dialogData.confirmButton = {
      visible: true,
      text: 'Yes, Confirm',
      color: 'accent', // Orange button
    };
    dialogData.dismissButton = {
      visible: true,
      text: 'No, Cancel',
      color: 'primary', // Blue button
    };

    const dialogRef = this.dialog.open(AlertDialogComponent, {
      maxWidth: '400px',
      closeOnNavigation: true,
    });
    dialogRef.componentInstance.alertDialogConfig = dialogData;

    dialogRef.componentInstance.conFirm.subscribe(() => {
      this.updatingUnit[unit.unitId] = true;
      dialogRef.componentInstance.isProcessing = true;
      
      const updateData = {
        locationId: unit.locationId,
        modelId: unit.modelId,
        color: unit.color,
        chassisNo: unit.chassisNo,
        rfid: unit.rfid,
        description: unit.description || '',
        statusId: statusId
      };

      this.unitService.update(unit.unitCode, updateData).subscribe({
        next: (response) => {
          this.updatingUnit[unit.unitId] = false;
          dialogRef.componentInstance.isProcessing = false;
          
          if (response.success) {
            dialogRef.close();
            // Show success toast from the right
            this.snackBar.open('Updated successfully', 'Close', {
              duration: 3000,
              horizontalPosition: 'end',
              verticalPosition: 'top',
              panelClass: ['success-toast']
            });
            // Update local data immediately
            const row = this.dataSource.data.find(r => r.unitId === unit.unitId);
            if (row) {
              row.statusId = statusId;
              row.status = newStatusName;
            }
            // Data will refresh automatically via Pusher
          } else {
            dialogRef.close();
            this.snackBar.open(response.message || 'Failed to update status', 'Close', { 
              duration: 3000,
              panelClass: ['style-error']
            });
            this.loadUnits(); // Reload on error
          }
        },
        error: (error) => {
          this.updatingUnit[unit.unitId] = false;
          dialogRef.componentInstance.isProcessing = false;
          dialogRef.close();
          this.snackBar.open('Error updating status', 'Close', { 
            duration: 3000,
            panelClass: ['style-error']
          });
          this.loadUnits(); // Reload on error
        }
      });
    });
  }

  onPageChange(event: { pageIndex: number; pageSize: number }): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadUnits();
  }

  onMoreInfo(unit: UnitTableRow): void {
    // Check view access
    if (!this.hasViewAccess) {
      this.snackBar.open('You do not have permission to view unit details', 'Close', { 
        duration: 3000,
        panelClass: ['style-error']
      });
      return;
    }
    
    this.router.navigate([`/unit-tracker/${unit.unitCode}`]);
  }

  isUpdating(unitId: string): boolean {
    return this.updatingUnit[unitId] || false;
  }

  getSelectedLocationName(locationId: string): string {
    const location = this.locations.find(l => l.locationId === locationId);
    return location ? location.name : '';
  }

  getSelectedStatusName(statusId: string): string {
    const status = this.statuses.find(s => s.statusId === statusId);
    return status ? status.name : '';
  }

  getStartRecord(): number {
    return this.pageIndex * this.pageSize + 1;
  }

  getEndRecord(): number {
    return Math.min((this.pageIndex + 1) * this.pageSize, this.total);
  }

  hasPreviousPage(): boolean {
    return this.pageIndex > 0;
  }

  hasNextPage(): boolean {
    return this.getEndRecord() < this.total;
  }

  goToPreviousPage(): void {
    if (this.hasPreviousPage()) {
      this.pageIndex--;
      this.loadUnits();
    }
  }

  goToNextPage(): void {
    if (this.hasNextPage()) {
      this.pageIndex++;
      this.loadUnits();
    }
  }

  // Selection methods
  onSelectAllChange(checked: boolean): void {
    this.selectAllChecked = checked;
    this.selectAllIndeterminate = false;
    
    if (checked) {
      // Select all units on current page
      this.dataSource.data.forEach(row => {
        row.selected = true;
        this.selectedUnits.add(row.unitId);
      });
    } else {
      // Deselect all units on current page
      this.dataSource.data.forEach(row => {
        row.selected = false;
        this.selectedUnits.delete(row.unitId);
      });
    }
  }

  onRowSelectChange(row: UnitTableRow, checked: boolean): void {
    row.selected = checked;
    
    if (checked) {
      this.selectedUnits.add(row.unitId);
    } else {
      this.selectedUnits.delete(row.unitId);
    }
    
    this.updateSelectAllState();
  }

  updateSelectAllState(): void {
    const currentPageUnits = this.dataSource.data;
    if (currentPageUnits.length === 0) {
      this.selectAllChecked = false;
      this.selectAllIndeterminate = false;
      return;
    }

    const selectedCount = currentPageUnits.filter(row => row.selected).length;
    
    if (selectedCount === 0) {
      this.selectAllChecked = false;
      this.selectAllIndeterminate = false;
    } else if (selectedCount === currentPageUnits.length) {
      this.selectAllChecked = true;
      this.selectAllIndeterminate = false;
    } else {
      this.selectAllChecked = false;
      this.selectAllIndeterminate = true;
    }
  }

  getSelectedUnits(): UnitTableRow[] {
    return this.dataSource.data.filter(row => row.selected);
  }

  getSelectedCount(): number {
    return this.selectedUnits.size;
  }

  clearSelection(): void {
    this.selectedUnits.clear();
    this.dataSource.data.forEach(row => {
      row.selected = false;
    });
    this.selectAllChecked = false;
    this.selectAllIndeterminate = false;
  }

  openBulkUpdateDialog(): void {
    // Check modify access
    if (!this.hasModifyAccess) {
      this.snackBar.open('You do not have permission to modify units', 'Close', { 
        duration: 3000,
        panelClass: ['style-error']
      });
      return;
    }
    
    const selectedRows = this.getSelectedUnits();
    if (selectedRows.length === 0) {
      this.snackBar.open('No units selected', 'Close', { duration: 3000 });
      return;
    }

    // Create bulk update form dialog
    const dialogRef = this.dialog.open(BulkUpdateDialogComponent, {
      width: '500px',
      data: {
        selectedCount: selectedRows.length,
        locations: this.locations,
        statuses: this.statuses
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        if (result.locationId) {
          const location = this.locations.find(l => l.locationId === result.locationId);
          if (location) {
            this.performBulkLocationUpdate(selectedRows, result.locationId, location.name);
          }
        }
        if (result.statusId) {
          const status = this.statuses.find(s => s.statusId === result.statusId);
          if (status) {
            this.performBulkStatusUpdate(selectedRows, result.statusId, status.name);
          }
        }
      }
    });
  }

  performBulkLocationUpdate(selectedRows: UnitTableRow[], locationId: string, locationName: string): void {
    this.bulkUpdating = true;
    let completed = 0;
    let failed = 0;
    const total = selectedRows.length;

    // Show confirmation first
    const dialogData = new AlertDialogModel();
    dialogData.title = 'Bulk Update Location';
    dialogData.message = `Are you sure you want to update ${selectedRows.length} unit(s) to location "${locationName}"?`;
    dialogData.confirmButton = {
      visible: true,
      text: 'Yes, Confirm',
      color: 'accent',
    };
    dialogData.dismissButton = {
      visible: true,
      text: 'No, Cancel',
      color: 'primary',
    };

    const dialogRef = this.dialog.open(AlertDialogComponent, {
      maxWidth: '400px',
      closeOnNavigation: true,
    });
    dialogRef.componentInstance.alertDialogConfig = dialogData;

    dialogRef.componentInstance.conFirm.subscribe(() => {
      dialogRef.close();
      this.executeBulkLocationUpdate(selectedRows, locationId, locationName);
    });
  }

  performBulkStatusUpdate(selectedRows: UnitTableRow[], statusId: string, statusName: string): void {
    this.bulkUpdating = true;
    let completed = 0;
    let failed = 0;
    const total = selectedRows.length;

    // Show confirmation first
    const dialogData = new AlertDialogModel();
    dialogData.title = 'Bulk Update Status';
    dialogData.message = `Are you sure you want to update ${selectedRows.length} unit(s) to status "${statusName}"?`;
    dialogData.confirmButton = {
      visible: true,
      text: 'Yes, Confirm',
      color: 'accent',
    };
    dialogData.dismissButton = {
      visible: true,
      text: 'No, Cancel',
      color: 'primary',
    };

    const dialogRef = this.dialog.open(AlertDialogComponent, {
      maxWidth: '400px',
      closeOnNavigation: true,
    });
    dialogRef.componentInstance.alertDialogConfig = dialogData;

    dialogRef.componentInstance.conFirm.subscribe(() => {
      dialogRef.close();
      this.executeBulkStatusUpdate(selectedRows, statusId, statusName);
    });
  }

  executeBulkLocationUpdate(selectedRows: UnitTableRow[], locationId: string, locationName: string): void {
    let completed = 0;
    let failed = 0;
    const total = selectedRows.length;

    selectedRows.forEach((row) => {
      const updateData = {
        locationId: locationId,
        modelId: row.modelId,
        color: row.color,
        chassisNo: row.chassisNo,
        rfid: row.rfid,
        description: row.description || ''
      };

      this.unitService.update(row.unitCode, updateData).subscribe({
        next: (response) => {
          completed++;
          if (response.success) {
            // Update local data
            const dataRow = this.dataSource.data.find(r => r.unitId === row.unitId);
            if (dataRow) {
              dataRow.locationId = locationId;
              dataRow.location = locationName;
            }
          } else {
            failed++;
          }

          // Check if all updates are complete
          if (completed + failed === total) {
            this.bulkUpdating = false;
            if (failed === 0) {
              this.snackBar.open(`Successfully updated ${completed} unit(s)`, 'Close', {
                duration: 3000,
                horizontalPosition: 'end',
                verticalPosition: 'top',
                panelClass: ['success-toast']
              });
              this.clearSelection();
            } else {
              this.snackBar.open(`Updated ${completed - failed} unit(s), ${failed} failed`, 'Close', {
                duration: 5000,
                panelClass: ['style-error']
              });
            }
            // Reload to ensure data consistency
            this.loadUnits();
          }
        },
        error: (error) => {
          failed++;
          completed++;

          // Check if all updates are complete
          if (completed + failed === total) {
            this.bulkUpdating = false;
            this.snackBar.open(`Updated ${completed - failed} unit(s), ${failed} failed`, 'Close', {
              duration: 5000,
              panelClass: ['style-error']
            });
            // Reload to ensure data consistency
            this.loadUnits();
          }
        }
      });
    });
  }

  executeBulkStatusUpdate(selectedRows: UnitTableRow[], statusId: string, statusName: string): void {
    let completed = 0;
    let failed = 0;
    const total = selectedRows.length;

    selectedRows.forEach((row) => {
      const updateData = {
        locationId: row.locationId,
        modelId: row.modelId,
        color: row.color,
        chassisNo: row.chassisNo,
        rfid: row.rfid,
        description: row.description || '',
        statusId: statusId
      };

      this.unitService.update(row.unitCode, updateData).subscribe({
        next: (response) => {
          completed++;
          if (response.success) {
            // Update local data
            const dataRow = this.dataSource.data.find(r => r.unitId === row.unitId);
            if (dataRow) {
              dataRow.statusId = statusId;
              dataRow.status = statusName;
            }
          } else {
            failed++;
          }

          // Check if all updates are complete
          if (completed + failed === total) {
            this.bulkUpdating = false;
            if (failed === 0) {
              this.snackBar.open(`Successfully updated ${completed} unit(s)`, 'Close', {
                duration: 3000,
                horizontalPosition: 'end',
                verticalPosition: 'top',
                panelClass: ['success-toast']
              });
              this.clearSelection();
            } else {
              this.snackBar.open(`Updated ${completed - failed} unit(s), ${failed} failed`, 'Close', {
                duration: 5000,
                panelClass: ['style-error']
              });
            }
            // Reload to ensure data consistency
            this.loadUnits();
          }
        },
        error: (error) => {
          failed++;
          completed++;

          // Check if all updates are complete
          if (completed + failed === total) {
            this.bulkUpdating = false;
            this.snackBar.open(`Updated ${completed - failed} unit(s), ${failed} failed`, 'Close', {
              duration: 5000,
              panelClass: ['style-error']
            });
            // Reload to ensure data consistency
            this.loadUnits();
          }
        }
      });
    });
  }
}
