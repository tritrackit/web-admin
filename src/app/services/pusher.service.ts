import { Injectable, EventEmitter } from '@angular/core';
import Pusher from 'pusher-js';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class PusherService {
  public pusher: Pusher;
  public onUpdate = new EventEmitter<any>();
  private channels: Map<string, any> = new Map();

  constructor() {
    this.pusher = new Pusher(environment.pusher.key, {
      cluster: environment.pusher.cluster,
      forceTLS: environment.production,
      enabledTransports: ['ws', 'wss'], // Force WebSocket
      disableStats: true,
      activityTimeout: 60000,
      pongTimeout: 30000
    });
    
    // 🔥 SIMPLIFIED: Listen to ALL channels with unified handler
    this.setupUnifiedListener();
  }
  
  private setupUnifiedListener() {
    // ⚡ STEP 1: URGENT CHANNEL - HIGHEST PRIORITY (bypasses all queues)
    // Backend sends: sendRegistrationUrgent() -> 'registration-urgent' with 'rfid-detected' event
    const urgentChannel = this.pusher.subscribe('registration-urgent');
    urgentChannel.bind('rfid-detected', (data: any) => {
      const receiveTime = Date.now();
      const sentAt = data?._sentAt || data?._pusherSentAt;
      const latency = sentAt ? receiveTime - sentAt : 0;
      
      console.log(`⚡ URGENT Pusher: RFID detected for immediate registration (${latency}ms latency)`, data);
      
      if (latency > 200) {
        console.warn(`⚠️ High URGENT Pusher latency: ${latency}ms`);
      }
      
      // Emit a HIGH PRIORITY event with new action type
      this.onUpdate.emit({
        type: 'units',
        data: {
          rfid: data.rfid,
          scannerCode: data.scannerCode,
          action: 'RFID_DETECTED_URGENT',
          location: data.location,
          locationId: data.locationId,
          employeeUserCode: data.employeeUserCode,
          timestamp: data.timestamp,
          _priority: 'highest',
          _channel: 'registration-urgent',
          _sentAt: sentAt,
          _receiveTime: receiveTime,
          _latency: latency
        }
      });
    });
    
    // 🔥 STEP 2: LISTEN TO THE SAME CHANNEL AS BACKEND: 'all' channel with 'reSync' event
    const globalChannel = this.pusher.subscribe('all');
    
    // Listen for reSync events (this is what the backend actually sends)
    globalChannel.bind('reSync', (payload: any) => {
      const receiveTime = Date.now();
      const sentAt = payload?.data?._pusherSentAt;
      const latency = sentAt ? receiveTime - sentAt : 0;
      
      console.log(`📡 Pusher: reSync event received (${latency}ms latency)`, payload);
      
      if (latency > 500) {
        console.warn(`⚠️ High Pusher latency: ${latency}ms for reSync event`);
      }
      
      // Backend sends: { type: 'units', data: { rfid, action, location, status, ... } }
      // OR batched: { type: 'units', data: { action: 'BATCH_UPDATE', updates: [...], count: N } }
      if (payload && payload.type === 'units') {
        console.log('📡 Unit update detected via reSync, triggering refresh...', payload.data);
        this.onUpdate.emit(payload);
      }
    });
    
    // 🔥 STEP 3: Listen to registration-channel for immediate registration events
    const registrationChannel = this.pusher.subscribe('registration-channel');
    registrationChannel.bind('new-registration', (data: any) => {
      const receiveTime = Date.now();
      const sentAt = data?._pusherSentAt;
      const latency = sentAt ? receiveTime - sentAt : 0;
      
      console.log(`📡 Pusher: New registration event received (immediate, ${latency}ms latency)`, data);
      
      if (latency > 200) {
        console.warn(`⚠️ High registration channel latency: ${latency}ms`);
      }
      
      // Emit as RFID_DETECTED for UnitService to handle
      this.onUpdate.emit({
        type: 'units',
        data: {
          rfid: data.rfid,
          scannerCode: data.scannerCode,
          action: 'RFID_DETECTED',
          location: data.location,
          locationId: data.locationId,
          timestamp: data.timestamp,
          scannerType: data.scannerType,
          _channel: 'registration-channel',
          _sentAt: sentAt,
          _receiveTime: receiveTime,
          _latency: latency
        }
      });
    });
  }

  public init(channel: string) {
    // Return existing channel if already subscribed
    if (this.channels.has(channel)) {
      return this.channels.get(channel);
    }
    
    const channelInstance = this.pusher.subscribe(channel);
    this.channels.set(channel, channelInstance);
    return channelInstance;
  }
  
  public unsubscribe(channel: any) {
    if (channel) {
      const channelName = typeof channel === 'string' ? channel : channel.name;
      if (this.channels.has(channelName)) {
        this.channels.get(channelName).unbind_all();
        this.pusher.unsubscribe(channelName);
        this.channels.delete(channelName);
      } else {
        channel.unbind_all();
        this.pusher.unsubscribe(channel.name);
      }
    }
  }
}