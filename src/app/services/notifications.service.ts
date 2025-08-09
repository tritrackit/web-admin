import { Notifications } from 'src/app/model/notifications.model';
import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, tap, catchError, of } from 'rxjs';
import { environment } from 'src/environments/environment';
import { ApiResponse } from '../model/api-response.model';
import { AppConfigService } from './app-config.service';
import { IServices } from './interface/iservices';

@Injectable({
  providedIn: 'root'
})
export class NotificationsService implements IServices {

  constructor(private http: HttpClient, private appconfig: AppConfigService) { }

  getUnreadByUser(employeeUserCode: string): Observable<ApiResponse<any>> {
    return this.http.get<any>(environment.apiBaseUrl + "/notifications/getUnreadByUser/" + employeeUserCode)
    .pipe(
      tap(_ => this.log('notifications')),
      catchError(this.handleError('notifications', []))
    );
  }

  getByAdvanceSearch(params:{
    order: any,
    columnDef: { apiNotation: string; filter: string }[],
    pageSize: number,
    pageIndex: number
  }): Observable<ApiResponse<{ results: Notifications[], total: number}>> {
    return this.http.post<any>(environment.apiBaseUrl + "/notifications/page/",
      params)
    .pipe(
      tap(_ => this.log('notifications')),
      catchError(this.handleError('notifications', []))
    );
  }

  marAsRead(notificationId) {
    return this.http.put<any>(environment.apiBaseUrl + "/notifications/marAsRead/" + notificationId, {})
    .pipe(
      tap(_ => this.log('notifications')),
      catchError(this.handleError('notifications', []))
    );
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
