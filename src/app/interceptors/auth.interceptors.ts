import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
  HttpResponse,
  HttpErrorResponse,
  HttpContextToken
} from '@angular/common/http';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { map, catchError, filter, switchMap, take } from 'rxjs/operators';
import {
  Router
} from '@angular/router';
import { AuthService } from '../services/auth.service';
import { StorageService } from '../services/storage.service';
export const BYPASS_LOG = new HttpContextToken(() => false);
@Injectable()
export class AuthInterceptor implements HttpInterceptor {

  private isRefreshing = false;
  private refreshTokenSubject: BehaviorSubject<any> = new BehaviorSubject<any>(null);
  constructor(
    private router: Router,
    private storageService: StorageService,
    private authService: AuthService) {
    }

  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {

    if (request.context.get(BYPASS_LOG) === true){
      return next.handle(request);
    }
    const token = this.storageService.getAccessToken();

    if (token) {
      request = this.addTokenHeader(request, token);
    }

    if (!request.headers.has('Content-Type')) {
      request = request.clone({
        setHeaders: {
          'content-type': 'application/json'
        }
      });
    }

    if(request.responseType === 'json') {
      request = request.clone({
        headers: request.headers.set('Accept', 'application/json')
      });
    }
    return next.handle(request).pipe(catchError(error => {
      if (error instanceof HttpErrorResponse && !request.url.includes('auth/signin') && error.status === 401) {
        return this.handle401Error(request, next);
      }
      return throwError(error);
    }));
  }

  private handle401Error(request: HttpRequest<any>, next: HttpHandler) {
    if (!this.isRefreshing) {
      this.isRefreshing = true;
      this.refreshTokenSubject.next(null);
      const refreshToken = this.storageService.getRefreshToken();
      const {employeeUserId} = this.storageService.getLoginProfile();
      if (refreshToken || refreshToken === undefined || refreshToken !== 'null')
        return this.authService.refreshToken({employeeUserId, refresh_token:refreshToken}).pipe(
          switchMap((token: any) => {
            this.isRefreshing = false;
            this.storageService.saveAccessToken(token.accessToken);
            this.storageService.saveRefreshToken(token.refreshToken);
            this.refreshTokenSubject.next(token.accessToken);

            return next.handle(this.addTokenHeader(request, token.accessToken));
          }),
          catchError((error) => {
            this.isRefreshing = false;
            if ((error.error.success !== undefined || error.error.success !== null ) && error.error.success === false) {
            } else {
              this.handleLogout();
            }
            return throwError(error);
          })
        );
        else{
          this.handleLogout();
          this.isRefreshing = false;
        }
    }
    return this.refreshTokenSubject.pipe(
      filter(token => token !== null),
      take(1),
      switchMap((token) => next.handle(this.addTokenHeader(request, token)))
    );
  }

  private addTokenHeader(request: HttpRequest<any>, token: string){
    request = request.clone({
      setHeaders: {
        // eslint-disable-next-line quote-props, @typescript-eslint/naming-convention
        'Authorization': 'Bearer ' + token
      }
    });
    return request;
  }

  private handleLogout(){
    this.authService.logout();
  }

}
