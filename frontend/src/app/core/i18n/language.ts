import { enUS, es } from 'date-fns/locale';
import type { Locale } from 'date-fns';

export const LANGUAGES = ['es', 'en'] as const;

export type Language = (typeof LANGUAGES)[number];

export const DEFAULT_LANGUAGE: Language = 'es';

/** Angular locale id used by date/number/currency pipes for each language. */
export const ANGULAR_LOCALES: Record<Language, string> = {
  es: 'es-MX',
  en: 'en-US',
};

export const DATE_FNS_LOCALES: Record<Language, Locale> = {
  es,
  en: enUS,
};

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);
}

/** Picks the first supported language among the candidates, falling back to Spanish. */
export function resolveLanguage(...candidates: (string | null | undefined)[]): Language {
  for (const candidate of candidates) {
    const normalized = candidate?.slice(0, 2).toLowerCase();
    if (isLanguage(normalized)) {
      return normalized;
    }
  }
  return DEFAULT_LANGUAGE;
}
