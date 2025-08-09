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
export class DashboardService implements IServices {

  constructor(private http: HttpClient, private appconfig: AppConfigService) { }

  getDashboardSummary(employeeUserId?:string): Observable<ApiResponse<{
    totalRooms: number;
    totalMaintenance: number;
    totalUsers: number;
    totalUserAccess: number;
}>> {
    return this.http.get<any>(environment.apiBaseUrl + `/dashboard/getDashboardSummary?${employeeUserId && employeeUserId!== '' ? 'userid=' + employeeUserId : ''}`)
    .pipe(
      tap(_ => this.log('dashboard')),
      catchError(this.handleError('dashboard', []))
    );
  }
  handleError<T>(operation: string, result?: T) {
    return (error: any): Observable<T> => {
      this.log(`${operation} failed: ${Array.isArray(error.error.message) ? error.error.message[0] : error.error.message}`);
      return of(error.error as T);
    };
  }
  log(message: string) {
    console.log(message);
  }
}
