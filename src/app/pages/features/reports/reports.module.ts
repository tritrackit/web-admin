import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PdfViewerModule } from 'ng2-pdf-viewer';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { FlexLayoutModule } from '@ngbracket/ngx-layout';
import { NgxSkeletonLoaderModule } from 'ngx-skeleton-loader';
import { MaterialModule } from 'src/app/shared/material/material.module';
import { NgApexchartsModule } from 'ng-apexcharts';
import { ReportsComponent } from './reports.component';

export const routes: Routes = [
  {
    path: '',
    component: ReportsComponent,
    pathMatch: 'full',
    data: { title: "Reports" }
  }
]


@NgModule({
  declarations: [ReportsComponent],
  imports: [
    CommonModule,
    FlexLayoutModule,
    MaterialModule,
    NgxSkeletonLoaderModule,
    FormsModule,
    ReactiveFormsModule,
    NgApexchartsModule,
    RouterModule.forChild(routes),
    PdfViewerModule
  ]
})
export class ReportsModule { }
