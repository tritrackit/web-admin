import { Injectable } from '@angular/core';
import { Roles } from '../model/roles.model';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, of } from 'rxjs';
import { environment } from 'src/environments/environment';
import { ApiResponse } from '../model/api-response.model';
import { AppConfigService } from './app-config.service';
import { IServices } from './interface/iservices';

@Injectable({
  providedIn: 'root'
})
export class RoleService implements IServices {

  constructor(private http: HttpClient, private appconfig: AppConfigService) { }

  getByAdvanceSearch(params:{
    order: any,
    columnDef: { apiNotation: string; filter: any }[],
    pageSize: number,
    pageIndex: number
  }): Observable<ApiResponse<{ results: Roles[], total: number}>> {
    return this.http.post<any>(environment.apiBaseUrl + "/roles/page",
      params)
    .pipe(
      tap(_ => this.log('roles')),
      catchError(this.handleError('roles', []))
    );
  }


  getByCode(roleCode: string): Observable<ApiResponse<Roles>> {
    return this.http.get<any>(environment.apiBaseUrl + "/roles/" + roleCode)
    .pipe(
      tap(_ => this.log('roles')),
      catchError(this.handleError('roles', []))
    );
  }

  create(data: any): Observable<ApiResponse<Roles>> {
    return this.http.post<any>(environment.apiBaseUrl + "/roles/", data)
    .pipe(
      tap(_ => this.log('roles')),
      catchError(this.handleError('roles', []))
    );
  }

  update(roleCode: string, data: any): Observable<ApiResponse<Roles>> {
    return this.http.put<any>(environment.apiBaseUrl + "/roles/" + roleCode, data)
    .pipe(
      tap(_ => this.log('roles')),
      catchError(this.handleError('roles', []))
    );
  }

  delete(roleCode: string): Observable<ApiResponse<Roles>> {
    return this.http.delete<any>(environment.apiBaseUrl + "/roles/" + roleCode)
    .pipe(
      tap(_ => this.log('roles')),
      catchError(this.handleError('roles', []))
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
