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
import { UltraRealtimeService } from './ultra-realtime.service';

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
  
  // 🎯 PREDICTIVE: New observables for different update types
  private predictiveUpdateSubject = new Subject<any>();
  public predictiveUpdates$ = this.predictiveUpdateSubject.asObservable();
  
  private confirmedUpdateSubject = new Subject<any>();
  public confirmedUpdates$ = this.confirmedUpdateSubject.asObservable();
  
  // Pending predictions
  private pendingPredictions = new Map<string, any>();
  
  constructor(
    private http: HttpClient, 
    private appconfig: AppConfigService,
    private zone: NgZone,
    private storageService: StorageService,
    private pusher: PusherService,
    private router: Router,
    private ultraRealtime: UltraRealtimeService
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
    
    // 🔥 PREDICTIVE: Setup predictive listeners
    this.setupPredictiveListeners();
  }
  
  private setupPredictiveListeners() {
    // 🔥 Listen to UltraRealtimeService for predictive updates
    this.ultraRealtime.predictiveUpdates$
      .subscribe(update => {
        this.zone.run(() => {
          console.log('📡 UnitService: Predictive update received', update);
          
          // Store for confirmation
          if (update._transactionId) {
            this.pendingPredictions.set(update._transactionId, update);
          }
          
          // Forward to components
          this.predictiveUpdateSubject.next(update);
        });
      });
    
    // 🔥 Listen for confirmed updates
    this.ultraRealtime.confirmedUpdates$
      .subscribe(update => {
        this.zone.run(() => {
          console.log('📡 UnitService: Confirmed update received', update);
          
          // Clear pending prediction
          if (update._transactionId) {
            this.pendingPredictions.delete(update._transactionId);
          }
          
          // Forward to components
          this.confirmedUpdateSubject.next(update);
          
          // Also trigger refresh for backward compatibility
          this.refreshSubject.next();
        });
      });
    
    // 🔥 Listen for immediate local updates
    this.ultraRealtime.immediateUpdates$
      .subscribe(update => {
        this.zone.run(() => {
          console.log('📡 UnitService: Immediate local update', update);
          
          // Update local data stream (for CBU registration)
          if (update.rfid && !update._local) {
            this.data.next(update);
          }
        });
      });
  }
  
  // 🔥 PREDICTIVE REGISTRATION: Update UI before backend confirms
  registerUnitWithPrediction(data: any): { transactionId: string; predictiveUnit: any } {
    const transactionId = this.ultraRealtime.predictUnitRegistration(
      data.rfid,
      data.scannerCode,
      data.location
    );
    
    // Create predictive unit object
    const predictiveUnit = {
      rfid: data.rfid,
      scannerCode: data.scannerCode,
      employeeUser: null as any,
      location: data.location,
      timestamp: new Date(),
      _predictive: true,
      _transactionId: transactionId,
      _status: 'PENDING'
    } as any;
    
    // Update local data stream for CBU component
    this.zone.run(() => {
      this.data.next(predictiveUnit);
    });
    
    return { transactionId, predictiveUnit };
  }
  
  // 🔥 CONFIRM PREDICTION: Called when backend confirms
  confirmRegistrationPrediction(transactionId: string, realUnit: Units) {
    this.ultraRealtime.confirmPrediction(transactionId, {
      ...realUnit,
      action: 'UNIT_REGISTERED_CONFIRMED'
    });
    
    // Clear from pending
    this.pendingPredictions.delete(transactionId);
    
    // Trigger refresh
    this.refreshSubject.next();
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

  // 🔥 ULTRA-FAST REGISTRATION (with prediction)
  registerViaScanner(data: {
    scannerCode: string;
    rfid: string;
    chassisNo: string;
    color: string;
    description: string;
    modelId: string;
  }): Observable<ApiResponse<Units>> {
    // 1. PREDICTIVE: Update UI immediately
    const { transactionId } = this.registerUnitWithPrediction({
      rfid: data.rfid,
      scannerCode: data.scannerCode,
      location: null // Will be set by backend
    });
    
    // 2. Send to backend
    return this.http.post<ApiResponse<Units>>(
      `${environment.apiBaseUrl}/units/register`,
      data
    ).pipe(
      tap(response => {
        if (response.success) {
          // 3. CONFIRM prediction
          this.confirmRegistrationPrediction(transactionId, response.data);
        } else {
          // 4. PREDICTION FAILED: Send rollback
          this.ultraRealtime.updateLocalCache(data.rfid, {
            _error: response.message,
            _status: 'FAILED'
          });
        }
      }),
      catchError(error => {
        // Prediction failed
        this.ultraRealtime.updateLocalCache(data.rfid, {
          _error: error.message,
          _status: 'ERROR'
        });
        return this.handleError('register unit via scanner', { success: false, message: error.message, data: null } as ApiResponse<Units>)(error);
      })
    );
  }

  // 🔥 ULTRA-FAST LOCATION UPDATE (with prediction)
  scanLocation(data: {
    scannerCode: string;
    rfid: string;
  }): Observable<ApiResponse<any>> {
    const transactionId = `loc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 1. PREDICTIVE: Update UI immediately
    this.ultraRealtime.updateLocalCache(data.rfid, {
      _locationUpdating: true,
      _locationTransactionId: transactionId,
      _locationUpdateTime: Date.now()
    });
    
    this.predictiveUpdateSubject.next({
      rfid: data.rfid,
      action: 'LOCATION_UPDATED_PREDICTIVE',
      timestamp: new Date(),
      _predictive: true,
      _transactionId: transactionId
    });
    
    // 2. Send to backend
    return this.http.post<ApiResponse<any>>(
      `${environment.apiBaseUrl}/units/scan-location`,
      data
    ).pipe(
      tap(response => {
        if (response.success) {
          // 3. CONFIRM prediction
          this.ultraRealtime.confirmPrediction(transactionId, {
            rfid: data.rfid,
            action: 'LOCATION_UPDATED_CONFIRMED',
            ...response.data
          });
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
          // 🔥 Auto-refresh after creating new unit
          this.refreshUnits();
        }),
        catchError(this.handleError('units', []))
      );
  }

  update(roleCode: string, data: any): Observable<ApiResponse<Units>> {
    // 🔥 PREDICTIVE: Update local cache immediately
    if (data.rfid) {
      this.ultraRealtime.updateLocalCache(data.rfid, data);
    }
    
    return this.http.put<any>(environment.apiBaseUrl + "/units/" + roleCode, data)
      .pipe(
        tap(response => {
          this.log('units');
          if (response.success) {
            // 🔥 Auto-refresh after updating unit
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