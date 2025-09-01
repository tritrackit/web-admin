import { HttpClient } from '@angular/common/http';
import { Injectable, NgZone } from '@angular/core';
import { Observable, tap, catchError, of, BehaviorSubject } from 'rxjs';
import { environment } from 'src/environments/environment';
import { ApiResponse } from '../model/api-response.model';
import { Units } from '../model/units.model';
import { AppConfigService } from './app-config.service';
import { IServices } from './interface/iservices';
import { PusherService } from './pusher.service';
import { StorageService } from './storage.service';
import { EmployeeUsers } from '../model/employee-users.model';
import { Locations } from '../model/locations.model';

@Injectable({
  providedIn: 'root'
})
export class UnitService implements IServices {
  currentUserProfile: EmployeeUsers = this.storageService.getLoginProfile();
  currentChannel: any;

  private data = new BehaviorSubject<{
    rfid: string;
    scannerCode: string;
    employeeUser: EmployeeUsers;
    location: Locations;
    timestamp: Date;
  }>(null);
  data$ = this.data.asObservable();
  constructor(private http: HttpClient, private appconfig: AppConfigService,
    private zone: NgZone,
    private storageService: StorageService,
    private pusher: PusherService,
  ) {


    this.currentUserProfile = this.storageService.getLoginProfile();
    this.currentChannel = this.pusher.init(`scanner-${this.currentUserProfile?.employeeUserCode}`);

    this.currentChannel.bind('scanner', data => {
      console.log('pusher received data', data.data);
      this.zone.run(() => this.data.next(data?.data));
    });
    // this.currentChannel.bind('pusher:subscription_succeeded', () => {
    //   this.currentChannel.bind('scanner', data => {
    //     console.log('pusher received data', data.data);
    //     this.zone.run(() => this.data.next(data?.data));
    //   });
    // });
  }

  clearScannedData() {
    this.data.next(null);
  }
  getByAdvanceSearch(params: {
    order: any,
    columnDef: { apiNotation: string; filter: any }[],
    pageSize: number,
    pageIndex: number
  }): Observable<ApiResponse<{ results: Units[], total: number }>> {
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
