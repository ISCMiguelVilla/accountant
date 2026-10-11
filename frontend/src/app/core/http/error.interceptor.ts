import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { toApiProblem } from '../../shared/models/api-problem.model';
import { ErrorNotifier } from './error-notifier.service';
import { SKIP_ERROR_TOAST } from './http-context';

/**
 * Shows a translated toast for every failed API call, unless the request opted out with
 * {@link SKIP_ERROR_TOAST}. 401 is left to the auth interceptor (redirect to sign-in).
 */
export const errorInterceptor: HttpInterceptorFn = (request, next) => {
  const notifier = inject(ErrorNotifier);
  return next(request).pipe(
    catchError((error: unknown) => {
      const problem = toApiProblem(error);
      if (!request.context.get(SKIP_ERROR_TOAST) && problem.status !== 401) {
        notifier.notify(problem);
      }
      return throwError(() => error);
    }),
  );
};
