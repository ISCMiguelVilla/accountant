/**
 * Single money utility of the frontend. Every calculation is done in integer cents; decimals are only
 * used to display values or to send them to the API.
 */
export type Cents = number;

/** Parses an API/user decimal (number or string) into integer cents, rounding half up on the 3rd decimal. */
export function toCents(value: number | string | null | undefined): Cents {
  if (value === null || value === undefined || value === '') {
    return 0;
  }
  const text = typeof value === 'number' ? numberToPlainString(value) : value.trim();
  const match = /^([+-])?(\d*)(?:\.(\d*))?$/.exec(text);
  if (!match) {
    throw new Error(`Invalid amount: ${String(value)}`);
  }
  const [, sign, integerPart = '', fractionPart = ''] = match;
  const digits = (fractionPart + '000').slice(0, 3);
  let cents = Number(integerPart || '0') * 100 + Number(digits.slice(0, 2));
  if (Number(digits[2]) >= 5) {
    cents += 1;
  }
  return sign === '-' && cents !== 0 ? -cents : cents;
}

/** Cents to a decimal number with 2 decimals (for the API / numeric inputs). */
export function fromCents(cents: Cents): number {
  return Math.round(cents) / 100;
}

/** Formats an amount for display: `1,234.50` plus the currency code label when given. */
export function formatAmount(
  value: number | string | null | undefined,
  locale: string,
  currencyCode?: string | null,
): string {
  if (value === null || value === undefined || value === '') {
    return '—';
  }
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(fromCents(toCents(value)));
  return currencyCode ? `${formatted} ${currencyCode}` : formatted;
}

function numberToPlainString(value: number): string {
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid amount: ${value}`);
  }
  // Avoid exponent notation for very small/large numbers.
  return Math.abs(value) < 1e-6 ? '0' : value.toFixed(10).replace(/0+$/, '').replace(/\.$/, '');
}
