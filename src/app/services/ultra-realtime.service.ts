import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, Subject, ReplaySubject } from 'rxjs';
import { PusherService } from './pusher.service';

export interface PredictiveUpdate {
  rfid: string;
  action: 'UNIT_REGISTERING_PREDICTIVE' | 'UNIT_REGISTERED_CONFIRMED' | 'LOCATION_UPDATED_PREDICTIVE' | 'LOCATION_UPDATED_CONFIRMED';
  unitCode?: string;
  location?: string;
  status?: string;
  timestamp: Date;
  _predictive?: boolean;
  _transactionId?: string;
  _sentAt?: number;
  _latency?: number;
  _urgent?: boolean;
}

@Injectable({ providedIn: 'root' })
export class UltraRealtimeService {
  // 🔥 URGENT: Predictive updates (5-10ms delivery)
  private predictiveSubject = new Subject<PredictiveUpdate>();
  public predictiveUpdates$ = this.predictiveSubject.asObservable();
  
  // 🔥 CONFIRMED: Final updates (20-30ms delivery)
  private confirmedSubject = new Subject<any>();
  public confirmedUpdates$ = this.confirmedSubject.asObservable();
  
  // 🔥 IMMEDIATE: Local state changes (0ms)
  private immediateSubject = new Subject<any>();
  public immediateUpdates$ = this.immediateSubject.asObservable();
  
  // Local cache for instant UI updates
  private unitCache = new Map<string, any>();
  private pendingTransactions = new Map<string, PredictiveUpdate>();
  
  constructor(
    private pusherService: PusherService,
    private zone: NgZone
  ) {
    this.setupUltraFastListeners();
  }
  
  private setupUltraFastListeners() {
    // 🔥 LISTEN TO ALL PUSHER CHANNELS IN PARALLEL
    this.pusherService.onUpdate.subscribe((payload: any) => {
      if (!payload || !payload.type) return;
      
      const receiveTime = Date.now();
      const data = payload.data || {};
      // Backend sends _sentAt or _pusherSentAt for latency tracking
      const sentAt = data._sentAt || data._pusherSentAt;
      // Only calculate latency if we have a valid sentAt timestamp
      const latency = sentAt && sentAt > 0 ? receiveTime - sentAt : 0;
      
      // ⚡ STEP 1: Handle URGENT/RFID events (from sendRegistrationUrgent)
      // Backend sends: action: 'RFID_DETECTED_URGENT' via 'registration-urgent' channel
      if (data.action === 'RFID_DETECTED_URGENT' || data._urgent || data._zeroDelay) {
        this.zone.run(() => {
          console.log(`⚡ URGENT/RFID event: ${latency}ms`, data);
          
          // Treat urgent RFID events as predictive for immediate UI update
          const transactionId = data.transactionId || data._transactionId || `urgent_${Date.now()}`;
          
          // Store for confirmation
          this.pendingTransactions.set(transactionId, {
            rfid: data.rfid,
            action: 'UNIT_REGISTERING_PREDICTIVE',
            location: data.location,
            timestamp: new Date(data.timestamp || receiveTime),
            _predictive: true,
            _transactionId: transactionId,
            _sentAt: sentAt || receiveTime,
            _latency: latency
          } as PredictiveUpdate);
          
          this.predictiveSubject.next({
            rfid: data.rfid,
            action: 'UNIT_REGISTERING_PREDICTIVE', // Normalize to predictive action
            location: data.location,
            timestamp: new Date(data.timestamp || receiveTime),
            _predictive: true,
            _transactionId: transactionId,
            _sentAt: sentAt || receiveTime,
            _latency: latency,
            _urgent: true
          });
        });
        return;
      }
      
      // ⚡ STEP 2: Handle PREDICTIVE notifications (from sendPredictiveNotification)
      // Backend sends: action: 'UNIT_REGISTERING_PREDICTIVE' via 'all' channel with 'reSync' event
      if (data._predictive || data.action === 'UNIT_REGISTERING_PREDICTIVE' || data.action?.includes('PREDICTIVE')) {
        this.zone.run(() => {
          console.log(`⚡ PREDICTIVE update: ${latency}ms`, data);
          
          // Store transaction for later confirmation
          const transactionId = data.transactionId || data._transactionId;
          if (transactionId) {
            this.pendingTransactions.set(transactionId, {
              ...data,
              timestamp: new Date(data.timestamp || receiveTime),
              _latency: latency
            } as PredictiveUpdate);
          }
          
          this.predictiveSubject.next({
            rfid: data.rfid,
            action: data.action as any || 'UNIT_REGISTERING_PREDICTIVE',
            unitCode: data.unitCode,
            location: data.location,
            status: data.status,
            timestamp: new Date(data.timestamp || receiveTime),
            _predictive: true,
            _transactionId: transactionId,
            _sentAt: sentAt || receiveTime,
            _latency: latency
          });
        });
        return;
      }
      
      // ⚡ STEP 3: Handle CONFIRMED notifications (from sendConfirmedNotificationAsync)
      // Backend sends: action: 'UNIT_REGISTERED_CONFIRMED' via 'all' channel with 'reSync' event
      if (data._confirmed || data.action === 'UNIT_REGISTERED_CONFIRMED' || data.action?.includes('CONFIRMED')) {
        this.zone.run(() => {
          console.log(`✅ CONFIRMED update: ${latency}ms`, data);
          
          // Clear pending transaction
          const transactionId = data.transactionId || data._transactionId;
          if (transactionId) {
            this.pendingTransactions.delete(transactionId);
          }
          
          this.confirmedSubject.next({
            ...data,
            timestamp: new Date(data.timestamp || receiveTime),
            _latency: latency,
            _confirmed: true
          });
        });
        return;
      }
      
      // ⚡ STEP 4: Handle REGULAR updates (LOCATION_UPDATED, UNIT_UPDATED, etc.)
      this.zone.run(() => {
        console.log(`📡 Regular update: ${latency}ms`, data);
        
        // Update local cache
        if (data.rfid) {
          this.unitCache.set(data.rfid, {
            ...this.unitCache.get(data.rfid),
            ...data,
            _updatedAt: receiveTime
          });
        }
        
        // Route location/status updates to confirmed stream
        if (data.action === 'LOCATION_UPDATED' || data.action === 'UNIT_UPDATED' || 
            data.action === 'ENTERED_WAREHOUSE_5' || data.action === 'EXITED_WAREHOUSE_5') {
          this.confirmedSubject.next({
            ...data,
            timestamp: new Date(data.timestamp || receiveTime),
            _latency: latency
          });
        }
      });
    });
  }
  
