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


  private destroy$ = new Subject<void>();

  constructor(
    private unitService: UnitService,
    private statisticsService: StatisticsService,
    private storageService: StorageService,
    private snackBar: MatSnackBar,
    private router: Router,
    private dialog: MatDialog,
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
        // 🔥 Auto-reload silently for location updates and other changes
        this.loadUnits();
      });
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

  onSearch(): void {
    this.pageIndex = 0;
    this.loadUnits();
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
          
          this.dataSource.data = apiRows;
          this.total = response.data.total;
          
          // Update select all state
          this.updateSelectAllState();
        } else {
          this.snackBar.open(response.message || 'Failed to load units', 'Close', { duration: 3000 });
        }
      },
      error: (error) => {
        this.loading = false;
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
        // Combine both updates into one confirmation
        if (result.locationId || result.statusId) {
          this.performBulkUpdate(selectedRows, result.locationId, result.statusId);
        }
      }
    });
  }
  
  performBulkUpdate(selectedRows: UnitTableRow[], locationId?: string, statusId?: string): void {
    let locationName = '';
    let statusName = '';
    
    // Get names for confirmation message
    if (locationId) {
      const location = this.locations.find(l => l.locationId === locationId);
      locationName = location ? location.name : '';
    }
    
    if (statusId) {
      const status = this.statuses.find(s => s.statusId === statusId);
      statusName = status ? status.name : '';
    }
    
    // Build confirmation message
    let confirmationMessage = `Are you sure you want to update ${selectedRows.length} unit(s)?\n\n`;
    
    if (locationId && statusId) {
      confirmationMessage += `• Location: ${locationName}\n`;
      confirmationMessage += `• Status: ${statusName}`;
    } else if (locationId) {
      confirmationMessage += `• Location: ${locationName}`;
    } else if (statusId) {
      confirmationMessage += `• Status: ${statusName}`;
    }
    
    // Show single confirmation dialog
    const dialogData = new AlertDialogModel();
    dialogData.title = 'Bulk Update Confirmation';
    dialogData.message = confirmationMessage;
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
      this.executeBulkUpdate(selectedRows, locationId, statusId, locationName, statusName);
    });
  }
  
  executeBulkUpdate(selectedRows: UnitTableRow[], locationId?: string, statusId?: string, locationName?: string, statusName?: string): void {
    this.bulkUpdating = true;
    let completed = 0;
    let failed = 0;
    const total = selectedRows.length;
  
    selectedRows.forEach((row) => {
      const updateData: any = {
        modelId: row.modelId,
        color: row.color,
        chassisNo: row.chassisNo,
        rfid: row.rfid,
        description: row.description || ''
      };
  
      // Add location if provided
      if (locationId) {
        updateData.locationId = locationId;
      }
      
      // Add status if provided
      if (statusId) {
        updateData.statusId = statusId;
      }
  
      this.unitService.update(row.unitCode, updateData).subscribe({
        next: (response) => {
          completed++;
          if (response.success) {
            // Update local data
            const dataRow = this.dataSource.data.find(r => r.unitId === row.unitId);
            if (dataRow) {
              if (locationId && locationName) {
                dataRow.locationId = locationId;
                dataRow.location = locationName;
              }
              if (statusId && statusName) {
                dataRow.statusId = statusId;
                dataRow.status = statusName;
              }
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
