import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';

import { catchError, tap } from 'rxjs/operators';
import { IServices } from './interface/iservices';
import { AppConfigService } from './app-config.service';
import { Router } from '@angular/router';
import { environment } from 'src/environments/environment';
import { StorageService } from './storage.service';
import { ApiResponse } from '../model/api-response.model';
import { EmployeeUsers } from '../model/employee-users.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService implements IServices {

  isLoggedIn = false;
  redirectUrl: string;

  constructor(
    private http: HttpClient,
    private router: Router,
    private storageService: StorageService,
    private appconfig: AppConfigService) { }

  login(data: any): Observable<ApiResponse<EmployeeUsers>> {
    return this.http.post<any>(environment.apiBaseUrl + "/auth/login/", data)
    .pipe(
      tap(_ => this.isLoggedIn = true),
      catchError(this.handleError('login', []))
    );
  }

  logout(): Observable<any> {
    this.storageService.saveAccessToken(null);
    this.storageService.saveRefreshToken(null);
    this.storageService.saveSessionExpiredDate(null);
    this.storageService.saveLoginProfile(null);
    this.router.navigate(['/auth/login'], { replaceUrl: true });

    return this.http.get<any>(environment.apiBaseUrl + "/auth/logout")
    .pipe(
      tap(_ => this.isLoggedIn = false),
      catchError(this.handleError('logout', []))
    );
  }

  refreshToken(data: any): Observable<any> {
    return this.http.post<any>(environment.apiBaseUrl + "/auth/refresh-token/", data)
    .pipe(
      tap(_ => this.log('refresh token')),
      catchError(this.handleError('refresh token', []))
    );
  }

  verify(data: any): Observable<ApiResponse<EmployeeUsers>> {
    return this.http.post<any>(environment.apiBaseUrl + "/auth/verify/", data)
    .pipe(
      tap(_ => this.log('verify')),
      catchError(this.handleError('verify', []))
    );
  }

  redirectToPage(auth: boolean) {
    this.router.navigate([auth ? 'auth' : '/'], { replaceUrl: true });
  }

  handleError<T>(operation = 'operation', result?: T) {
    return (error: any): Observable<T> => {
      this.log(`${operation} failed: ${Array.isArray(error.error.message) ? error.error.message[0] : error.error.message}`);
      return of(error.error as T);
    };
  }

  log(message: string) {
    console.log(message);
  }
}
