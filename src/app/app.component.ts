import { Component, TemplateRef, ViewChild } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { Router, ResolveEnd, ActivatedRouteSnapshot, NavigationCancel, NavigationEnd, NavigationError, NavigationStart, RouterEvent } from '@angular/router';
import { filter } from 'rxjs';
import { RouteService } from './services/route.service';
import { AppConfigService } from './services/app-config.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { StorageService } from './services/storage.service';
import { LoaderService } from './services/loader.service';
import { AuthService } from './services/auth.service';
@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  title;
  grantNotif = false;
  showLoader = false;
  countdown = 10;
  interval: any;

  @ViewChild('idleTimeoutDialog') idleTimeoutDialogTemp: TemplateRef<any>;


  constructor(
    private titleService:Title,
    private router: Router,
    private snackBar:MatSnackBar,
    private appconfig: AppConfigService,
    private storageService: StorageService,
    private routeService: RouteService,
    private authService: AuthService,
    private loaderService: LoaderService) {
      if(this.storageService.getLoginProfile()?.employeeUserId) {
        const { employeeUserId } = this.storageService.getLoginProfile();
      }
    this.setupTitleListener();
  }
  ngOnInit(): void {
    this.loaderService.data$.subscribe((res: { show: boolean }) => {
      if(res.show) {
        this.showLoader = true;
      } else {
        this.showLoader = false;
      }
    })
  }
  private setupTitleListener() {
    this.router.events.pipe(filter(e => e instanceof ResolveEnd)).subscribe((e: any) => {
      const { data } = this.getDeepestChildSnapshot(e.state.root);
      this.routeService.changeData(data);
      if(data?.['title']){
        this.title = data['title'];
        this.titleService.setTitle(`${this.title} | ${this.appconfig.config.appName}`);
      }
      this.navigationInterceptor(e);
    });
  }

  getDeepestChildSnapshot(snapshot: ActivatedRouteSnapshot) {
    let deepestChild = snapshot.firstChild;
    while (deepestChild?.firstChild) {
      deepestChild = deepestChild.firstChild
    };
    return deepestChild || snapshot
  }
  // Shows and hides the loading spinner during RouterEvent changes
  navigationInterceptor(event: RouterEvent): void {
    if (event instanceof NavigationStart) {
      this.loaderService.show();
    }
    if (event instanceof NavigationEnd) {
      this.loaderService.hide();
    }

    // Set loading state to false in both of the below events to hide the spinner in case a request fails
    if (event instanceof NavigationCancel) {
      this.loaderService.hide();
    }
    if (event instanceof NavigationError) {
      this.loaderService.hide();
    }
  }
}
