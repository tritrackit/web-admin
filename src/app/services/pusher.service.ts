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
      forceTLS: environment.production
    });
    
    // 🔥 LISTEN TO THE SAME CHANNEL AS BACKEND: 'all' channel with 'reSync' event
    // Backend sends: pusherService.reSync('units', { rfid, action, location, status, ... })
    // Which triggers: channel 'all', event 'reSync', payload: { type: 'units', data: {...} }
    const globalChannel = this.pusher.subscribe('all');
    
    // Listen for reSync events (this is what the backend actually sends)
    globalChannel.bind('reSync', (payload: any) => {
      console.log('📡 Pusher: reSync event received', payload);
      
      // Backend sends: { type: 'units', data: { rfid, action, location, status, ... } }
      // OR batched: { type: 'units', data: { action: 'BATCH_UPDATE', updates: [...], count: N } }
      if (payload && payload.type === 'units') {
        console.log('📡 Unit update detected via reSync, triggering refresh...', payload.data);
        this.onUpdate.emit(payload);
      }
    });
    
    // 🔥 CRITICAL: Listen to registration-channel for immediate registration events
    // Backend sends: sendRegistrationEventImmediate() -> 'registration-channel' with 'new-registration' event
    const registrationChannel = this.pusher.subscribe('registration-channel');
    registrationChannel.bind('new-registration', (data: any) => {
      console.log('📡 Pusher: New registration event received (immediate)', data);
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
          scannerType: data.scannerType
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