  // 🔥 PREDICTIVE UI: Update UI BEFORE backend confirmation
  predictUnitRegistration(rfid: string, scannerCode: string, location: any): string {
    const transactionId = `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const predictiveData: PredictiveUpdate = {
      rfid,
      action: 'UNIT_REGISTERING_PREDICTIVE',
      location: location?.name,
      timestamp: new Date(),
      _predictive: true,
      _transactionId: transactionId,
      _sentAt: Date.now()
    };
    
    // Update UI IMMEDIATELY (0ms)
    this.zone.run(() => {
      this.immediateSubject.next(predictiveData);
    });
    
    return transactionId;
  }
  
  // 🔥 CONFIRM PREDICTION: Replace predictive with real data
  confirmPrediction(transactionId: string, realData: any) {
    const pending = this.pendingTransactions.get(transactionId);
    if (pending) {
      this.zone.run(() => {
        this.confirmedSubject.next({
          ...pending,
          ...realData,
          _confirmed: true,
          _wasPredicted: true
        });
      });
      this.pendingTransactions.delete(transactionId);
    }
  }
  
  // 🔥 GET LOCAL CACHE: Instant data access
  getUnitFromCache(rfid: string): any | null {
    return this.unitCache.get(rfid) || null;
  }
  
  // 🔥 UPDATE LOCAL CACHE: For immediate UI updates
  updateLocalCache(rfid: string, updates: any): void {
    const current = this.unitCache.get(rfid) || {};
    this.unitCache.set(rfid, { ...current, ...updates, _localUpdate: Date.now() });
    
    // Emit immediate update
    this.zone.run(() => {
      this.immediateSubject.next({ rfid, ...updates, _local: true });
    });
  }
}

