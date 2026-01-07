import { Injectable } from '@angular/core';
import Pusher from 'pusher-js';
import { Subject } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class PusherService {
  private pusher: Pusher;
  private socket: Socket | null = null;
  private socketConnected = false;
  
  public onUpdate = new Subject<any>();
  private lastRfidEvent: {rfid: string, time: number, channel?: string, source?: string, _sentAt?: number} = {rfid: '', time: 0};
  
  constructor() {
    // Initialize Pusher (fallback)
    this.pusher = new Pusher(environment.pusher.key, {
      cluster: environment.pusher.cluster,
      forceTLS: true,
      enabledTransports: ['ws', 'wss'],
      disabledTransports: ['xhr_streaming', 'xhr_polling'],
      disableStats: true,
      activityTimeout: 60000,
      pongTimeout: 30000
    });
    
    // Monitor Pusher connection state
    this.pusher.connection.bind('connected', () => {
    });
    
    this.pusher.connection.bind('disconnected', () => {
    });
    
    this.pusher.connection.bind('error', (error: any) => {
    });
    
    this.pusher.connection.bind('state_change', (states: any) => {
    });
    
    // ⚡ Initialize Socket.io (PRIMARY - ultra-fast)
    this.initializeSocketIo();
    
    // Setup Pusher listeners (FALLBACK)
    this.setupEmergencyListener();
  }
  
  /**
   * ⚡ Initialize Socket.io connection (PRIMARY method - <10ms latency)
   */
  private initializeSocketIo(): void {
    try {
      const socketUrl = environment.socketIo?.url || environment.apiBaseUrl.replace('/api/v1', '');
      
      const socketOptions: any = {
        transports: environment.socketIo?.options?.transports || ['websocket', 'polling'],
        reconnection: environment.socketIo?.options?.reconnection !== false,
        reconnectionDelay: environment.socketIo?.options?.reconnectionDelay || 1000,
        reconnectionAttempts: environment.socketIo?.options?.reconnectionAttempts || 5,
        timeout: environment.socketIo?.options?.timeout || 20000,
        // CORS options for production
        withCredentials: false,
        autoConnect: true,
      };
      
      // Add extra options for production (HTTPS)
      if (environment.production) {
        socketOptions.forceNew = true;
        socketOptions.upgrade = true;
        // Ensure secure connection in production
        socketOptions.secure = true;
      }
      
      this.socket = io(socketUrl, socketOptions);
      
      // Connection events
      this.socket.on('connect', () => {
        this.socketConnected = true;
      });
      
      this.socket.on('disconnect', (reason) => {
        this.socketConnected = false;
      });
      
      this.socket.on('connect_error', (error: any) => {
        this.socketConnected = false;
        const errorDetails = {
          message: error.message,
          type: error.type || 'unknown',
          description: error.description || error.message,
          url: socketUrl,
          production: environment.production,
          // Additional error info
          code: error.code || 'unknown',
          context: error.context || 'unknown'
        };
        
      });
      
      // Add reconnection attempt logging
      this.socket.on('reconnect_attempt', (attemptNumber) => {
      });
      
      this.socket.on('reconnect', (attemptNumber) => {
        this.socketConnected = true;
      });
      
      this.socket.on('reconnect_failed', () => {
        this.socketConnected = false;
      });
      
      // ⚡ PRIMARY: Listen for RFID events from Socket.io (ultra-fast)
      this.socket.on('rfid-urgent', (data: any) => {
        const now = Date.now();
        const sentAt = data._socketSentAt || data._sentAt || (data.timestamp instanceof Date ? data.timestamp.getTime() : new Date(data.timestamp || Date.now()).getTime());
        const latency = sentAt ? now - sentAt : 0;
        
        const action = data.action || 'RFID_DETECTED';
        // Only apply strict duplicate prevention for REGISTRATION events
        const isRegistrationEvent = action === 'RFID_DETECTED' || 
                                   action === 'RFID_DETECTED_URGENT' ||
                                   action === 'UNIT_REGISTERING_PREDICTIVE' ||
                                   action === 'UNIT_REGISTERED_CONFIRMED';
        
        if (isRegistrationEvent) {
          // 🔥 PREVENT DUPLICATES for registration events only
          // Check both time and _sentAt to catch duplicate events from backend
          const isSameSentAt = this.lastRfidEvent._sentAt && sentAt && this.lastRfidEvent._sentAt === sentAt;
          const isDuplicate = data.rfid && 
                             this.lastRfidEvent.rfid === data.rfid && 
                             (isSameSentAt || (now - this.lastRfidEvent.time) < 10000);
          
          if (isDuplicate) {
            return;
          }
        }
        
        this.lastRfidEvent = {rfid: data.rfid, time: now, channel: 'socket.io', source: 'socket.io', _sentAt: sentAt};
        
        // Check if this is a location update (should trigger refresh, not popup)
        const isLocationUpdate = action === 'LOCATION_UPDATED' || 
                                action === 'ENTERED_WAREHOUSE_5' || 
                                action === 'EXITED_WAREHOUSE_5' ||
                                data._autoRefresh === true;
        
        if (isLocationUpdate) {
          // Location updates should trigger refresh, not popup
          this.onUpdate.next({
            type: 'units',
            data: {
              ...data,
              action: action,
              _autoRefresh: true
            },
            _priority: 'normal'
          });
        } else {
          // 🔥 EMIT IMMEDIATELY for CBU pop-up (registration events)
          this.onUpdate.next({
            type: 'rfid-emergency',
            data: {
              rfid: data.rfid,
              scannerCode: data.scannerCode,
              location: data.location,
              locationId: data.locationId,
              employeeUserCode: data.employeeUserCode,
              action: 'RFID_DETECTED_URGENT',
              timestamp: new Date(),
              _latency: latency,
              _instantPopup: true, // ⚡ FLAG for CBU instant pop-up
              _sentAt: sentAt,
              _source: 'socket.io' // Track source for debugging
            },
            _priority: 'highest'
          });
        }
      });
      
    } catch (error) {
      this.socketConnected = false;
    }
  }
  
  /**
   * Check if Socket.io is connected and available
   */
  public isSocketConnected(): boolean {
    return this.socketConnected && this.socket?.connected === true;
  }
  
  /**
   * 🔄 Setup Pusher listeners (FALLBACK - used if Socket.io fails, ALWAYS ACTIVE)
   */
  private setupEmergencyListener() {
    // ⚡ ALWAYS LISTEN: RFID Emergency Channel (Pusher always works, Socket.io is optional)
    const emergencyChannel = this.pusher.subscribe('rfid-emergency-bypass');
    
    emergencyChannel.bind('pusher:subscription_succeeded', () => {
    });
    
    emergencyChannel.bind('pusher:subscription_error', (error: any) => {
    });
    
    emergencyChannel.bind('rfid-urgent', (data: any) => {
      const now = Date.now();
      const sentAt = data._sentAt || (data.timestamp instanceof Date ? data.timestamp.getTime() : new Date(data.timestamp || Date.now()).getTime());
      const latency = sentAt ? now - sentAt : 0;
      
      const action = data.action || 'RFID_DETECTED';
      // Only apply strict duplicate prevention for REGISTRATION events
      const isRegistrationEvent = action === 'RFID_DETECTED' || 
                                 action === 'RFID_DETECTED_URGENT' ||
                                 action === 'UNIT_REGISTERING_PREDICTIVE' ||
                                 action === 'UNIT_REGISTERED_CONFIRMED';
      
      // 🔥 IMPORTANT: In production, if Socket.io isn't working, Pusher MUST handle events
      // Only skip if Socket.io is ACTUALLY connected AND we received the same RFID from Socket.io VERY recently (< 200ms)
      const socketReceived = this.isSocketConnected() && 
                             this.lastRfidEvent.source === 'socket.io' &&
                             this.lastRfidEvent.rfid === data.rfid &&
                             (now - this.lastRfidEvent.time) < 200;
      
      if (socketReceived) {
        return;
      }
      
      if (isRegistrationEvent) {
        // 🔥 PREVENT DUPLICATES for registration events only
        // Check both time and _sentAt to catch duplicate events from backend
        const isSameSentAt = this.lastRfidEvent._sentAt && sentAt && this.lastRfidEvent._sentAt === sentAt;
        const isDuplicate = data.rfid && 
                           this.lastRfidEvent.rfid === data.rfid && 
                           (isSameSentAt || (now - this.lastRfidEvent.time) < 10000);
        
        if (isDuplicate) {
          return;
        }
      }
      
      this.lastRfidEvent = {rfid: data.rfid, time: now, channel: 'rfid-emergency-bypass', source: 'pusher', _sentAt: sentAt};
      
      // Check if this is a location update (should trigger refresh, not popup)
      const isLocationUpdate = action === 'LOCATION_UPDATED' || 
                              action === 'ENTERED_WAREHOUSE_5' || 
                              action === 'EXITED_WAREHOUSE_5' ||
                              data._autoRefresh === true;
      
      if (isLocationUpdate) {
        // Location updates should trigger refresh, not popup
        this.onUpdate.next({
          type: 'units',
          data: {
            ...data,
            action: action,
            _autoRefresh: true
          },
          _priority: 'normal'
        });
      } else {
        // Registration events trigger popup
        this.onUpdate.next({
          type: 'rfid-emergency',
          data: {
            rfid: data.rfid,
            scannerCode: data.scannerCode,
            location: data.location,
            locationId: data.locationId,
            employeeUserCode: data.employeeUserCode,
            action: 'RFID_DETECTED_URGENT',
            timestamp: new Date(),
            _latency: latency,
            _instantPopup: true, 
            _sentAt: sentAt,
            _source: 'pusher' // Track source for debugging
          },
          _priority: 'highest'
        });
      }
    });
    
    const registrationChannel = this.pusher.subscribe('registration-urgent');
    registrationChannel.bind('rfid-detected', (data: any) => {
      const now = Date.now();
      const sentAt = data._sentAt || data._pusherSentAt || (data.timestamp instanceof Date ? data.timestamp.getTime() : new Date(data.timestamp || Date.now()).getTime());
      const latency = sentAt ? now - sentAt : 0;
      
      // This channel is specifically for registration events, so always apply duplicate prevention
      // 🔥 PREVENT DUPLICATES within 10 seconds
      // Check _sentAt to catch duplicate events from backend (predictive + confirmed)
      const isSameSentAt = this.lastRfidEvent._sentAt && sentAt && this.lastRfidEvent._sentAt === sentAt;
      const isDuplicate = data.rfid && 
                         this.lastRfidEvent.rfid === data.rfid && 
                         (isSameSentAt || (now - this.lastRfidEvent.time) < 10000);
      
      if (isDuplicate) {
        return;
      }
      
      this.lastRfidEvent = {rfid: data.rfid, time: now, _sentAt: sentAt};
      
      this.onUpdate.next({
        type: 'rfid',
        data: {
          ...data,
          action: 'RFID_DETECTED_URGENT',
          _instantPopup: true,
          _latency: latency,
          _sentAt: sentAt
        },
        _priority: 'high'
      });
    });
    
  
    const registrationChannel2 = this.pusher.subscribe('registration-channel');
    registrationChannel2.bind('new-registration', (data: any) => {
      const now = Date.now();
      const sentAt = data._pusherSentAt || data._sentAt || (data.timestamp instanceof Date ? data.timestamp.getTime() : new Date(data.timestamp || Date.now()).getTime());
      const latency = sentAt ? now - sentAt : 0;
      
      // This channel is specifically for registration events, so always apply duplicate prevention
      // 🔥 PREVENT DUPLICATES within 10 seconds
      // Check _sentAt to catch duplicate events from backend
      const isSameSentAt = this.lastRfidEvent._sentAt && sentAt && this.lastRfidEvent._sentAt === sentAt;
      const isDuplicate = data.rfid && 
                         this.lastRfidEvent.rfid === data.rfid && 
                         (isSameSentAt || (now - this.lastRfidEvent.time) < 10000);
      
      if (isDuplicate) {
        return;
      }
      
      this.lastRfidEvent = {rfid: data.rfid, time: now, channel: 'registration-channel', _sentAt: sentAt};
      
      this.onUpdate.next({
        type: 'rfid',
        data: {
          rfid: data.rfid,
          scannerCode: data.scannerCode,
          location: data.location,
          locationId: data.locationId,
          action: 'RFID_DETECTED',
          timestamp: data.timestamp,
          _instantPopup: true,
          _latency: latency,
          _sentAt: sentAt
        },
        _priority: 'high'
      });
    });
    
  
    const globalChannel = this.pusher.subscribe('all');
    globalChannel.bind('reSync', (payload: any) => {
      const data = payload?.data || {};
      
      // Allow location updates through (they have RFID but should trigger refresh)
      const isLocationUpdate = data.action === 'LOCATION_UPDATED' || 
                              data.action === 'ENTERED_WAREHOUSE_5' || 
                              data.action === 'EXITED_WAREHOUSE_5' ||
                              data._autoRefresh === true;
      
      // Skip only registration/RFID detection events (use emergency channel instead)
      // But allow location updates even if they have RFID
      if (!isLocationUpdate && (data.rfid || data.action?.includes('RFID') || data.action?.includes('REGISTER'))) {
        return; // Skip - use emergency channel instead
      }
      
      this.onUpdate.next({
        type: 'units',
        data: data,
        _priority: 'normal'
      });
    });
  }

  public init(channel: string) {
    const channelInstance = this.pusher.subscribe(channel);
    return channelInstance;
  }
  
  public unsubscribe(channel: any) {
    if (channel) {
      const channelName = typeof channel === 'string' ? channel : channel.name;
      if (channelName) {
        this.pusher.unsubscribe(channelName);
      }
    }
  }
  
  /**
   * Disconnect Socket.io (cleanup)
   */
  public disconnectSocket(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.socketConnected = false;
    }
  }
  
  /**
   * Get connection status for debugging
   */
  public getConnectionStatus(): {
    socketIo: { connected: boolean; url?: string; id?: string };
    pusher: { connected: boolean; state?: string };
    lastRfidEvent: { rfid: string; source?: string; time: number };
  } {
    return {
      socketIo: {
        connected: this.isSocketConnected(),
        url: environment.socketIo?.url,
        id: this.socket?.id
      },
      pusher: {
        connected: this.pusher?.connection?.state === 'connected',
        state: this.pusher?.connection?.state || 'unknown'
      },
      lastRfidEvent: {
        rfid: this.lastRfidEvent.rfid || 'none',
        source: this.lastRfidEvent.source,
        time: this.lastRfidEvent.time
      }
    };
  }
}
