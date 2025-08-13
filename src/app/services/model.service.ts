import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, tap, catchError, of } from 'rxjs';
import { environment } from 'src/environments/environment';
import { ApiResponse } from '../model/api-response.model';
import { Model } from '../model/model.model';
import { AppConfigService } from './app-config.service';
import { IServices } from './interface/iservices';

@Injectable({
  providedIn: 'root'
})
export class ModelService implements IServices {

  constructor(private http: HttpClient, private appconfig: AppConfigService) { }

  getAdvanceSearch(params:{
    order?: string;
    keywords: string,
    pageSize: number,
    pageIndex: number
  }): Observable<ApiResponse<{ results: Model[], total: number}>> {
    return this.http.post<any>(environment.apiBaseUrl + "/model/page",
      params)
    .pipe(
      tap(_ => this.log('model')),
      catchError(this.handleError('model', []))
    );
  }


  getByCode(roleCode: string): Observable<ApiResponse<Model>> {
    return this.http.get<any>(environment.apiBaseUrl + "/model/" + roleCode)
    .pipe(
      tap(_ => this.log('model')),
      catchError(this.handleError('model', []))
    );
  }

  create(data: any): Observable<ApiResponse<Model>> {
    return this.http.post<any>(environment.apiBaseUrl + "/model/", data)
    .pipe(
      tap(_ => this.log('model')),
      catchError(this.handleError('model', []))
    );
  }

  update(roleCode: string, data: any): Observable<ApiResponse<Model>> {
    return this.http.put<any>(environment.apiBaseUrl + "/model/" + roleCode, data)
    .pipe(
      tap(_ => this.log('model')),
      catchError(this.handleError('model', []))
    );
  }

  updateOrder(data: any[]): Observable<ApiResponse<Model>> {
    return this.http.put<any>(environment.apiBaseUrl + "/model/updateOrder", data)
    .pipe(
      tap(_ => this.log('model')),
      catchError(this.handleError('model', []))
    );
  }

  delete(roleCode: string): Observable<ApiResponse<Model>> {
    return this.http.delete<any>(environment.apiBaseUrl + "/model/" + roleCode)
    .pipe(
      tap(_ => this.log('model')),
      catchError(this.handleError('model', []))
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
