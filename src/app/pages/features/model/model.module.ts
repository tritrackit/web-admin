import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModelComponent } from './model.component';
import { ModelDetailsComponent } from './model-details/model-details.component';
import { ModelFormComponent } from './model-form/model-form.component';
import { RouterModule, Routes } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { FlexLayoutModule } from '@ngbracket/ngx-layout';
import { NgxSkeletonLoaderModule } from 'ngx-skeleton-loader';
import { SharedComponentsModule } from 'src/app/shared/components/shared-components.module';
import { MaterialModule } from 'src/app/shared/material/material.module';


export const routes: Routes = [
  {
    path: '',
    component: ModelComponent,
    pathMatch: 'full',
    data: { title: "Model" }
  },
  {
    path: 'add',
    component: ModelDetailsComponent,
    data: { title: "New Model", details: true, isNew: true }
  },
  {
    path: ':modelId',
    component: ModelDetailsComponent,
    data: { title: "Model", details: true }
  },
  {
    path: ':modelId/edit',
    component: ModelDetailsComponent,
    data: { title: "Model", details: true, edit: true }
  },
];


@NgModule({
  declarations: [
    ModelComponent,
    ModelDetailsComponent,
    ModelFormComponent
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
export class ModelModule { }
