import { AccountStatus } from '../enums/account-status.enum';
import { AccountType } from '../enums/account-type.enum';
import { DestinationMode, OperationType, TransactionType } from '../enums/transaction-type.enum';
import { AccountRef, Credit } from './account.model';
import { CurrencyOption } from './currency.model';

/** Usable account for the batch editor (`GET /accounts/options`): the pristine base of the projection. */
export interface AccountOption {
  id: number;
  name: string;
  type: AccountType;
  status: AccountStatus;
  parentId: number | null;
  balance: number | null;
  currency: CurrencyOption;
  icon: string | null;
  color: string | null;
  temporary: boolean;
  version: number;
  /** Last persisted transaction of the account: the minimum date allowed. */
  lastOperationDate: string | null;
  credit: Credit | null;
}

/** One origin / destination combination of a type (`destination` null = no destination). */
export interface TransactionVariant {
  origin: AccountType;
  destination: AccountType | null;
  operationType: OperationType;
  feeEnabled: boolean;
  feeMustBeBelowAmount: boolean;
}

export interface TransactionTypeRule {
  type: TransactionType;
  origins: AccountType[];
  destinations: AccountType[];
  destinationMode: DestinationMode;
  pendingAllowed: boolean;
  variants: TransactionVariant[];
}

/** `GET /transactions/rules`: the single definition of the rule matrix. */
export interface TransactionRules {
  types: TransactionTypeRule[];
}

export interface Transaction {
  id: number;
  uuid: string;
  batchUuid: string;
  scheduleId: number | null;
  type: TransactionType;
  operationType: OperationType;
  origin: AccountRef;
  destination: AccountRef | null;
  currency: CurrencyOption;
  amount: number;
  fee: number;
  description: string;
  originBalanceBefore: number | null;
  originBalanceAfter: number | null;
  destinationBalanceBefore: number | null;
  destinationBalanceAfter: number | null;
  applied: boolean;
  operationDate: string;
  appliedAt: string | null;
  createdAt: string;
}

export interface TransactionRequest {
  uuid: string;
  type: TransactionType;
  originAccountId: number;
  destinationAccountId: number | null;
  amount: number;
  fee: number;
  description: string;
  applied: boolean;
  operationDate: string;
  scheduleId: number | null;
}

export interface BatchRequest {
  transactions: TransactionRequest[];
  /** Account id → version the draft was computed with (CONFLICT if any changed). */
  accountVersions: Record<number, number>;
}

export interface BatchResponse {
  batchUuid: string;
  transactions: Transaction[];
}
