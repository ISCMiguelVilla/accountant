import { formatAmount, fromCents, toCents } from './money';

describe('money', () => {
  it('parses decimals into integer cents without floating point drift', () => {
    expect(toCents('1234.56')).toBe(123456);
    expect(toCents(0.1 + 0.2)).toBe(30);
    expect(toCents(1.005)).toBe(101);
    expect(toCents('10')).toBe(1000);
    expect(toCents('.5')).toBe(50);
    expect(toCents(-12.345)).toBe(-1235);
    expect(toCents(null)).toBe(0);
  });

  it('rejects malformed amounts', () => {
    expect(() => toCents('12,50')).toThrow();
    expect(() => toCents(Number.NaN)).toThrow();
  });

  it('converts back to a 2 decimal number', () => {
    expect(fromCents(123456)).toBe(1234.56);
    expect(fromCents(toCents('0.07'))).toBe(0.07);
  });

  it('formats per locale with the currency code as label', () => {
    expect(formatAmount('1234.5', 'en-US', 'MXN')).toBe('1,234.50 MXN');
    expect(formatAmount(1234.5, 'es-MX')).toBe('1,234.50');
    expect(formatAmount(null, 'en-US')).toBe('—');
  });
});
