import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScannerComponent } from './scanner.component';
import { ScannerDetailsComponent } from './scanner-details/scanner-details.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Routes, RouterModule } from '@angular/router';
import { FlexLayoutModule } from '@ngbracket/ngx-layout';
import { NgxSkeletonLoaderModule } from 'ngx-skeleton-loader';
import { SharedComponentsModule } from 'src/app/shared/components/shared-components.module';
import { MaterialModule } from 'src/app/shared/material/material.module';


export const routes: Routes = [
  {
    path: '',
    component: ScannerComponent,
    pathMatch: 'full',
    data: { title: "RFID Scanner" }
  },
  {
    path: 'add',
    component: ScannerDetailsComponent,
    data: { title: "New Scanner", details: true, isNew: true }
  },
  {
    path: ':scannerCode',
    component: ScannerDetailsComponent,
    data: { title: "RFID Scanner", details: true }
  },
  {
    path: ':scannerCode/edit',
    component: ScannerDetailsComponent,
    data: { title: "RFID Scanner", details: true, edit: true }
  },
];


@NgModule({
  declarations: [
    ScannerComponent,
    ScannerDetailsComponent
  ],
  imports: [
    CommonModule,
    FlexLayoutModule,
    NgxSkeletonLoaderModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule.forChild(routes),
    SharedComponentsModule,
    MaterialModule,
  ]
})
export class ScannerModule { }
