import { Pipe, PipeTransform } from '@angular/core';
import { AccountType } from '../enums/account-type.enum';
import { TagSeverity } from './status-severity.pipe';

const ICONS: Record<AccountType, string> = {
  GROUP: 'pi pi-folder',
  SUPPLIER: 'pi pi-briefcase',
  STORAGE: 'pi pi-wallet',
  CONSUMER: 'pi pi-shopping-cart',
  BUSINESS: 'pi pi-shop',
  INVESTMENT: 'pi pi-chart-line',
  CREDITOR: 'pi pi-arrow-circle-up',
  DEBTOR: 'pi pi-credit-card',
};

/** `undefined` renders the default (primary) tag. */
const SEVERITIES: Record<AccountType, TagSeverity | undefined> = {
  GROUP: undefined,
  SUPPLIER: 'success',
  STORAGE: 'warn',
  CONSUMER: 'danger',
  BUSINESS: 'success',
  INVESTMENT: 'success',
  CREDITOR: 'warn',
  DEBTOR: 'danger',
};

@Pipe({ name: 'accountTypeIcon' })
export class AccountTypeIconPipe implements PipeTransform {
  transform(type: AccountType | null | undefined): string {
    return type ? ICONS[type] : 'pi pi-circle';
  }
}

@Pipe({ name: 'accountTypeSeverity' })
export class AccountTypeSeverityPipe implements PipeTransform {
  transform(type: AccountType | null | undefined): TagSeverity | undefined {
    return type ? SEVERITIES[type] : 'secondary';
  }
}
