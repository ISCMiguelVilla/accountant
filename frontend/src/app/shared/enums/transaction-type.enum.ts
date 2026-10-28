export const TRANSACTION_TYPES = [
  'INCOME',
  'EXPENSE',
  'TRANSFER',
  'INVEST',
  'PROFIT',
  'DIVIDEND',
  'INTEREST',
  'BORROW',
  'COLLECTION',
  'DEBT',
  'PAYMENT',
] as const;

export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const OPERATION_TYPES = ['ADDITION', 'SUBTRACTION', 'NEUTER'] as const;

export type OperationType = (typeof OPERATION_TYPES)[number];

export type DestinationMode = 'REQUIRED' | 'OPTIONAL' | 'NONE';
