
import { Injectable } from '@angular/core';
import Pusher from 'pusher-js';
import { environment } from 'src/environments/environment';


@Injectable()
export class PusherService {
  constructor() {
  // Replace this with your pusher key
    this.pusher = new Pusher(environment.pusher.key, {
      cluster: environment.pusher.cluster,
      forceTLS: environment.production
    });
  }
  pusher;

  public init(channel) {
    return this.pusher.subscribe(channel);
  }
  public unsubscribe(channel) {
    channel.unbind_all();
    this.pusher.unsubscribe(channel.name);
  }
}
