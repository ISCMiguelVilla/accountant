import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

const AUTH_PATH = `${environment.apiUrl}/auth/`;

/**
 * Adds the bearer token to API calls and, when the API answers 401 to an authenticated call
 * (expired token, disabled user), ends the session and sends the user to sign-in.
 */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const isApi = request.url.startsWith(`${environment.apiUrl}/`);
  const isAuthEndpoint = request.url.startsWith(AUTH_PATH);
  const token = isApi && !isAuthEndpoint ? auth.token() : null;

  const authorized = token
    ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : request;

  return next(authorized).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401 && isApi && !isAuthEndpoint) {
        auth.signOut(router.url.startsWith('/sign-in') ? undefined : router.url);
      }
      return throwError(() => error);
    }),
  );
};
