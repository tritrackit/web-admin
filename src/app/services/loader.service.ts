import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class LoaderService {

  private data = new BehaviorSubject({});
  data$ = this.data.asObservable();

  constructor() { }
  show() {
    this.data.next({ show: true});
  }
  hide() {
    this.data.next({ show: false});
  }
}
