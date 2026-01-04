import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, tap, catchError, of } from 'rxjs';
import { environment } from 'src/environments/environment';
import { ApiResponse } from '../model/api-response.model';
import { AppConfigService } from './app-config.service';
import { IServices } from './interface/iservices';
import { Locations } from '../model/locations.model';

@Injectable({
  providedIn: 'root'
})
export class LocationsService implements IServices {

  constructor(private http: HttpClient, private appconfig: AppConfigService) { }

  getAdvanceSearch(params:{
    order: any,
    columnDef: { apiNotation: string; filter: string }[],
    pageSize: number,
    pageIndex: number
  }): Observable<ApiResponse<{ results: Locations[], total: number}>> {
    return this.http.post<any>(environment.apiBaseUrl + "/locations/page",
      params)
    .pipe(
      tap(_ => this.log('locations')),
      catchError(this.handleError('locations', []))
    );
  }

  getByCode(locationCode: string): Observable<ApiResponse<Locations>> {
    return this.http.get<any>(environment.apiBaseUrl + "/locations/" + locationCode)
    .pipe(
      tap(_ => this.log('locations')),
      catchError(this.handleError('locations', []))
    );
  }

  create(data: any): Observable<ApiResponse<Locations>> {
    return this.http.post<any>(environment.apiBaseUrl + "/locations/", data)
    .pipe(
      tap(_ => this.log('locations')),
      catchError(this.handleError('locations', []))
    );
  }

  update(locationCode: string, data: any): Observable<ApiResponse<Locations>> {
    return this.http.put<any>(environment.apiBaseUrl + "/locations/" + locationCode, data)
    .pipe(
      tap(_ => this.log('locations')),
      catchError(this.handleError('locations', []))
    );
  }

  delete(locationCode: string): Observable<ApiResponse<Locations>> {
    return this.http.delete<any>(environment.apiBaseUrl + "/locations/" + locationCode)
    .pipe(
      tap(_ => this.log('locations')),
      catchError(this.handleError('locations', []))
    );
  }

  handleError<T>(operation: string, result?: T) {
    return (error: any): Observable<T> => {
      this.log(`${operation} failed: ${Array.isArray(error.error.message) ? error.error.message[0] : error.error.message}`);
      return of(error.error as T);
    };
  }
  log(message: string) {
  }
}
