import { HttpClient } from '@angular/common/http';
import { Injectable, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap, catchError, of, BehaviorSubject, Subject } from 'rxjs';
import { environment } from 'src/environments/environment';
import { ApiResponse } from '../model/api-response.model';
import { Units } from '../model/units.model';
import { UnitLogs } from '../model/unit-logs.model';
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
  

  private refreshSubject = new BehaviorSubject<void>(null);
  refresh$ = this.refreshSubject.asObservable();

  private data = new BehaviorSubject<{
    rfid: string;
    scannerCode: string;
    employeeUser?: EmployeeUsers;
    location: Locations;
    timestamp: Date;
    _instant?: boolean;
    _popupNow?: boolean;
    _latency?: number;
    _urgent?: boolean;
    _handled?: boolean;
  }>(null);
  data$ = this.data.asObservable();

  private lastProcessedRfid: {rfid: string, time: number, action?: string, _sentAt?: number} = {rfid: '', time: 0};
  private lastLocationUpdate: {rfid: string, locationId: string, time: number, _sentAt?: number} = {rfid: '', locationId: '', time: 0};
  private eventHistory: Array<{rfid: string, time: number, action: string}> = [];
  
  constructor(
    private http: HttpClient, 
    private appconfig: AppConfigService,
    private zone: NgZone,
    private storageService: StorageService,
    private pusher: PusherService,
    private router: Router
  ) {
    this.currentUserProfile = this.storageService.getLoginProfile();
    
    if (!this.pusher) throw new Error('Pusher not initialized');
    this.pusher.onUpdate.subscribe((event: any) => {
      const data = event.data;
      const priority = event._priority;
      
      // Check if this is a location update FIRST (before any other processing)
      const isLocationUpdate = data?.action === 'LOCATION_UPDATED' || 
                              data?.action === 'ENTERED_WAREHOUSE_5' || 
                              data?.action === 'EXITED_WAREHOUSE_5' ||
                              data?._autoRefresh === true;
      
      // Location updates should ALWAYS trigger table refresh, never popup
      if (isLocationUpdate) {
        const now = Date.now();
        const sentAt = data._sentAt || (data.timestamp instanceof Date ? data.timestamp.getTime() : new Date(data.timestamp || Date.now()).getTime());
        const locationId = data.locationId || data.location?.locationId || '';
        const rfid = data.rfid || '';
        
        // 🔥 PREVENT DUPLICATES: Same RFID + same location + same _sentAt within 5 seconds
        // This prevents the same location update from triggering refresh twice
        // (e.g., when it comes through both Socket.io and Pusher fallback)
        if (rfid && locationId) {
          const isSameSentAt = this.lastLocationUpdate._sentAt && sentAt && this.lastLocationUpdate._sentAt === sentAt;
          const isSameUpdate = this.lastLocationUpdate.rfid === rfid && 
                              this.lastLocationUpdate.locationId === locationId &&
                              (isSameSentAt || (now - this.lastLocationUpdate.time) < 5000);
          
          if (isSameUpdate) {
            // Duplicate location update - ignore (already processed)
            return;
          }
          
          // Track this location update to prevent duplicates
          this.lastLocationUpdate = {
            rfid: rfid,
            locationId: locationId,
            time: now,
            _sentAt: sentAt
          };
        }
        
        // Trigger refresh ONCE per unique location update
        this.zone.run(() => {
          this.refreshSubject.next();
        });
        return; // Exit early - don't process as registration event
      }
      
      if (priority === 'highest' || data?._instantPopup || data?.action === 'RFID_DETECTED_URGENT' || data?.action === 'RFID_DETECTED') {
        
        const now = Date.now();
        const sentAt = data._sentAt || (data.timestamp instanceof Date ? data.timestamp.getTime() : new Date(data.timestamp || Date.now()).getTime());
        const latency = sentAt ? now - sentAt : data._latency || 0;
        
        const action = data.action || 'RFID_DETECTED';
        
        // Only apply strict duplicate prevention for REGISTRATION events
        // Location updates (LOCATION_UPDATED, etc.) should work normally
        const isRegistrationEvent = action === 'RFID_DETECTED' || 
                                   action === 'RFID_DETECTED_URGENT' ||
                                   action === 'UNIT_REGISTERING_PREDICTIVE' ||
                                   action === 'UNIT_REGISTERED_CONFIRMED';
        
        if (isRegistrationEvent) {
          const timeSinceLast = this.lastProcessedRfid.rfid ? now - this.lastProcessedRfid.time : Infinity;
          const isSameAction = this.lastProcessedRfid.action === action;
          const isSameSentAt = this.lastProcessedRfid._sentAt && sentAt && this.lastProcessedRfid._sentAt === sentAt;
          
          // Prevent duplicates for registration: same RFID + (same action OR same _sentAt) within 10 seconds
          // This catches: same scan event, predictive + confirmed notifications from backend
          const isDuplicate = data.rfid && 
                             this.lastProcessedRfid.rfid === data.rfid && 
                             (isSameAction || isSameSentAt) &&
                             timeSinceLast < 10000;
          
          if (isDuplicate) {
            return;
          }
          
          this.lastProcessedRfid = {rfid: data.rfid, time: now, action: action, _sentAt: sentAt};
        }
        
        this.eventHistory.push({rfid: data.rfid, time: now, action: action});
        if (this.eventHistory.length > 10) {
          this.eventHistory.shift(); 
        }
        
        this.zone.run(() => {
          const eventData = {
            rfid: data.rfid,
            scannerCode: data.scannerCode,
            location: data.locationId ? {
              locationId: data.locationId,
              name: data.location || 'Open Area'
            } as any : { locationId: 'OPEN_AREA', name: 'Open Area' },
            timestamp: new Date(),
            _instant: true,
            _latency: latency,
            _popupNow: true, 
            _urgent: true,
            _handled: false 
          };
          
          this.data.next(eventData);
        });
        
        return;
      }
      // Trigger refresh for unit updates (non-RFID events or already processed location updates)
      if (event.type === 'units') {
        this.zone.run(() => {
          this.refreshSubject.next();
        });
      }
    });
  }
  
  public openCbuInstantly(rfidData: any): void {
    this.zone.run(() => {
      this.data.next({
        rfid: rfidData.rfid,
        scannerCode: rfidData.scannerCode,
        location: rfidData.location || { locationId: 'OPEN_AREA', name: 'Open Area' } as Locations,
        timestamp: new Date(),
        _instant: true
      });
    });
    
    this.router.navigate(['/cbu/add'], {
      queryParams: {
        rfid: rfidData.rfid,
        scannerCode: rfidData.scannerCode,
        locationId: rfidData.location?.locationId || 'OPEN_AREA',
        location: rfidData.location?.name || 'Open Area',
        instant: 'true'
      }
    });
  }

  refreshUnits() {
    this.refreshSubject.next(null);
  }

  clearScannedData() {
    // ⚡ Clear the data stream
    this.data.next(null);
    
    // ⚡ Reset duplicate prevention after 10 seconds (allow new scans)
    // Keep the window long enough to prevent duplicates from same scan event
    setTimeout(() => {
      this.lastProcessedRfid = {rfid: '', time: 0};
    }, 10000);
  }
  
  getByAdvanceSearch(params: {
    order: any,
    columnDef: { apiNotation: string; filter: any }[],
    pageSize: number,
    pageIndex: number
  }): Observable<ApiResponse<{ results: Units[], total: number }>> {
    return this.http.post<any>(environment.apiBaseUrl + "/units/page", params)
      .pipe(
        tap(_ => this.log('units')),
        catchError(this.handleError('units', []))
      );
  }

  // 🔥 ULTRA-FAST REGISTRATION
  registerViaScanner(data: {
    scannerCode: string;
    rfid: string;
    chassisNo: string;
    color: string;
    description: string;
    modelId: string;
  }): Observable<ApiResponse<Units>> {
    // Send to backend
    return this.http.post<ApiResponse<Units>>(
      `${environment.apiBaseUrl}/units/register`,
      data
    ).pipe(
      tap(response => {
        if (response.success) {
          // Trigger refresh
          this.refreshSubject.next();
        }
      }),
      catchError(error => {
        return this.handleError('register unit via scanner', { success: false, message: error.message, data: null } as ApiResponse<Units>)(error);
      })
    );
  }

  // 🔥 ULTRA-FAST LOCATION UPDATE
  scanLocation(data: {
    scannerCode: string;
    rfid: string;
  }): Observable<ApiResponse<any>> {
    // Send to backend
    return this.http.post<ApiResponse<any>>(
      `${environment.apiBaseUrl}/units/scan-location`,
      data
    ).pipe(
      tap(response => {
        if (response.success) {
          // Trigger refresh
          this.refreshSubject.next();
        }
      }),
      catchError(this.handleError('scan location', { success: false, message: 'Error scanning location', data: null } as ApiResponse<any>))
    );
  }

  getByCode(roleCode: string): Observable<ApiResponse<Units>> {
    return this.http.get<any>(environment.apiBaseUrl + "/units/" + roleCode)
      .pipe(
        tap(_ => this.log('units')),
        catchError(this.handleError('units', []))
      );
  }

  getActivityHistory(unitCode: string, pageIndex: number = 0, pageSize: number = 50): Observable<ApiResponse<{ results: UnitLogs[], total: number }>> {
    const params = new URLSearchParams();
    params.append('pageIndex', pageIndex.toString());
    params.append('pageSize', pageSize.toString());
    
    return this.http.get<any>(`${environment.apiBaseUrl}/units/${unitCode}/activity-history?${params.toString()}`)
      .pipe(
        tap(_ => this.log('unit activity history')),
        catchError(this.handleError('unit activity history', []))
      );
  }

  create(data: any): Observable<ApiResponse<Units>> {
    return this.http.post<any>(environment.apiBaseUrl + "/units/", data)
      .pipe(
        tap(_ => {
          this.log('units');
          this.refreshUnits();
        }),
        catchError(this.handleError('units', []))
      );
  }

  update(roleCode: string, data: any): Observable<ApiResponse<Units>> {
    return this.http.put<any>(environment.apiBaseUrl + "/units/" + roleCode, data)
      .pipe(
        tap(response => {
          this.log('units');
          if (response.success) {
            this.refreshUnits();
          }
        }),
        catchError(this.handleError('units', []))
      );
  }

  delete(roleCode: string): Observable<ApiResponse<Units>> {
    return this.http.delete<any>(environment.apiBaseUrl + "/units/" + roleCode)
      .pipe(
        tap(_ => {
          this.log('units');
          this.refreshUnits();
        }),
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
    // Logging removed for production
  }
  
  getDebugState() {
    return {
      currentData: this.data.value,
      lastProcessedRfid: this.lastProcessedRfid,
      eventHistory: this.eventHistory,
      hasSubscribers: 'unknown' 
    };
  }
  
  forceReset() {
    this.data.next(null);
    this.lastProcessedRfid = {rfid: '', time: 0};
    this.eventHistory = [];
  }
}