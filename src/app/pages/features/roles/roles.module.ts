import { SharedComponentsModule } from './../../../shared/components/shared-components.module';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RolesComponent } from './roles.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Routes, RouterModule } from '@angular/router';
import { FlexLayoutModule } from '@ngbracket/ngx-layout'
import { NgxSkeletonLoaderModule } from 'ngx-skeleton-loader';
import { RoleFormComponent } from './role-form/role-form.component';
import { RoleDetailsComponent } from './role-details/role-details.component';
import { MaterialModule } from 'src/app/shared/material/material.module';

export const routes: Routes = [
  {
    path: '',
    component: RolesComponent,
    pathMatch: 'full',
    data: { title: "Roles" }
  },
  {
    path: 'add',
    component: RoleDetailsComponent,
    data: { title: "New Role", details: true, isNew: true}
  },
  {
    path: ':roleCode',
    component: RoleDetailsComponent,
    data: { title: "Roles", details: true }
  },
  {
    path: ':roleCode/edit',
    component: RoleDetailsComponent,
    data: { title: "Roles", details: true, edit: true }
  },
];


@NgModule({
  declarations: [
    RolesComponent,
    RoleDetailsComponent,
    RoleFormComponent
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
export class AccessModule { }
