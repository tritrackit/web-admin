import { NgModule } from '@angular/core';
import { AsyncPipe, CommonModule, NgFor } from '@angular/common';
import { ChangePasswordComponent } from './change-password.component';
import { FlexLayoutModule } from '@ngbracket/ngx-layout'
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { NgxSkeletonLoaderModule } from 'ngx-skeleton-loader';
import { MaterialModule } from 'src/app/shared/material/material.module';


export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    component: ChangePasswordComponent,
    data: { title: "Change Password", details: true }
  },
];


@NgModule({
  declarations: [
    ChangePasswordComponent
  ],
  imports: [
    CommonModule,
    FlexLayoutModule,
    MaterialModule,
    NgxSkeletonLoaderModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule.forChild(routes),
    NgFor,
    AsyncPipe
  ]
})
export class ChangePasswordModule { }
