import { AccountStatus } from '../enums/account-status.enum';
import { AccountType } from '../enums/account-type.enum';
import { CurrencyOption } from './currency.model';

/** Decimals come from the API as numbers with 2 decimals; convert with `toCents` before calculating. */
export interface Credit {
  creditLimit: number;
  cutOffCron: string;
  paymentDueCron: string;
  /** Next cut-off date (yyyy-MM-dd, ≥ today). */
  cutOffDay: string;
  /** Next payment due date (yyyy-MM-dd, ≥ today). */
  paymentDueDay: string;
  availableCredit: number;
  usagePercentage: number;
}

export interface CreditRequest {
  creditLimit: number;
  cutOffCron: string;
  paymentDueCron: string;
}

export interface AccountRef {
  id: number;
  name: string;
  type: AccountType;
}

export interface Account {
  id: number;
  name: string;
  type: AccountType;
  status: AccountStatus;
  balance: number | null;
  currency: CurrencyOption;
  parent: AccountRef | null;
  icon: string | null;
  color: string | null;
  includeInBalance: boolean;
  temporary: boolean;
  version: number;
  credit: Credit | null;
  createdAt: string;
  updatedAt: string;
}

export interface AccountDetail extends Account {
  hasChildren: boolean;
  /** Types of the live sub-accounts: the account type must keep accepting them. */
  childTypes: AccountType[];
  hasTransactions: boolean;
}

export interface AccountRequest {
  name: string;
  type: AccountType;
  parentId: number | null;
  currencyId: number;
  balance: number | null;
  icon: string | null;
  color: string | null;
  includeInBalance: boolean;
  temporary: boolean;
  status: AccountStatus;
  version: number | null;
}
