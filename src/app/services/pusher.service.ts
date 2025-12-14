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
  private lastRfidEvent: {rfid: string, time: number, channel?: string, source?: string} = {rfid: '', time: 0};
  
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
      console.log('✅ Pusher: Connected (ready to receive events)');
    });
    
    this.pusher.connection.bind('disconnected', () => {
      console.warn('⚠️ Pusher: Disconnected - attempting to reconnect...');
    });
    
    this.pusher.connection.bind('error', (error: any) => {
      console.error('❌ Pusher: Connection error', error);
    });
    
    this.pusher.connection.bind('state_change', (states: any) => {
      console.log('🔄 Pusher: State changed', states.previous, '->', states.current);
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
      
      console.log('🔧 Socket.io: Initializing connection to', socketUrl);
      console.log('🔧 Socket.io: Production mode:', environment.production);
      console.log('🔧 Socket.io: API Base URL:', environment.apiBaseUrl);
      
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
        console.log('⚡ Socket.io: Connected! (ID:', this.socket?.id, ')');
        console.log('⚡ Socket.io: Connection URL:', socketUrl);
        console.log('⚡ Socket.io: Transport:', this.socket?.io?.engine?.transport?.name || 'unknown');
      });
      
      this.socket.on('disconnect', (reason) => {
        this.socketConnected = false;
        console.log('⚠️ Socket.io: Disconnected - Reason:', reason, '- Falling back to Pusher');
        console.log('⚠️ Socket.io: Pusher fallback is ALWAYS ACTIVE and will handle events');
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
        
        console.error('⚠️ Socket.io: Connection error - Using Pusher fallback', errorDetails);
        
        // Log detailed error for debugging in production
        if (environment.production) {
          console.error('🔍 Production Socket.io Debug:', {
            url: socketUrl,
            error: errorDetails,
            willUsePusher: true,
            pusherStatus: this.pusher?.connection?.state || 'unknown',
            note: 'Pusher is ALWAYS ACTIVE as fallback - events will still be received'
          });
        }
      });
      
      // Add reconnection attempt logging
      this.socket.on('reconnect_attempt', (attemptNumber) => {
        console.log(`🔄 Socket.io: Reconnection attempt ${attemptNumber}`);
      });
      
      this.socket.on('reconnect', (attemptNumber) => {
        this.socketConnected = true;
        console.log(`✅ Socket.io: Reconnected after ${attemptNumber} attempts`);
      });
      
      this.socket.on('reconnect_failed', () => {
        console.error('❌ Socket.io: Reconnection failed - Will use Pusher fallback');
        this.socketConnected = false;
        console.log('⚠️ Socket.io: Pusher fallback is ALWAYS ACTIVE and will handle all events');
      });
      
      // ⚡ PRIMARY: Listen for RFID events from Socket.io (ultra-fast)
      this.socket.on('rfid-urgent', (data: any) => {
        const now = Date.now();
        const sentAt = data._socketSentAt || data._sentAt || data.timestamp;
        const latency = sentAt ? now - sentAt : 0;
        
        // 🔥 PREVENT DUPLICATES within 2 seconds (same RFID from any source)
        if (data.rfid && this.lastRfidEvent.rfid === data.rfid && 
            (now - this.lastRfidEvent.time) < 2000) {
          console.log(`⏭️ Socket.io: Skipping duplicate RFID: ${data.rfid} (${now - this.lastRfidEvent.time}ms ago)`);
          return;
        }
        
        this.lastRfidEvent = {rfid: data.rfid, time: now, channel: 'socket.io', source: 'socket.io'};
        
        console.log(`⚡ Socket.io RFID: ${latency}ms - ${data.rfid}`);
        
        // 🔥 EMIT IMMEDIATELY for CBU pop-up
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
      });
      
    } catch (error) {
      console.error('❌ Socket.io initialization failed:', error);
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
    console.log('🔧 Pusher: Setting up listeners (ALWAYS ACTIVE as fallback)...');
    
    // ⚡ ALWAYS LISTEN: RFID Emergency Channel (Pusher always works, Socket.io is optional)
    const emergencyChannel = this.pusher.subscribe('rfid-emergency-bypass');
    
    emergencyChannel.bind('pusher:subscription_succeeded', () => {
      console.log('✅ Pusher: Subscribed to rfid-emergency-bypass channel');
    });
    
    emergencyChannel.bind('pusher:subscription_error', (error: any) => {
      console.error('❌ Pusher: Subscription error for rfid-emergency-bypass', error);
    });
    
    emergencyChannel.bind('rfid-urgent', (data: any) => {
      const now = Date.now();
      const sentAt = data._sentAt || data.timestamp;
      const latency = sentAt ? now - sentAt : 0;
      
      // 🔥 IMPORTANT: In production, if Socket.io isn't working, Pusher MUST handle events
      // Only skip if Socket.io is ACTUALLY connected AND we received the same RFID from Socket.io VERY recently (< 200ms)
      const socketReceived = this.isSocketConnected() && 
                             this.lastRfidEvent.source === 'socket.io' &&
                             this.lastRfidEvent.rfid === data.rfid &&
                             (now - this.lastRfidEvent.time) < 200; // Reduced from 500ms to 200ms
      
      if (socketReceived) {
        console.log('⏭️ Pusher: Skipping (Socket.io already processed this RFID', (now - this.lastRfidEvent.time), 'ms ago)');
        return;
      }
      
      // 🔥 PREVENT DUPLICATES: Same RFID from Pusher within 2 seconds
      if (data.rfid && this.lastRfidEvent.rfid === data.rfid && 
          this.lastRfidEvent.source === 'pusher' &&
          (now - this.lastRfidEvent.time) < 2000) {
        console.log(`⏭️ Pusher: Skipping duplicate RFID: ${data.rfid} (${now - this.lastRfidEvent.time}ms ago)`);
        return;
      }
      
      console.log('🔍 Pusher: Processing RFID event', {
        socketConnected: this.isSocketConnected(),
        lastSource: this.lastRfidEvent.source,
        lastRfid: this.lastRfidEvent.rfid,
        currentRfid: data.rfid,
        timeSinceLast: this.lastRfidEvent.rfid ? (now - this.lastRfidEvent.time) : 'N/A',
        latency: latency,
        production: environment.production
      });
      
      this.lastRfidEvent = {rfid: data.rfid, time: now, channel: 'rfid-emergency-bypass', source: 'pusher'};
      
      console.log(`⚡ Pusher RFID (${environment.production ? 'PRODUCTION' : 'DEV'}): ${latency}ms - ${data.rfid}`);
      
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
    });
    
    const registrationChannel = this.pusher.subscribe('registration-urgent');
    registrationChannel.bind('rfid-detected', (data: any) => {
      const now = Date.now();
      const sentAt = data._sentAt || data._pusherSentAt || data.timestamp;
      const latency = sentAt ? now - sentAt : 0;
      
      // 🔥 PREVENT DUPLICATES
      if (data.rfid && this.lastRfidEvent.rfid === data.rfid && 
          (now - this.lastRfidEvent.time) < 500) {
        return;
      }
      
      this.lastRfidEvent = {rfid: data.rfid, time: now};
      
      console.log(`⚡ REGISTRATION URGENT: ${latency}ms - ${data.rfid}`);
      
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
      const sentAt = data._pusherSentAt || data._sentAt || data.timestamp;
      const latency = sentAt ? now - sentAt : 0;
      
      // 🔥 PREVENT DUPLICATES within 2 seconds
      if (data.rfid && this.lastRfidEvent.rfid === data.rfid && 
          (now - this.lastRfidEvent.time) < 2000) {
        console.log(`⏭️ Skipping duplicate RFID from registration-channel: ${data.rfid}`);
        return;
      }
      
      this.lastRfidEvent = {rfid: data.rfid, time: now, channel: 'registration-channel'};
      
      console.log(`⚡ NEW REGISTRATION: ${latency}ms - ${data.rfid}`);
      
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
      
      if (data.rfid || data.action?.includes('RFID') || data.action?.includes('REGISTER')) {
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
      console.log('🔌 Socket.io: Disconnected');
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
