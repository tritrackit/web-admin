import { HttpClient } from '@angular/common/http';
import { Injectable, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap, catchError, of, BehaviorSubject } from 'rxjs';
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
  
  // Add refresh observable
  private refreshSubject = new BehaviorSubject<void>(null);
  refresh$ = this.refreshSubject.asObservable();

  private data = new BehaviorSubject<{
    rfid: string;
    scannerCode: string;
    employeeUser: EmployeeUsers;
    location: Locations;
    timestamp: Date;
  }>(null);
  data$ = this.data.asObservable();
  
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
    
    // Unsubscribe previous if any
    if (this.currentChannel) {
      this.currentChannel.unbind_all();
      this.pusher.unsubscribe(this.currentChannel.name);
    }
    
    this.currentChannel = this.pusher.init(`scanner-${this.currentUserProfile?.employeeUserCode}`);

    this.currentChannel.bind('scanner', data => {
      console.log('pusher received data', data.data);
      this.zone.run(() => this.data.next(data?.data));
    });
    
    // 🔥 CRITICAL: Listen for global unit updates
    this.setupGlobalUpdateListener();
  }

  // Add method to trigger refresh
  refreshUnits() {
    this.refreshSubject.next(null);
  }

  // Method to setup global update listener
  private setupGlobalUpdateListener() {
    // Listen to PusherService onUpdate events
    // Backend sends reSync events via PusherService which emits onUpdate
    try {
      this.pusher.onUpdate.subscribe((payload: any) => {
        const receiveTime = Date.now();
        console.log(`📡 UnitService: Pusher update received at ${receiveTime}`, payload);
        
        if (payload && payload.type === 'units') {
          const data = payload.data;
          
          // Log channel source and latency
          const sentAt = data?._sentAt || data?._pusherSentAt;
          const latency = sentAt ? receiveTime - sentAt : data?._latency || 0;
          const channel = data?._channel || 'unknown';
          
          if (sentAt || data?._latency) {
            console.log(`⚡ Channel: ${channel}, Latency: ${latency}ms, Action: ${data?.action || 'unknown'}`);
            
            if (latency > 200 && data?.action !== 'BATCH_UPDATE') {
              console.warn(`⚠️ High Pusher latency: ${latency}ms for action: ${data?.action}`);
            }
          }
          
          // ⚡ STEP 1: Handle URGENT RFID events FIRST (HIGHEST PRIORITY)
          if (data?.action === 'RFID_DETECTED_URGENT') {
            console.log(`⚡ UnitService: URGENT RFID event received (HIGHEST PRIORITY, ${latency}ms)`, data);
            this.zone.run(() => {
              // Clear any previous data first
              this.data.next(null);
              
              // Emit via data$ observable so CBU component can handle registration immediately
              // Using type assertions since we only need partial data for registration flow
              this.data.next({
                rfid: data.rfid,
                scannerCode: data.scannerCode,
                employeeUser: data.employeeUserCode ? { 
                  employeeUserCode: data.employeeUserCode 
                } as any : null,
                location: data.locationId ? { 
                  locationId: data.locationId, 
                  name: data.location 
                } as any : null,
                timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
                _urgent: true,
                _latency: latency
              } as any);
            });
            return; // ⚡ EXIT EARLY - urgent events take precedence
          }
          
          // Handle BATCH_UPDATE - backend batches multiple updates together
          if (data?.action === 'BATCH_UPDATE' && data?.updates && Array.isArray(data.updates)) {
            console.log(`📡 UnitService: BATCH_UPDATE received with ${data.count} updates`, data);
            // Process each update in the batch
            const hasRfidDetected = data.updates.some((u: any) => u.action === 'RFID_DETECTED' || u.action === 'RFID_DETECTED_URGENT');
            const hasLocationUpdate = data.updates.some((u: any) => 
              u.action === 'LOCATION_UPDATED' || 
              u.action === 'ENTERED_WAREHOUSE_5' || 
              u.action === 'EXITED_WAREHOUSE_5' ||
              u.action === 'UNIT_UPDATED'
            );
            
            // If batch contains RFID_DETECTED, handle registration
            if (hasRfidDetected) {
              const rfidEvent = data.updates.find((u: any) => u.action === 'RFID_DETECTED' || u.action === 'RFID_DETECTED_URGENT');
              if (rfidEvent) {
                this.zone.run(() => {
                  this.data.next({
                    rfid: rfidEvent.rfid,
                    scannerCode: rfidEvent.scannerCode,
                    employeeUser: rfidEvent.employeeUserCode ? { employeeUserCode: rfidEvent.employeeUserCode } as any : null,
                    location: rfidEvent.locationId ? { locationId: rfidEvent.locationId, name: rfidEvent.location } as any : null,
                    timestamp: rfidEvent.timestamp ? new Date(rfidEvent.timestamp) : new Date()
                  } as any);
                });
              }
            }
            
            // If batch contains location/status updates, refresh
            if (hasLocationUpdate) {
              console.log('📡 UnitService: Batch contains location/status updates, refreshing...');
              this.zone.run(() => {
                this.refreshUnits();
              });
            }
            return;
          }
          
          // Handle RFID_DETECTED action - emit via data$ for registration flow (immediate, no batching)
          if (data?.action === 'RFID_DETECTED') {
            console.log(`📡 UnitService: RFID_DETECTED event received (immediate, ${latency}ms)`, data);
            this.zone.run(() => {
              // Emit via data$ observable so CBU component can handle registration
              // Using type assertions since we only need partial data for registration flow
              this.data.next({
                rfid: data.rfid,
                scannerCode: data.scannerCode,
                employeeUser: data.employeeUserCode ? { employeeUserCode: data.employeeUserCode } as any : null,
                location: data.locationId ? { locationId: data.locationId, name: data.location } as any : null,
                timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
                _latency: latency
              } as any);
            });
            return;
          } 
          
          // Handle other unit updates (location changes, status updates, etc.)
          console.log('📡 UnitService: Unit update detected, refreshing...', data);
          this.zone.run(() => {
            this.refreshUnits(); // Trigger refresh
          });
        }
      });
      
    } catch (error) {
      console.error('Error setting up global update listener:', error);
    }
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
    return this.http.post<any>(environment.apiBaseUrl + "/units/page", params)
      .pipe(
        tap(_ => this.log('units')),
        catchError(this.handleError('units', []))
      );
  }

  registerViaScanner(data: {
    scannerCode: string;
    rfid: string;
    chassisNo: string;
    color: string;
    description: string;
    modelId: string;
  }): Observable<ApiResponse<Units>> {
    return this.http.post<any>(`${environment.apiBaseUrl}/units/register`, data)
      .pipe(
        tap(_ => this.log('register unit via scanner')),
        catchError(this.handleError('register unit via scanner', []))
      );
  }

  scanLocation(data: {
    scannerCode: string;
    rfid: string;
  }): Observable<ApiResponse<any>> {
    return this.http.post<any>(`${environment.apiBaseUrl}/units/scan-location`, data)
      .pipe(
        tap(response => {
          this.log('scan location');
          // 🔥 Auto-refresh after successful scan
          // The backend should also trigger a Pusher event, but we refresh immediately as well
          if (response.success) {
            this.zone.run(() => {
              this.refreshUnits();
            });
          }
        }),
        catchError(this.handleError('scan location', []))
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
          // 🔥 Auto-refresh after creating new unit
          this.refreshUnits();
        }),
        catchError(this.handleError('units', []))
      );
  }

  update(roleCode: string, data: any): Observable<ApiResponse<Units>> {
    return this.http.put<any>(environment.apiBaseUrl + "/units/" + roleCode, data)
      .pipe(
        tap(_ => {
          this.log('units');
          // 🔥 Auto-refresh after updating unit
          this.refreshUnits();
        }),
        catchError(this.handleError('units', []))
      );
  }

  delete(roleCode: string): Observable<ApiResponse<Units>> {
    return this.http.delete<any>(environment.apiBaseUrl + "/units/" + roleCode)
      .pipe(
        tap(_ => {
          this.log('units');
          // 🔥 Auto-refresh after deleting unit
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
}