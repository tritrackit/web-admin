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
      
      this.socket = io(socketUrl, {
        transports: environment.socketIo?.options?.transports || ['websocket', 'polling'],
        reconnection: environment.socketIo?.options?.reconnection !== false,
        reconnectionDelay: environment.socketIo?.options?.reconnectionDelay || 1000,
        reconnectionAttempts: environment.socketIo?.options?.reconnectionAttempts || 5,
        timeout: environment.socketIo?.options?.timeout || 20000,
      });
      
      // Connection events
      this.socket.on('connect', () => {
        this.socketConnected = true;
        console.log('⚡ Socket.io: Connected! (ID:', this.socket?.id, ')');
      });
      
      this.socket.on('disconnect', () => {
        this.socketConnected = false;
        console.log('⚠️ Socket.io: Disconnected - Falling back to Pusher');
      });
      
      this.socket.on('connect_error', (error) => {
        this.socketConnected = false;
        console.warn('⚠️ Socket.io: Connection error - Using Pusher fallback', error.message);
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
   * 🔄 Setup Pusher listeners (FALLBACK - used if Socket.io fails)
   */
  private setupEmergencyListener() {
    console.log('🔧 Pusher: Setting up FALLBACK listeners...');
    
    // ⚡ FALLBACK: RFID Emergency Channel (only if Socket.io not connected)
    const emergencyChannel = this.pusher.subscribe('rfid-emergency-bypass');
    emergencyChannel.bind('rfid-urgent', (data: any) => {
      // Skip if Socket.io already processed this (prevent duplicates)
      if (this.isSocketConnected()) {
        console.log('⏭️ Pusher: Skipping (Socket.io is connected)');
        return;
      }
      
      const now = Date.now();
      const sentAt = data._sentAt || data.timestamp;
      const latency = sentAt ? now - sentAt : 0;
      
      if (data.rfid && this.lastRfidEvent.rfid === data.rfid && 
          (now - this.lastRfidEvent.time) < 2000) {
        console.log(`⏭️ Pusher: Skipping duplicate RFID: ${data.rfid} (${now - this.lastRfidEvent.time}ms ago)`);
        return;
      }
      
      this.lastRfidEvent = {rfid: data.rfid, time: now, channel: 'rfid-emergency-bypass', source: 'pusher'};
      
      console.log(`⚡ Pusher RFID (FALLBACK): ${latency}ms - ${data.rfid}`);
      
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
}
