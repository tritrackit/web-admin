import { Component, EventEmitter, Input, Output, TemplateRef, ViewChild } from '@angular/core';
import { FormControl, NG_VALUE_ACCESSOR } from '@angular/forms';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'app-data-table-range-filter',
  templateUrl: './data-table-range-filter.component.html',
  styleUrls: ['./data-table-range-filter.component.scss'],
})
export class DataTableRangeFilterComponent {
  @Input() fromValue = 100;
  @Input() toValue = 1000;
  @Input() max = 1000;
  value = `${this.fromValue} - ${this.toValue}`;
  @ViewChild('rangeFormDialog') rangeFormDialog: TemplateRef<any>;
  dialogRef: MatDialogRef<any>;
  @Output() valueChange = new EventEmitter<any>();
  fromValueCtrl = new FormControl(this.fromValue);
  toValueCtrl = new FormControl(this.toValue);
  maxRangeCtrl = new FormControl(this.max);
  constructor(public dialog: MatDialog) {
    this.maxRangeCtrl.valueChanges.subscribe(res=>{
      this.max = res;
    });
  }

  async click() {
    this.dialogRef = this.dialog.open(this.rangeFormDialog, {
      width: '1080px',
    });
    this.fromValueCtrl.setValue(this.fromValue);
    this.toValueCtrl.setValue(this.toValue);
    this.maxRangeCtrl.setValue(this.max);
  }

  onSliderChange(event) {
  }

  onInputChange() {
  }

  close() {
    this.fromValue = this.fromValueCtrl.value;
    this.toValue = this.toValueCtrl.value;
    this.value = `${this.fromValue} - ${this.toValue}`;
    this.valueChange.emit(this.value);
    this.dialogRef.close();
  }

  maxRangeChange(event) {
  }
}
