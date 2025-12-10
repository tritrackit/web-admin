import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { FlexLayoutModule } from '@ngbracket/ngx-layout';
import { MaterialModule } from 'src/app/shared/material/material.module';
import { UnitTrackerComponent } from './unit-tracker.component';
import { UnitDetailsComponent } from './unit-details/unit-details.component';
import { BulkUpdateDialogComponent } from './unit-bulk-update/bulk-update-dialog.component';

export const routes: Routes = [
  {
    path: '',
    component: UnitTrackerComponent,
    pathMatch: 'full',
    data: { title: "Unit Tracker" }
  },
  {
    path: ':unitCode',
    component: UnitDetailsComponent,
    data: { title: "Unit Activity" }
  }
];

@NgModule({
  declarations: [
    UnitTrackerComponent, 
    UnitDetailsComponent,
    BulkUpdateDialogComponent
  ],
  imports: [
    CommonModule,
    FlexLayoutModule,
    MaterialModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule.forChild(routes)
  ]
})
export class UnitTrackerModule { }
