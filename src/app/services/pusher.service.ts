import { Injectable } from '@angular/core';
import Pusher from 'pusher-js';
import { Subject } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class PusherService {
  private pusher: Pusher;
  
  
  public onUpdate = new Subject<any>();
  private lastRfidEvent: {rfid: string, time: number, channel?: string} = {rfid: '', time: 0};
  
  constructor() {
    this.pusher = new Pusher(environment.pusher.key, {
      cluster: environment.pusher.cluster,
      forceTLS: true,
      enabledTransports: ['ws', 'wss'],
      disabledTransports: ['xhr_streaming', 'xhr_polling'],
      disableStats: true,
      activityTimeout: 60000,
      pongTimeout: 30000
    });
    
    this.setupEmergencyListener();
  }
  
  private setupEmergencyListener() {
    console.log('🔧 Pusher: Setting up EMERGENCY listeners...');
    const emergencyChannel = this.pusher.subscribe('rfid-emergency-bypass');
    emergencyChannel.bind('rfid-urgent', (data: any) => {
      const now = Date.now();
      const sentAt = data._sentAt || data.timestamp;
      const latency = sentAt ? now - sentAt : 0;
      
      if (data.rfid && this.lastRfidEvent.rfid === data.rfid && 
          (now - this.lastRfidEvent.time) < 2000) {
        console.log(`⏭️ Skipping duplicate RFID: ${data.rfid} (${now - this.lastRfidEvent.time}ms ago)`);
        return;
      }
      
      this.lastRfidEvent = {rfid: data.rfid, time: now, channel: 'rfid-emergency-bypass'};
      
      console.log(`⚡ RFID EMERGENCY: ${latency}ms - ${data.rfid}`);
      
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
          _sentAt: sentAt
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
}
