import { provideHttpClient, withFetch } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { providePrimeNG } from 'primeng/config';
import { routes } from './app.routes';
import { provideI18n } from './core/i18n/i18n.providers';
import { AccountantPreset, DARK_MODE_CLASS } from './core/theme/accountant-preset';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withFetch()),
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
