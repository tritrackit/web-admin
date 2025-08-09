import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { AuthGuard } from './guard/auth.guard';
import { ProfileComponent } from './pages/profile/profile.component';
import { FeaturesComponent } from './pages/features/features.component';
import { AuthComponent } from './auth/auth.component';;
import { PageNotFoundComponent } from './pages/page-not-found/page-not-found.component';
import { NoAccessComponent } from './pages/no-access/no-access.component';

const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  { path: 'auth', pathMatch: 'full', redirectTo: 'auth/login' },
  { path: 'profile', pathMatch: 'full', redirectTo: 'profile/edit' },
  {
    path: '',
    component: FeaturesComponent,
    canActivate: [AuthGuard],
    children: [
      {
        path: 'dashboard',
        canActivate: [AuthGuard],
        data: { title: 'Dashboard' },
        loadChildren: () =>
          import('./pages/features/dashboard/dashboard.module').then(
            (m) => m.DashboardModule
          ),
      },
      // {
      //   path: 'rooms',
      //   canActivate: [AuthGuard],
      //   data: { title: 'Rooms', },
      //   loadChildren: () =>
      //     import('./pages/features/rooms/rooms.module').then(
      //       (m) => m.RoomsModule
      //     ),
      // },
      // {
      //   path: 'rfid',
      //   canActivate: [AuthGuard],
      //   data: { title: 'RFID', },
      //   loadChildren: () =>
      //     import('./pages/features/rfid/rfid.module').then((m) => m.RFIDModule),
      // },
      // {
      //   path: 'maintenance',
      //   canActivate: [AuthGuard],
      //   data: { title: 'Maintenance', },
      //   loadChildren: () =>
      //     import('./pages/features/maintenance/maintenance.module').then((m) => m.MaintenanceModule),
      // },
      {
        path: 'reports',
        canActivate: [AuthGuard],
        data: { title: 'Reports and Statistics', },
        loadChildren: () =>
          import('./pages/features/reports/reports.module').then((m) => m.ReportsModule),
      },
      {
        path: 'roles',
        canActivate: [AuthGuard],
        data: { title: 'Roles', group: 'User Management' },
        loadChildren: () =>
          import('./pages/features/roles/roles.module').then(
            (m) => m.AccessModule
          ),
      },
      {
        path: 'employee-users',
        canActivate: [AuthGuard],
        data: { title: 'Employee Users', group: 'User Management' },
        loadChildren: () =>
          import('./pages/features/employee-users/employee-users.module').then((m) => m.EmployeeUserModule),
      }
    ],
  },
  {
    path: 'profile',
    component: ProfileComponent,
    children: [
      {
        path: 'edit',
        data: { title: 'Edit profile', profile: true },
        loadChildren: () =>
          import('./pages/profile/edit-profile/edit-profile.module').then(
            (m) => m.EditProfileModule
          ),
      },
      {
        path: 'change-password',
        data: { title: 'Change Password', profile: true },
        loadChildren: () =>
          import(
            './pages/profile/change-password/change-password.module'
          ).then((m) => m.ChangePasswordModule),
      },
    ],
  },
  {
    path: 'auth',
    component: AuthComponent,
    children: [
      {
        path: 'login',
        data: { title: 'Login' },
        loadChildren: () =>
          import('./auth/login/login.module').then((m) => m.LoginModule),
      },
    ],
  },
  {
    path: 'no-access',
    component: NoAccessComponent,
  },
  {
    path: '**',
    component: PageNotFoundComponent,
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
