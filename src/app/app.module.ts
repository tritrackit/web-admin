import { BrowserModule } from '@angular/platform-browser';
import { APP_INITIALIZER, NgModule } from '@angular/core';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule, Routes }   from '@angular/router';
import { AppComponent } from './app.component'
import { HTTP_INTERCEPTORS, HttpClientModule } from '@angular/common/http';
import { MaterialModule } from './shared/material/material.module';
import { CommonModule } from '@angular/common';
import { FeaturesComponent } from './pages/features/features.component';
import { ProfileComponent } from './pages/profile/profile.component';
import { AppRoutingModule } from './app-routing.module';
import { AuthComponent } from './auth/auth.component';
import { MAT_SNACK_BAR_DEFAULT_OPTIONS } from '@angular/material/snack-bar';
import { AppConfigService } from './services/app-config.service';
import { PageNotFoundComponent } from './pages/page-not-found/page-not-found.component';
import { NoAccessComponent } from './pages/no-access/no-access.component';
import { DateAdapter, MAT_DATE_FORMATS } from '@angular/material/core';
import { AppDateAdapter } from './shared/utility/app-date-adapter';
import { TimeagoClock, TimeagoFormatter, TimeagoIntl, TimeagoModule } from 'ngx-timeago';
import { Observable, interval } from 'rxjs';
import { FlexLayoutModule } from '@ngbracket/ngx-layout'
import { PusherService } from './services/pusher.service';
import { IdleTimeoutDialogComponent } from './shared/idle-timeout-dialog/idle-timeout-dialog.component';
import { SharedComponentsModule } from './shared/components/shared-components.module';
import { WebcamModule } from 'ngx-webcam';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { AuthService } from './services/auth.service';
import { AuthInterceptor } from './interceptors/auth.interceptors';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';
export class MyClock extends TimeagoClock {
  tick(then: number): Observable<number> {
    return interval(1000);
  }
}

@NgModule({
  declarations: [
    AppComponent,
    FeaturesComponent,
    ProfileComponent,
    AuthComponent,
    PageNotFoundComponent,
    NoAccessComponent,
    IdleTimeoutDialogComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    BrowserAnimationsModule,
    CommonModule,
    FormsModule,
    RouterModule,
    HttpClientModule,
    MaterialModule,
    ReactiveFormsModule,
    FlexLayoutModule,
    SharedComponentsModule,
    DragDropModule,
    WebcamModule,
    TimeagoModule.forRoot({
      formatter: {provide: TimeagoClock, useClass: MyClock },
    })
  ],
  providers: [
    PusherService,
    { provide: MAT_SNACK_BAR_DEFAULT_OPTIONS, useValue: {duration: 2500} },
    {
      provide : APP_INITIALIZER,
      multi : true,
      deps : [AppConfigService],
      useFactory : (config : AppConfigService) =>  () => config.loadConfig()
    },
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthInterceptor,
      multi: true
    },
    {provide: DateAdapter, useClass: AppDateAdapter},
    provideCharts(withDefaultRegisterables()),
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
