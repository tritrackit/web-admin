import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, tap, catchError, of } from 'rxjs';
import { environment } from 'src/environments/environment';
import { ApiResponse } from '../model/api-response.model';
import { Scanner } from '../model/scanner.model';
import { AppConfigService } from './app-config.service';
import { IServices } from './interface/iservices';

@Injectable({
  providedIn: 'root'
})
export class ScannerService implements IServices {

  constructor(private http: HttpClient, private appconfig: AppConfigService) { }

  getByAdvanceSearch(params:{
    order: any,
    columnDef: { apiNotation: string; filter: any }[],
    pageSize: number,
    pageIndex: number
  }): Observable<ApiResponse<{ results: Scanner[], total: number}>> {
    return this.http.post<any>(environment.apiBaseUrl + "/scanner/page",
      params)
    .pipe(
      tap(_ => this.log('scanner')),
      catchError(this.handleError('scanner', []))
    );
  }


  getByCode(scannerCode: string): Observable<ApiResponse<Scanner>> {
    return this.http.get<any>(environment.apiBaseUrl + "/scanner/" + scannerCode)
    .pipe(
      tap(_ => this.log('scanner')),
      catchError(this.handleError('scanner', []))
    );
  }

  create(data: any): Observable<ApiResponse<Scanner>> {
    return this.http.post<any>(environment.apiBaseUrl + "/scanner/", data)
    .pipe(
      tap(_ => this.log('scanner')),
      catchError(this.handleError('scanner', []))
    );
  }

  update(scannerCode: string, data: any): Observable<ApiResponse<Scanner>> {
    return this.http.put<any>(environment.apiBaseUrl + "/scanner/" + scannerCode, data)
    .pipe(
      tap(_ => this.log('scanner')),
      catchError(this.handleError('scanner', []))
    );
  }

  delete(scannerCode: string): Observable<ApiResponse<Scanner>> {
    return this.http.delete<any>(environment.apiBaseUrl + "/scanner/" + scannerCode)
    .pipe(
      tap(_ => this.log('scanner')),
      catchError(this.handleError('scanner', []))
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
