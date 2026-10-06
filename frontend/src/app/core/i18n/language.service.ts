import { DOCUMENT } from '@angular/common';
import { Injectable, computed, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { PrimeNG } from 'primeng/config';
import { Observable, map, tap } from 'rxjs';
import { readStorage, writeStorage } from '../storage/local-storage';
import {
  ANGULAR_LOCALES,
  DATE_FNS_LOCALES,
  DEFAULT_LANGUAGE,
  Language,
  resolveLanguage,
} from './language';

const STORAGE_KEY = 'accountant:language';

/**
 * Owns the active UI language. Switching it updates ngx-translate, PrimeNG component texts,
 * the Angular locale used by pipes and the date-fns locale, without reloading the page.
 */
@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly translate = inject(TranslateService);
  private readonly primeng = inject(PrimeNG);
  private readonly document = inject(DOCUMENT);

  private readonly current = signal<Language>(this.initialLanguage());

  readonly language = this.current.asReadonly();
  /** Angular locale id (`es-MX` / `en-US`) to pass to date/number/currency pipes. */
  readonly locale = computed(() => ANGULAR_LOCALES[this.current()]);
  readonly dateFnsLocale = computed(() => DATE_FNS_LOCALES[this.current()]);

  /**
   * Initial language: user preference (once signed in) → localStorage → browser → Spanish.
   * The user preference is applied later through {@link use}.
   */
  initialLanguage(): Language {
    return resolveLanguage(readStorage(STORAGE_KEY), this.document.defaultView?.navigator.language);
  }

  init(): Observable<void> {
    this.translate.setFallbackLang(DEFAULT_LANGUAGE);
    return this.use(this.current());
  }

  use(language: Language): Observable<void> {
    return this.translate.use(language).pipe(
      tap(() => {
        this.current.set(language);
        writeStorage(STORAGE_KEY, language);
        this.document.documentElement.lang = language;
        this.primeng.setTranslation(this.translate.instant('primeng'));
      }),
      map(() => undefined),
    );
  }
}
