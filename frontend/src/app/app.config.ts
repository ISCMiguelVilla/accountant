import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding, withRouterConfig } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { providePrimeNG } from 'primeng/config';
import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { errorInterceptor } from './core/http/error.interceptor';
import { provideI18n } from './core/i18n/i18n.providers';
import { AccountantPreset, DARK_MODE_CLASS } from './core/theme/accountant-preset';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      // Child routes (e.g. accounts/:id/edit) receive the parent params as inputs.
      withRouterConfig({ paramsInheritanceStrategy: 'always' }),
    ),
    // Order matters: the auth interceptor sees the response first (401 → sign-in).
    provideHttpClient(withFetch(), withInterceptors([errorInterceptor, authInterceptor])),
    providePrimeNG({
      ripple: true,
      theme: {
        preset: AccountantPreset,
        options: {
          darkModeSelector: `.${DARK_MODE_CLASS}`,
          // PrimeNG styles sit between Tailwind's base and utilities, so utilities win.
          cssLayer: { name: 'primeng', order: 'theme, base, primeng' },
        },
      },
    }),
    MessageService,
    ConfirmationService,
    ...provideI18n(),
  ],
};
