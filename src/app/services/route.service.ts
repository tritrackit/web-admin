import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class RouteService {

  private data = new BehaviorSubject({});
  data$ = this.data.asObservable();

  constructor() { }
  changeData(data: any) {
    this.data.next(data)
  }
}
