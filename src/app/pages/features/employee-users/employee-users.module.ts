import { NgModule } from '@angular/core';
import { AsyncPipe, CommonModule, NgFor } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MaterialModule } from 'src/app/shared/material/material.module';
import { EmployeeUserDetailsComponent } from './employee-user-details/employee-user-details.component';
import { NgxSkeletonLoaderModule } from 'ngx-skeleton-loader';
import { FlexLayoutModule } from '@ngbracket/ngx-layout'
import { EmployeeUsersComponent } from './employee-users.component';
import { ChangePasswordComponent } from './employee-user-details/change-password/change-password.component';
import { SharedComponentsModule } from 'src/app/shared/components/shared-components.module';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    component: EmployeeUsersComponent,
    data: { title: "User Management" }
  },
  {
    path: 'add',
    component: EmployeeUserDetailsComponent,
    data: { title: "User Management", details: true, isNew: true}
  },
  {
    path: ':employeeUserCode',
    component: EmployeeUserDetailsComponent,
    data: { title: "Employee User", details: true }
  },
  {
    path: ':employeeUserCode/edit',
    component: EmployeeUserDetailsComponent,
    data: { title: "EmployeeUser", details: true, edit: true }
  },
];

@NgModule({
    declarations: [EmployeeUsersComponent, EmployeeUserDetailsComponent, ChangePasswordComponent],
    imports: [
        CommonModule,
        FlexLayoutModule,
        MaterialModule,
        NgxSkeletonLoaderModule,
        FormsModule,
        ReactiveFormsModule,
        RouterModule.forChild(routes),
        NgFor,
        AsyncPipe,
        SharedComponentsModule
    ]
})
export class EmployeeUserModule { }
