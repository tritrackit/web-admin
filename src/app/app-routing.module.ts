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
      {
        path: 'unit-tracker',
        canActivate: [AuthGuard],
        data: { title: 'Unit Tracker' },
        loadChildren: () =>
          import('./pages/features/unit-tracker/unit-tracker.module').then(
            (m) => m.UnitTrackerModule
          ),
      },
      {
        path: 'model',
        canActivate: [AuthGuard],
        data: { title: 'Model', group: 'Configuration' },
        loadChildren: () =>
          import('./pages/features/model/model.module').then(
            (m) => m.ModelModule
          ),
      },
      {
        path: 'locations',
        canActivate: [AuthGuard],
        data: { title: 'Locations', group: 'Configuration' },
        loadChildren: () =>
          import('./pages/features/locations/locations.module').then((m) => m.LocationsModule),
      },
      {
        path: 'scanner',
        canActivate: [AuthGuard],
        data: { title: 'RFID Scanner', group: 'Configuration' },
        loadChildren: () =>
          import('./pages/features/scanner/scanner.module').then((m) => m.ScannerModule),
      },
      {
        path: 'cbu',
        canActivate: [AuthGuard],
        data: { title: 'CBU', group: 'Configuration' },
        loadChildren: () =>
          import('./pages/features/cbu/cbu.module').then((m) => m.CbuModule),
      },
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
      {
        path: 'verify',
        data: { title: 'Verify' },
        loadChildren: () =>
          import('./auth/verify/verify.module').then((m) => m.VerifyModule),
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
