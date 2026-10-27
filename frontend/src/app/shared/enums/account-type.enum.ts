export const ACCOUNT_TYPES = [
  'GROUP',
  'SUPPLIER',
  'STORAGE',
  'CONSUMER',
  'BUSINESS',
  'INVESTMENT',
  'CREDITOR',
  'DEBTOR',
] as const;

export type AccountType = (typeof ACCOUNT_TYPES)[number];

/** Types without balance (GROUP, SUPPLIER, CONSUMER) store `null`. */
export function hasBalance(type: AccountType): boolean {
  return type !== 'GROUP' && type !== 'SUPPLIER' && type !== 'CONSUMER';
}

/** Sub-account types each type accepts (mirrors the backend rule). */
export const ALLOWED_CHILDREN: Record<AccountType, readonly AccountType[]> = {
  GROUP: ACCOUNT_TYPES,
  SUPPLIER: ['SUPPLIER'],
  STORAGE: ['STORAGE', 'INVESTMENT', 'DEBTOR'],
  CONSUMER: ['CONSUMER'],
  BUSINESS: ['STORAGE', 'INVESTMENT'],
  INVESTMENT: ['INVESTMENT'],
  CREDITOR: ['CREDITOR'],
  DEBTOR: ['DEBTOR'],
};

export function canBeTemporary(type: AccountType): boolean {
  return type === 'INVESTMENT' || type === 'BUSINESS';
}

/** Type changes allowed even with sub-accounts or transactions. */
export function freeTypeChanges(type: AccountType): AccountType[] {
  return type === 'STORAGE' || type === 'INVESTMENT' ? ['STORAGE', 'INVESTMENT'] : [type];
}
