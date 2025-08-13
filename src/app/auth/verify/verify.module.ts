import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { VerifyComponent } from './verify.component';
import { MaterialModule } from 'src/app/shared/material/material.module';
import { Routes, RouterModule } from '@angular/router';
import { FlexLayoutModule } from '@ngbracket/ngx-layout';

export const routes: Routes = [
  {
    path: '',
    component: VerifyComponent,
    pathMatch: 'full'
  }
];

@NgModule({
  declarations: [VerifyComponent],
  imports: [
    CommonModule,
    FlexLayoutModule,
    MaterialModule,
    RouterModule.forChild(routes),
  ]
})
export class VerifyModule { }
