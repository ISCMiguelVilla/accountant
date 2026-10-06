import { resolveLanguage } from './language';

describe('resolveLanguage', () => {
  it('returns the first supported candidate', () => {
    expect(resolveLanguage(null, 'en-US', 'es')).toBe('en');
  });

  it('normalizes browser locales', () => {
    expect(resolveLanguage('ES-mx')).toBe('es');
  });

  it('skips unsupported languages', () => {
    expect(resolveLanguage('fr-FR', 'en')).toBe('en');
  });

  it('falls back to Spanish', () => {
    expect(resolveLanguage(undefined, 'de-DE')).toBe('es');
  });
});
