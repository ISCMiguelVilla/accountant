import en from '../../../../public/i18n/en.json';
import es from '../../../../public/i18n/es.json';

/** Flattens a translation object into dotted keys (arrays count as leaf values). */
function flattenKeys(value: unknown, prefix = ''): string[] {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return [prefix];
  }
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    flattenKeys(child, prefix ? `${prefix}.${key}` : key),
  );
}

describe('i18n files', () => {
  it('es.json and en.json define exactly the same keys', () => {
    const esKeys = flattenKeys(es).sort();
    const enKeys = flattenKeys(en).sort();

    expect(esKeys.filter((key) => !enKeys.includes(key))).toEqual([]);
    expect(enKeys.filter((key) => !esKeys.includes(key))).toEqual([]);
  });

  it('has no empty translations', () => {
    for (const [name, file] of Object.entries({ es, en })) {
      const empty = flattenKeys(file).filter((key) => {
        const value = key
          .split('.')
          .reduce<unknown>((node, part) => (node as Record<string, unknown>)[part], file);
        return value === '';
      });
      expect(empty, `empty keys in ${name}.json`).toEqual([]);
    }
  });
});
