import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LocationsComponent } from './locations.component';
import { LocationDetailsComponent } from './location-details/location-details.component';
import { LocationFormComponent } from './location-form/location-form.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { FlexLayoutModule } from '@ngbracket/ngx-layout';
import { NgxSkeletonLoaderModule } from 'ngx-skeleton-loader';
import { SharedComponentsModule } from 'src/app/shared/components/shared-components.module';
import { MaterialModule } from 'src/app/shared/material/material.module';

export const routes: Routes = [
  {
    path: '',
    component: LocationsComponent,
    pathMatch: 'full',
    data: { title: "Locations" }
  },
  {
    path: 'add',
    component: LocationDetailsComponent,
    data: { title: "New Location", details: true, isNew: true}
  },
  {
    path: ':locationId',
    component: LocationDetailsComponent,
    data: { title: "Locations", details: true }
  },
  {
    path: ':locationId/edit',
    component: LocationDetailsComponent,
    data: { title: "Locations", details: true, edit: true }
  },
];


@NgModule({
  declarations: [
    LocationsComponent,
    LocationDetailsComponent,
    LocationFormComponent
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
export class LocationsModule { }
