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

  private lastProcessedRfid: {rfid: string, time: number} = {rfid: '', time: 0};
  
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
      
      console.log(`🔍 UnitService: Event received`, {
        type: event.type,
        priority: priority,
        action: data?.action,
        rfid: data?.rfid,
        hasInstant: data?._instantPopup,
        currentDataValue: this.data.value?.rfid,
        lastProcessedRfid: this.lastProcessedRfid.rfid,
        timeSinceLastProcessed: this.lastProcessedRfid.rfid ? Date.now() - this.lastProcessedRfid.time : 'N/A'
      });
     
      if (priority === 'highest' || data?._instantPopup || data?.action === 'RFID_DETECTED_URGENT' || data?.action === 'RFID_DETECTED') {
        const now = Date.now();
        const sentAt = data._sentAt || data.timestamp;
        const latency = sentAt ? now - sentAt : data._latency || 0;
        
        const timeSinceLast = this.lastProcessedRfid.rfid ? now - this.lastProcessedRfid.time : Infinity;
        const isDuplicate = data.rfid && this.lastProcessedRfid.rfid === data.rfid && timeSinceLast < 1000;
        
        console.log(`🔍 UnitService: Duplicate check`, {
          currentRfid: data.rfid,
          lastProcessedRfid: this.lastProcessedRfid.rfid,
          timeSinceLast: timeSinceLast,
          isDuplicate: isDuplicate,
          willProcess: !isDuplicate
        });
        
        if (isDuplicate) {
          console.log(`⏭️ UnitService: Skipping duplicate RFID: ${data.rfid} (${timeSinceLast}ms ago)`);
          return;
        }
        
        this.eventHistory.push({rfid: data.rfid, time: now, action: 'PROCESSING'});
        if (this.eventHistory.length > 10) {
          this.eventHistory.shift(); 
        }
        
        this.lastProcessedRfid = {rfid: data.rfid, time: now};
        
        console.log(`🎯 INSTANT CBU TRIGGER: ${latency}ms - ${data.rfid}`, {
          scannerCode: data.scannerCode,
          locationId: data.locationId,
          location: data.location,
          currentDataState: this.data.value ? 'HAS_DATA' : 'EMPTY',
          willEmit: true
        });
        
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
          
          console.log(`🔍 UnitService: Emitting to data$`, {
            rfid: eventData.rfid,
            _handled: eventData._handled,
            subscribers: 'unknown'
          });
          
          this.data.next(eventData);
          console.log(`🔍 UnitService: Data$ after emit`, {
            hasValue: !!this.data.value,
            rfid: this.data.value?.rfid,
            _handled: this.data.value?._handled
          });
        });
        
        return;
      }
      if (event.type === 'units' && !data?.rfid) {
        this.zone.run(() => {
          this.refreshSubject.next();
        });
      }
    });
  }
  
  public openCbuInstantly(rfidData: any): void {
    console.log('🚀 Opening CBU instantly for:', rfidData.rfid);
    
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
    console.log(`🔍 UnitService.clearScannedData() called`, {
      beforeClear: {
        hasValue: !!this.data.value,
        rfid: this.data.value?.rfid,
        _handled: this.data.value?._handled
      },
      lastProcessedRfid: this.lastProcessedRfid.rfid,
      eventHistory: this.eventHistory.length
    });
    
    // ⚡ Clear the data stream
    this.data.next(null);
    
    // ⚡ Reset duplicate prevention after 3 seconds (allow new scans)
    setTimeout(() => {
      const oldRfid = this.lastProcessedRfid.rfid;
      this.lastProcessedRfid = {rfid: '', time: 0};
      console.log(`🔍 UnitService: Reset lastProcessedRfid (was: ${oldRfid})`);
    }, 3000);
    
    console.log(`🔍 UnitService.clearScannedData() completed`, {
      afterClear: {
        hasValue: !!this.data.value,
        rfid: this.data.value?.rfid
      }
    });
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
    console.log(message);
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
    console.log(`🔍 UnitService: FORCE RESET called`, {
      beforeReset: this.getDebugState()
    });
    
    this.data.next(null);
    this.lastProcessedRfid = {rfid: '', time: 0};
    this.eventHistory = [];
    
    console.log(`🔍 UnitService: FORCE RESET completed`, {
      afterReset: this.getDebugState()
    });
  }
}