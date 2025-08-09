import { NgModule } from '@angular/core';
import { AsyncPipe, CommonModule, NgFor } from '@angular/common';
import { EditProfileComponent } from './edit-profile.component';
import { RouterModule, Routes } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgxSkeletonLoaderModule } from 'ngx-skeleton-loader';
import { MaterialModule } from 'src/app/shared/material/material.module';
import { FlexLayoutModule } from '@ngbracket/ngx-layout';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    component: EditProfileComponent,
    data: { title: "Edit profile", details: true }
  },
];


@NgModule({
  declarations: [
    EditProfileComponent
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
export class EditProfileModule { }
