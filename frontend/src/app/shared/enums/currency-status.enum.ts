export const CURRENCY_STATUSES = ['ACTIVE', 'DISABLED'] as const;

export type CurrencyStatus = (typeof CURRENCY_STATUSES)[number];
