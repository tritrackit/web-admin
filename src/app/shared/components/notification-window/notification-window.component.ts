import { EmployeeUsers } from 'src/app/model/employee-users.model';
import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';
import * as moment from 'moment';
import { StorageService } from 'src/app/services/storage.service';

@Component({
  selector: 'app-notification-window',
  templateUrl: './notification-window.component.html',
  styleUrls: ['./notification-window.component.scss'],
  host: {
    '[class.className]' : 'className',
    '[class]' : 'classNames'
  }
})
export class NotificationWindowComponent {
  @Input() isOpen = false;
  className: boolean;
  notifcations: Notification[] = [];
  pageIndex = 0;
  pageSize = 10;
  total = 0;
  order: any = { notificationId: "DESC" };
  profile: EmployeeUsers;
  @Output() readNotif = new EventEmitter();
  constructor(
    private sorageService: StorageService) {
      this.profile = this.sorageService.getLoginProfile();
  }
  get classNames () {
    return this.isOpen ? "open notification-window" : "notification-window"
  };

  ngOnInit(): void {
  }
  loadNotifcations() {
    // this.notificationsService.getByAdvanceSearch({
    //   order: this.order,
    //   columnDef: [{
    //     apiNotation: "user.userId",
    //     filter: this.profile.staffUserId,
    //     type: "precise"
    //   } as any],
    //   pageIndex: this.pageIndex,
    //   pageSize: this.pageSize
    // }).subscribe(res=> {
    //   this.notifcations = this.pageIndex > 0 ? [...this.notifcations, ...res.data.results] : res.data.results;
    //   this.total = res.data.total;
    // });
  }

  loadMore() {
    this.pageIndex = this.pageIndex + 1;
    this.loadNotifcations();
  }
  toggle() {
    this.isOpen = !this.isOpen;
    if(this.isOpen) {
      this.loadNotifcations();
    }
  }
  @HostListener('window:click', ['$event'])
  onClick(event?) {
    if((event.target as Element).classList.contains("notification-window")) {
      this.toggle();
    }
  }

  dateAgo(value) {
    if (value) {
        const seconds = Math.floor((+new Date() - +new Date(value)) / 1000);
        if (seconds < 29) // less than 30 seconds ago will show as 'Just now'
            return 'Just now';
        const intervals: { [key: string]: number } = {
            'year': 31536000,
            'month': 2592000,
            'week': 604800,
            'day': 86400,
            'hour': 3600,
            'minute': 60,
            'second': 1
        };
        let counter;
        for (const i in intervals) {
            counter = Math.floor(seconds / intervals[i]);
            if (counter > 0)
                if (counter === 1) {
                    return counter + ' ' + i + ' ago'; // singular (1 day ago)
                } else {
                    return counter + ' ' + i + 's ago'; // plural (2 days ago)
                }
        }
    }
    return value;
  }

  // async onNotificationItemClick(notification: Notification) {
  //   notification.isRead = true;
  //   await this.notificationsService.marAsRead(notification.notificationId).toPromise();
  //   this.readNotif.emit();
  //   // window.open("http://www.google.com/");
  //   if(notification.type === "RESERVATION") {
  //     window.open(`/reservation/${notification.referenceId}/details`);
  //   } else if(notification.type === "WORK_ORDER") {
  //     window.open(`/work-order/${notification.referenceId}/details`);
  //   } else {
  //     window.open(`/map`);
  //   }
  // }

}
