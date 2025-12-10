import { Component, Inject, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { FilterLocation, FilterStatus } from 'src/app/model/statistics.model';

@Component({
  selector: 'app-bulk-update-dialog',
  templateUrl: './bulk-update-dialog.component.html',
  styleUrls: ['./bulk-update-dialog.component.scss']
})
export class BulkUpdateDialogComponent implements OnInit {
  bulkUpdateForm: FormGroup;

  constructor(
    public dialogRef: MatDialogRef<BulkUpdateDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: {
      selectedCount: number;
      locations: FilterLocation[];
      statuses: FilterStatus[];
    }
  ) {
    this.bulkUpdateForm = new FormGroup({
      updateLocation: new FormControl(false),
      locationId: new FormControl(null),
      updateStatus: new FormControl(false),
      statusId: new FormControl(null)
    });
  }

  ngOnInit(): void {
    // Add validators when checkboxes are checked
    this.bulkUpdateForm.get('updateLocation')?.valueChanges.subscribe(checked => {
      const locationControl = this.bulkUpdateForm.get('locationId');
      if (checked) {
        locationControl?.setValidators([Validators.required]);
      } else {
        locationControl?.clearValidators();
        locationControl?.setValue(null);
      }
      locationControl?.updateValueAndValidity();
    });

    this.bulkUpdateForm.get('updateStatus')?.valueChanges.subscribe(checked => {
      const statusControl = this.bulkUpdateForm.get('statusId');
      if (checked) {
        statusControl?.setValidators([Validators.required]);
      } else {
        statusControl?.clearValidators();
        statusControl?.setValue(null);
      }
      statusControl?.updateValueAndValidity();
    });
  }

  isFormValid(): boolean {
    const form = this.bulkUpdateForm;
    const updateLocation = form.get('updateLocation')?.value;
    const updateStatus = form.get('updateStatus')?.value;
    
    if (!updateLocation && !updateStatus) {
      return false; // At least one must be selected
    }
    
    if (updateLocation && !form.get('locationId')?.valid) {
      return false;
    }
    
    if (updateStatus && !form.get('statusId')?.valid) {
      return false;
    }
    
    return true;
  }

  onConfirm(): void {
    if (this.isFormValid()) {
      const formValue = this.bulkUpdateForm.value;
      const result: any = {};
      
      if (formValue.updateLocation && formValue.locationId) {
        result.locationId = formValue.locationId;
      }
      
      if (formValue.updateStatus && formValue.statusId) {
        result.statusId = formValue.statusId;
      }
      
      this.dialogRef.close(result);
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}

