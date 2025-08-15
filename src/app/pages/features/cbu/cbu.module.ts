import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CBUComponent } from './cbu.component';
import { CBUDetailsComponent } from './cbu-details/cbu-details.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Routes, RouterModule } from '@angular/router';
import { FlexLayoutModule } from '@ngbracket/ngx-layout';
import { NgxSkeletonLoaderModule } from 'ngx-skeleton-loader';
import { SharedComponentsModule } from 'src/app/shared/components/shared-components.module';
import { MaterialModule } from 'src/app/shared/material/material.module';


export const routes: Routes = [
  {
    path: '',
    component: CBUComponent,
    pathMatch: 'full',
    data: { title: "CBU" }
  },
  {
    path: 'add',
    component: CBUDetailsComponent,
    data: { title: "New CBU", details: true, isNew: true }
  },
  {
    path: ':unitCode',
    component: CBUDetailsComponent,
    data: { title: "CBU", details: true }
  },
  {
    path: ':unitCode/edit',
    component: CBUDetailsComponent,
    data: { title: "CBU", details: true, edit: true }
  },
];

@NgModule({
  declarations: [
    CBUComponent,
    CBUDetailsComponent,
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
export class CbuModule { }
