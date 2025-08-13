import { Component, HostListener } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { EmployeeUsers } from 'src/app/model/employee-users.model';
import { AuthService } from 'src/app/services/auth.service';
import { NotificationsService } from 'src/app/services/notifications.service';
import { RouteService } from 'src/app/services/route.service';
import { StorageService } from 'src/app/services/storage.service';
import { AlertDialogModel } from 'src/app/shared/components/alert-dialog/alert-dialog-model';
import { AlertDialogComponent } from 'src/app/shared/components/alert-dialog/alert-dialog.component';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss'],
  host: {
    class: "component-wrapper"
  }
})
export class ProfileComponent {
  appName = "";
  title = "";
  loading = false;
  profile: EmployeeUsers;
  drawerDefaultOpened = false;
  details = false;
  _unReadNotificationCount = 0;
  profileLoaded = false;

  constructor(private notificationsService: NotificationsService,
    private authService: AuthService,
    private routeService: RouteService,
    private storageService: StorageService,
    private dialog: MatDialog) {
      this.profile = this.storageService.getLoginProfile();
      this.onResize();
      this.routeService.data$.subscribe((res: { title: string; admin: boolean; details: boolean }) => {
        this.title = res.title;
        this.details = res.details;
      });
  }
  async ngOnInit(): Promise<void> {
    // await this.getNotifCount();
  }

  get unReadNotificationCount() {
    return this._unReadNotificationCount;
  }

  async getNotifCount() {
    const   res = await this.notificationsService.getUnreadByUser(this.profile.employeeUserId).toPromise();
    this.storageService.saveUnreadNotificationCount(res.data);
    let count = this.storageService.getUnreadNotificationCount();
    if(!isNaN(Number(count))) {
      this._unReadNotificationCount = Number(count);
    } else if(count && isNaN(Number(count))) {
      this._unReadNotificationCount = 0;
    } else {
      this._unReadNotificationCount = 0
    }
  }


  onActivate(event) {
    this.onResize();
  }


  signOut() {
    const dialogData = new AlertDialogModel();
    dialogData.title = 'Confirm';
    dialogData.message = 'Are you sure you want to logout?';
    dialogData.confirmButton = {
      visible: true,
      text: 'yes',
      color: 'primary',
    };
    dialogData.dismissButton = {
      visible: true,
      text: 'cancel',
    };
    const dialogRef = this.dialog.open(AlertDialogComponent, {
      maxWidth: '400px',
      closeOnNavigation: true,
    });

    dialogRef.componentInstance.alertDialogConfig = dialogData;
    dialogRef.componentInstance.conFirm.subscribe(async (confirmed: any) => {
      const profile = this.storageService.getLoginProfile();
      this.storageService.saveLoginProfile(null);
      this.authService.redirectToPage(true)
      dialogRef.close();
    });
  }

  @HostListener('window:resize', ['$event'])
  onResize(event?) {
    if(window.innerWidth >= 960) {
      this.drawerDefaultOpened = true;
    } else {
      this.drawerDefaultOpened = false;
    }
  }
}
