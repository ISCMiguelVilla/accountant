import { registerLocaleData } from '@angular/common';
import localeEnUs from '@angular/common/locales/en';
import localeEsMx from '@angular/common/locales/es-MX';
import {
  EnvironmentProviders,
  LOCALE_ID,
  Provider,
  inject,
  provideAppInitializer,
} from '@angular/core';
import { provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { DEFAULT_LANGUAGE } from './language';
import { LanguageService } from './language.service';

registerLocaleData(localeEsMx, 'es-MX');
registerLocaleData(localeEnUs, 'en-US');

export function provideI18n(): (Provider | EnvironmentProviders)[] {
  return [
    provideTranslateService({
      fallbackLang: DEFAULT_LANGUAGE,
      loader: provideTranslateHttpLoader({ prefix: 'i18n/', suffix: '.json' }),
    }),
    // Default locale for pipes used without an explicit locale; language-aware
    // components pass LanguageService.locale() so they follow hot language switches.
    { provide: LOCALE_ID, useFactory: () => inject(LanguageService).locale() },
    provideAppInitializer(() => inject(LanguageService).init()),
  ];
}
