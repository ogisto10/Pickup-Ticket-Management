import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { MessageService } from 'primeng/api';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const messageService = inject(MessageService);
  const token = authService.token();

  const request = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(request).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !req.url.includes('/auth/login')) {
        authService.logout();
        messageService.add({
          severity: 'warn',
          summary: 'Session Expired',
          detail: 'Please sign in again.'
        });
      } else if (error.status === 403) {
        messageService.add({
          severity: 'error',
          summary: 'Access Denied',
          detail: 'You are not authorized to perform this action.'
        });
      }
      return throwError(() => error);
    })
  );
};
