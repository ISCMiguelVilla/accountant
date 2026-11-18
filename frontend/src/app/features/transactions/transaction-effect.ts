import { Transaction } from '../../shared/models/transaction.model';
import { Cents, toCents } from '../../shared/money/money';

/**
 * Signed effect of a stored transaction on one of its accounts (docs/documentacion-tecnica.md §9.3), including the pending
 * effect not reflected yet. Accounts without balance get the amount that "flows" through them.
 */
export function effectOn(transaction: Transaction, accountId: number): Cents {
  const a = toCents(transaction.amount);
  const f = toCents(transaction.fee);
  const debtorOrigin = transaction.origin.type === 'DEBTOR';

  if (transaction.origin.id === accountId) {
    switch (transaction.type) {
      case 'EXPENSE':
        return debtorOrigin ? a + f : -(a + f);
      case 'DIVIDEND':
        return transaction.destination ? 0 : a - f;
      case 'INTEREST':
        return debtorOrigin ? a : -a;
      case 'DEBT':
        return a;
      case 'PAYMENT':
        return -(a + f);
      default:
        // INCOME (supplier), TRANSFER, INVEST, PROFIT, BORROW, COLLECTION
        return -a;
    }
  }
  switch (transaction.type) {
    case 'EXPENSE':
      return a + f;
    case 'BORROW':
    case 'COLLECTION':
      return a;
    case 'PAYMENT':
      return -a;
    default:
      // INCOME, TRANSFER, INVEST, PROFIT, DIVIDEND, DEBT
      return a - f;
  }
}

/** The pending effect is the origin's in EXPENSE and the destination's otherwise. */
export function isPendingOn(transaction: Transaction, accountId: number): boolean {
  if (transaction.applied) {
    return false;
  }
  return transaction.type === 'EXPENSE'
    ? transaction.origin.id === accountId
    : transaction.destination?.id === accountId;
}
