import { ChangeDetectorRef, Component, HostListener } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Title } from '@angular/platform-browser';
import { Router, ActivatedRoute } from '@angular/router';
import { filter } from 'rxjs';
import { AccessPages } from 'src/app/model/roles.model';
import { EmployeeUsers } from 'src/app/model/employee-users.model';
import { AppConfigService } from 'src/app/services/app-config.service';
import { AuthService } from 'src/app/services/auth.service';
import { DashboardService } from 'src/app/services/dashboard.service';
import { IdleTimeoutService } from 'src/app/services/idle-timeout.service';
import { LoaderService } from 'src/app/services/loader.service';
import { NotificationsService } from 'src/app/services/notifications.service';
import { PusherService } from 'src/app/services/pusher.service';
import { RouteService } from 'src/app/services/route.service';
import { StorageService } from 'src/app/services/storage.service';
import { AlertDialogModel } from 'src/app/shared/components/alert-dialog/alert-dialog-model';
import { AlertDialogComponent } from 'src/app/shared/components/alert-dialog/alert-dialog.component';

@Component({
  selector: 'app-features',
  templateUrl: './features.component.html',
  styleUrls: ['./features.component.scss'],
  host: {
    class: "component-wrapper"
  }
})
export class FeaturesComponent {
  appName = "";
  title = "";
  loading = false;
  drawerDefaultOpened = false;
  details = false;
  profile: EmployeeUsers;
  currentGroup;
  disableGroupAnimation = true;
  _unReadNotificationCount: number = 0;
  profileLoaded = false;
  showMaintenanceButton = false;
  maintenanceBadgeCount = 0;
  pageRights = {}
  
  constructor(
    private loaderService: LoaderService,
    private titleService: Title,
    private authService: AuthService,
    private dashboardService: DashboardService,
    private notificationsService: NotificationsService,
    private storageService: StorageService,
    private dialog: MatDialog,
    private router: Router,
    private route: ActivatedRoute,
    private routeService: RouteService,
    private pusher: PusherService,
    private cdr: ChangeDetectorRef,
    private idleTimeoutService: IdleTimeoutService,
  ) {
    this.profile = this.storageService.getLoginProfile();
    if (this.profile && this.profile.userName) {
    }

    console.log(this.route.snapshot.data);
    this.onResize();
    this.routeService.data$.subscribe((res: { title: string; admin: boolean; details: boolean; access: AccessPages; group: string }) => {
      this.title = res.title;
      this.currentGroup = res.group;
      this.details = res.details;
    });
    const logsChannel = this.pusher.init(`room`);

    logsChannel.bind('maintenance', data => {
      console.log('maintenance:', data);
      this.getMaintenanceBadgeCount();
    });
  }
  async ngOnInit(): Promise<void> {
    this.idleTimeoutService.startWatching();
    await this.getNotifCount();
    this.getMaintenanceBadgeCount();
  }

  get unReadNotificationCount() {
    return this._unReadNotificationCount;
  }

  async getNotifCount() {
    const res = await this.notificationsService.getUnreadByUser(this.profile.employeeUserId).toPromise();
    this.storageService.saveUnreadNotificationCount(res.data);
    let count = this.storageService.getUnreadNotificationCount();
    if (!isNaN(Number(count))) {
      this._unReadNotificationCount = Number(count);
    } else if (count && isNaN(Number(count))) {
      this._unReadNotificationCount = 0;
    } else {
      this._unReadNotificationCount = 0
    }

  }

  onActivate(event) {
    this.currentGroup = event?.route?.snapshot?.data["group"] && event?.route?.snapshot?.data["group"] !== undefined ? event?.route?.snapshot?.data["group"] : null;
    this.onResize();
  }

  expand(group = "") {
    return this.currentGroup?.toLowerCase() === group.toLowerCase();
  }

  showGroupMenu(pages = []) {
    return this.profile && this.profile.role && this.profile?.role?.accessPages?.some(x => pages.some(p => p.toLowerCase() === x.page.toLowerCase()) && x.view === true);
  }

  showMenu(page: string) {
    return this.profile && this.profile.role && this.profile?.role?.accessPages?.some(x => x.page.toLowerCase() === page.toLowerCase() && x.view === true);
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

  async getMaintenanceBadgeCount() {
    const rights = this.profile.role.accessPages.some(x=>x.page.trim().toUpperCase() === "MAINTENANCE") ? this.profile.role.accessPages.find(x=>x.page.trim().toUpperCase() === "MAINTENANCE").rights : [];
    console.log(rights);
    if(rights.includes("Assign")) {
      const dashboard = await this.dashboardService.getDashboardSummary().toPromise();
      this.maintenanceBadgeCount = dashboard.data?.totalMaintenance || 0;
      this.cdr.detectChanges();
    } else {
      const dashboard = await this.dashboardService.getDashboardSummary(this.profile?.employeeUserId).toPromise();
      this.maintenanceBadgeCount = dashboard.data?.totalMaintenance || 0;
      this.cdr.detectChanges();
    }
  }

  @HostListener('window:resize', ['$event'])
  onResize(event?) {
    if (window.innerWidth >= 960) {
      this.drawerDefaultOpened = true;
      this.showMaintenanceButton = false
    } else {
      this.drawerDefaultOpened = false;
      this.showMaintenanceButton = true
    }
  }

  onSidenavToggle(event) {
    this.showMaintenanceButton = !event
  }

  ngOnDestroy(): void {
    this.idleTimeoutService.stopWatching();
  }
}
