import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AccessPagesTableComponent } from './access-pages-table/access-pages-table.component';
import { MaterialModule } from '../material/material.module';
import { NotificationWindowComponent } from './notification-window/notification-window.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { DateAdapter, MAT_DATE_FORMATS, MAT_DATE_LOCALE, MatNativeDateModule } from '@angular/material/core';
import { FlexLayoutModule } from '@ngbracket/ngx-layout';
import { AppDateAdapter } from '../utility/app-date-adapter';
import { AlertDialogComponent } from './alert-dialog/alert-dialog.component';
import { OptionSheetComponent } from './option-sheet/option-sheet.component';
import { DataTableRangeFilterComponent } from './data-table/data-table-range-filter/data-table-range-filter.component';
import { DataTableComponent } from './data-table/data-table.component';
import { NgxSkeletonLoaderModule } from 'ngx-skeleton-loader';
import { ImageUploadDialogComponent } from './image-upload-dialog/image-upload-dialog.component';
import { ImageViewerDialogComponent } from './image-viewer-dialog/image-viewer-dialog.component';
import { WebcamModule } from 'ngx-webcam';
import { ImageCropperModule } from 'ngx-image-cropper';
export const MY_DATE_FORMATS = {
  parse: {
    dateInput: 'MMMM DD, YYYY',  // Corrected for your format
  },
  display: {
    dateInput: 'MMMM DD, YYYY',  // Corrected for your format
    monthYearLabel: 'MMMM YYYY',
    dateA11yLabel: 'MMMM DD, YYYY',  // For screen readers
    monthYearA11yLabel: 'MMMM YYYY',  // For screen readers
  }
};



@NgModule({
  declarations: [
    AccessPagesTableComponent,
    NotificationWindowComponent,
    ImageUploadDialogComponent,
    ImageViewerDialogComponent,
    AlertDialogComponent,
    OptionSheetComponent,
    DataTableComponent,
    DataTableRangeFilterComponent,
  ],
  exports: [
    AccessPagesTableComponent,
    NotificationWindowComponent,
    ImageUploadDialogComponent,
    ImageViewerDialogComponent,
    AlertDialogComponent,
    OptionSheetComponent,
    DataTableComponent,
    DataTableRangeFilterComponent,
  ],
  imports: [
    CommonModule,
    MaterialModule,
    FormsModule,
    ReactiveFormsModule,
    FlexLayoutModule,
    MatNativeDateModule,
    NgxSkeletonLoaderModule,
    WebcamModule,
    ImageCropperModule
],
  providers: [
    { provide: MAT_DATE_LOCALE, useValue: 'en-US' },  // Locale
    { provide: MAT_DATE_FORMATS, useValue: MY_DATE_FORMATS },  // Custom date formats
    { provide: DateAdapter, useClass: AppDateAdapter }  // Make sure NativeDateAdapter is used
  ]
})
export class SharedComponentsModule { }
