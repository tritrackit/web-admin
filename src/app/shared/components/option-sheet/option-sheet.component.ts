import { Component, EventEmitter, Inject, Output } from '@angular/core';
import { MAT_BOTTOM_SHEET_DATA } from '@angular/material/bottom-sheet';
@Component({
  selector: 'app-option-sheet',
  templateUrl: './option-sheet.component.html',
  styleUrls: ['./option-sheet.component.scss']
})
export class OptionSheetComponent {
  isUserAccount = false;
  isConfirmYesNoCancel = false;
  @Output() confirmLogOut = new EventEmitter();
  @Output() confirmYesNoCancel = new EventEmitter();
  constructor(@Inject(MAT_BOTTOM_SHEET_DATA) public data: {isUserAccount: boolean; isConfirmYesNoCancel: boolean}) {
    this.isUserAccount = data.isUserAccount;
    this.isConfirmYesNoCancel = data.isConfirmYesNoCancel;
   }
}
