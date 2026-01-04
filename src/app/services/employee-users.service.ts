import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, tap, catchError, of } from 'rxjs';
import { environment } from 'src/environments/environment';
import { ApiResponse } from '../model/api-response.model';
import { AppConfigService } from './app-config.service';
import { IServices } from './interface/iservices';
import { EmployeeUsers } from '../model/employee-users.model';

@Injectable({
  providedIn: 'root'
})
export class EmployeeUsersService implements IServices {

  constructor(private http: HttpClient, private appconfig: AppConfigService) { }

  getAdvanceSearch(params:{
    order: any,
    columnDef: { apiNotation: string; filter: string }[],
    pageSize: number,
    pageIndex: number
  }): Observable<ApiResponse<{ results: EmployeeUsers[], total: number}>> {
    return this.http.post<any>(environment.apiBaseUrl + "/employee-users/page",
      params)
    .pipe(
      tap(_ => this.log('employee-users')),
      catchError(this.handleError('employee-users', []))
    );
  }

  getByCode(employeeUserCode: string): Observable<ApiResponse<EmployeeUsers>> {
    return this.http.get<any>(environment.apiBaseUrl +  "/employee-users/" + employeeUserCode)
    .pipe(
      tap(_ => this.log('employee-users')),
      catchError(this.handleError('employee-users', []))
    );
  }

  createUser(data: any): Observable<ApiResponse<EmployeeUsers>> {
    return this.http.post<any>(environment.apiBaseUrl + "/employee-users/", data)
    .pipe(
      tap(_ => this.log('employee-users')),
      catchError(this.handleError('employee-users', []))
    );
  }

  updateProfile(data: any): Observable<ApiResponse<EmployeeUsers>> {
    return this.http.put<any>(environment.apiBaseUrl + "/employee-users/updateProfile", data)
    .pipe(
      tap(_ => this.log('employee-users')),
      catchError(this.handleError('employee-users', []))
    );
  }

  updateUser(id: string, data: any): Observable<ApiResponse<EmployeeUsers>> {
    return this.http.put<any>(environment.apiBaseUrl + "/employee-users/" + id, data)
    .pipe(
      tap(_ => this.log('employee-users')),
      catchError(this.handleError('employee-users', []))
    );
  }

  updateUserPassword(employeeUserCode: string, data: any): Observable<ApiResponse<EmployeeUsers>> {
    return this.http.put<any>(environment.apiBaseUrl + "/employee-users/updateUserPassword/" + employeeUserCode , data)
    .pipe(
      tap(_ => this.log('employee-users')),
      catchError(this.handleError('employee-users', []))
    );
  }

  updatePassword(employeeUserCode: string, data: any): Observable<ApiResponse<EmployeeUsers>> {
    return this.http.put<any>(environment.apiBaseUrl + "/employee-users/update-password/" + employeeUserCode , data)
    .pipe(
      tap(_ => this.log('employee-users')),
      catchError(this.handleError('employee-users', []))
    );
  }

  delete(employeeUserCode): Observable<ApiResponse<EmployeeUsers>> {
    return this.http.delete<any>(environment.apiBaseUrl +  "/employee-users/" + employeeUserCode)
    .pipe(
      tap(_ => this.log('employee-users')),
      catchError(this.handleError('employee-users', []))
    );
  }

  handleError<T>(operation = 'operation', result?: T) {
    return (error: any): Observable<T> => {
      this.log(`${operation} failed: ${Array.isArray(error.error.message) ? error.error.message[0] : error.error.message}`);
      return of(error.error as T);
    };
  }

  log(message: string) {
  }
}
