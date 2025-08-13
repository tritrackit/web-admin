import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, tap, catchError, of } from 'rxjs';
import { environment } from 'src/environments/environment';
import { ApiResponse } from '../model/api-response.model';
import { Units } from '../model/units.model';
import { AppConfigService } from './app-config.service';
import { IServices } from './interface/iservices';

@Injectable({
  providedIn: 'root'
})
export class UnitService implements IServices {

  constructor(private http: HttpClient, private appconfig: AppConfigService) { }

  getByAdvanceSearch(params:{
    order: any,
    columnDef: { apiNotation: string; filter: any }[],
    pageSize: number,
    pageIndex: number
  }): Observable<ApiResponse<{ results: Units[], total: number}>> {
    return this.http.post<any>(environment.apiBaseUrl + "/units/page",
      params)
    .pipe(
      tap(_ => this.log('units')),
      catchError(this.handleError('units', []))
    );
  }


  getByCode(roleCode: string): Observable<ApiResponse<Units>> {
    return this.http.get<any>(environment.apiBaseUrl + "/units/" + roleCode)
    .pipe(
      tap(_ => this.log('units')),
      catchError(this.handleError('units', []))
    );
  }

  create(data: any): Observable<ApiResponse<Units>> {
    return this.http.post<any>(environment.apiBaseUrl + "/units/", data)
    .pipe(
      tap(_ => this.log('units')),
      catchError(this.handleError('units', []))
    );
  }

  update(roleCode: string, data: any): Observable<ApiResponse<Units>> {
    return this.http.put<any>(environment.apiBaseUrl + "/units/" + roleCode, data)
    .pipe(
      tap(_ => this.log('units')),
      catchError(this.handleError('units', []))
    );
  }

  delete(roleCode: string): Observable<ApiResponse<Units>> {
    return this.http.delete<any>(environment.apiBaseUrl + "/units/" + roleCode)
    .pipe(
      tap(_ => this.log('units')),
      catchError(this.handleError('units', []))
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
