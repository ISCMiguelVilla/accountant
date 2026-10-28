import { Pipe, PipeTransform } from '@angular/core';
import { OperationType, TransactionType } from '../enums/transaction-type.enum';
import { TagSeverity } from './status-severity.pipe';

const ICONS: Record<TransactionType, string> = {
  INCOME: 'pi pi-arrow-down-left',
  EXPENSE: 'pi pi-shopping-cart',
  TRANSFER: 'pi pi-arrow-right-arrow-left',
  INVEST: 'pi pi-chart-line',
  PROFIT: 'pi pi-sign-out',
  DIVIDEND: 'pi pi-percentage',
  INTEREST: 'pi pi-exclamation-circle',
  BORROW: 'pi pi-arrow-circle-up',
  COLLECTION: 'pi pi-arrow-circle-down',
  DEBT: 'pi pi-credit-card',
  PAYMENT: 'pi pi-check-circle',
};

const OPERATION_SEVERITIES: Record<OperationType, TagSeverity> = {
  ADDITION: 'success',
  SUBTRACTION: 'danger',
  NEUTER: 'secondary',
};

@Pipe({ name: 'transactionTypeIcon' })
export class TransactionTypeIconPipe implements PipeTransform {
  transform(type: TransactionType | null | undefined): string {
    return type ? ICONS[type] : 'pi pi-circle';
  }
}

@Pipe({ name: 'operationTypeSeverity' })
export class OperationTypeSeverityPipe implements PipeTransform {
  transform(type: OperationType | null | undefined): TagSeverity {
    return type ? OPERATION_SEVERITIES[type] : 'secondary';
  }
}
