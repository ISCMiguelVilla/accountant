import { AccountStatus } from '../../../shared/enums/account-status.enum';
import { AccountType, hasBalance } from '../../../shared/enums/account-type.enum';
import { OperationType, TransactionType } from '../../../shared/enums/transaction-type.enum';
import {
  TransactionRules,
  TransactionTypeRule,
  TransactionVariant,
} from '../../../shared/models/transaction.model';
import { Cents } from '../../../shared/money/money';

/**
 * Pure transaction engine, the TypeScript twin of the backend `TransactionEngine`. It only implements
 * the arithmetic of the effects (docs/documentacion-tecnica.md §9.3): the rule matrix always comes from
 * `GET /transactions/rules`. Both engines run the cases of `test-fixtures/transaction-cases.json`.
 *
 * Every amount is in integer cents. A = amount, F = fee. Pending (only EXPENSE, TRANSFER, INVEST,
 * PROFIT): the EXPENSE origin and the TRANSFER / INVEST / PROFIT destination change only when applied.
 */

/** `balance` is null for types without balance; `creditLimit` null when there is no credit line. */
export interface EngineAccount {
  id: number;
  type: AccountType;
  status: AccountStatus;
  balance: Cents | null;
  creditLimit: Cents | null;
  temporary: boolean;
}

export interface EngineTransaction {
  uuid: string;
  /** Capture order: breaks ties between equal dates. */
  index: number;
  type: TransactionType;
  originId: number;
  destinationId: number | null;
  amount: Cents;
  fee: Cents;
  applied: boolean;
  /** `yyyy-MM-ddTHH:mm:ss`, compared as text. */
  operationDate: string;
}

export interface EngineResult {
  transaction: EngineTransaction;
  operationType: OperationType;
  originBalanceBefore: Cents | null;
  originBalanceAfter: Cents | null;
  destinationBalanceBefore: Cents | null;
  destinationBalanceAfter: Cents | null;
  originDisabled: boolean;
}

export interface ReportAmounts {
  income: Cents;
  expense: Cents;
  net: Cents;
}

export interface BatchResult {
  /** One result per transaction, in application (date) order. */
  results: EngineResult[];
  accounts: Map<number, EngineAccount>;
}

export type EngineErrorCode =
  | 'VALIDATION_ERROR'
  | 'INSUFFICIENT_FUNDS'
  | 'CREDIT_LIMIT_EXCEEDED'
  | 'SENSELESS_TRANSACTION'
  | 'ACCOUNT_DISABLED'
  | 'TRANSACTION_NOT_SUPPORTED'
  | 'DATE_BEFORE_LAST_TRANSACTION';

/** Failure of one transaction; same codes and params as the backend `ProblemDetail`. */
export class EngineError extends Error {
  constructor(
    readonly code: EngineErrorCode,
    readonly transactionUuid: string,
    readonly index: number,
    readonly params: Record<string, unknown> = {},
    readonly field: string | null = null,
    readonly fieldCode: string | null = null,
  ) {
    super(`${code}${fieldCode ? ` ${field}=${fieldCode}` : ''} at transaction ${transactionUuid}`);
  }
}

/** Report amounts of a transaction (5.3): income A − F, expense A + F, NEUTER only F as expense. */
export function reportAmounts(
  operationType: OperationType,
  amount: Cents,
  fee: Cents,
): ReportAmounts {
  switch (operationType) {
    case 'ADDITION':
      return { income: amount - fee, expense: 0, net: amount - fee };
    case 'SUBTRACTION':
      return { income: 0, expense: amount + fee, net: -(amount + fee) };
    case 'NEUTER':
      return { income: 0, expense: fee, net: -fee };
  }
}

/** Income / expense of the applied results (pending ones do not count until applied). */
export function batchReport(results: readonly EngineResult[]): ReportAmounts {
  return results
    .filter((result) => result.transaction.applied)
    .map((result) =>
      reportAmounts(result.operationType, result.transaction.amount, result.transaction.fee),
    )
    .reduce(
      (total, amounts) => ({
        income: total.income + amounts.income,
        expense: total.expense + amounts.expense,
        net: total.net + amounts.net,
      }),
      { income: 0, expense: 0, net: 0 },
    );
}

export class TransactionEngine {
  private readonly rules = new Map<TransactionType, TransactionTypeRule>();

  constructor(rules: TransactionRules) {
    for (const rule of rules.types) {
      this.rules.set(rule.type, rule);
    }
  }

  rule(type: TransactionType): TransactionTypeRule {
    const rule = this.rules.get(type);
    if (!rule) {
      throw new Error(`No rule for ${type}`);
    }
    return rule;
  }

  variant(
    type: TransactionType,
    origin: AccountType,
    destination: AccountType | null,
  ): TransactionVariant | undefined {
    return this.rule(type).variants.find(
      (variant) => variant.origin === origin && variant.destination === destination,
    );
  }

  /**
   * Applies the transactions over copies of `accounts` in date order (stable by capture order).
   * Throws the {@link EngineError} of the first failing transaction.
   */
  project(
    accounts: readonly EngineAccount[],
    transactions: readonly EngineTransaction[],
  ): BatchResult {
    const state = new Map<number, EngineAccount>();
    for (const account of accounts) {
      state.set(account.id, {
        ...account,
        balance: hasBalance(account.type) ? (account.balance ?? 0) : null,
      });
    }
    const ordered = [...transactions].sort(
      (a, b) =>
        (a.operationDate < b.operationDate ? -1 : a.operationDate > b.operationDate ? 1 : 0) ||
        a.index - b.index,
    );
    return { results: ordered.map((tx) => this.apply(state, tx)), accounts: state };
  }

  private apply(state: Map<number, EngineAccount>, tx: EngineTransaction): EngineResult {
    const origin = account(state, tx, tx.originId, 'originAccountId');
    const destination =
      tx.destinationId === null
        ? null
        : account(state, tx, tx.destinationId, 'destinationAccountId');
    const variant = this.validate(tx, origin, destination);

    const originBefore = origin.balance;
    const destinationBefore = destination?.balance ?? null;
    const a = tx.amount;
    const f = tx.fee;
    let originDisabled = false;

    switch (tx.type) {
      case 'INCOME':
        add(destination!, a - f);
        break;
      case 'EXPENSE':
        if (tx.applied) {
          debitExpense(tx, origin);
        }
        break;
      case 'TRANSFER':
      case 'INVEST':
      case 'PROFIT':
        requireFunds(tx, origin, a);
        add(origin, -a);
        if (tx.applied) {
          add(destination!, a - f);
          originDisabled = disableTemporary(tx, origin);
        }
        break;
      case 'DIVIDEND':
        add(destination ?? origin, a - f);
        break;
      case 'INTEREST':
        if (origin.type === 'DEBTOR') {
          requireCredit(tx, origin, a);
          add(origin, a);
        } else {
          requireFunds(tx, origin, a);
          add(origin, -a);
        }
        break;
      case 'BORROW':
        requireFunds(tx, origin, a);
        add(origin, -a);
        add(destination!, a);
        break;
      case 'COLLECTION':
        if (a > (origin.balance ?? 0)) {
          throw senseless(tx, origin);
        }
        add(origin, -a);
        add(destination!, a);
        break;
      case 'DEBT':
        requireCredit(tx, origin, a);
        add(origin, a);
        add(destination!, a - f); // CONSUMER has no balance: no effect
        break;
      case 'PAYMENT':
        requireFunds(tx, origin, a + f);
        if (a > (destination!.balance ?? 0)) {
          throw senseless(tx, destination!);
        }
        add(origin, -(a + f));
        add(destination!, -a);
        break;
    }
    return {
      transaction: tx,
      operationType: variant.operationType,
      originBalanceBefore: originBefore,
      originBalanceAfter: origin.balance,
      destinationBalanceBefore: destinationBefore,
      destinationBalanceAfter: destination?.balance ?? null,
      originDisabled,
    };
  }

  /** Rule matrix, enabled fields and account status; returns the matching variant. */
  private validate(
    tx: EngineTransaction,
    origin: EngineAccount,
    destination: EngineAccount | null,
  ): TransactionVariant {
    const rule = this.rule(tx.type);
    if (destination && destination.id === origin.id) {
      throw invalid(tx, 'destinationAccountId', 'SAME_ACCOUNT');
    }
    if (!rule.origins.includes(origin.type)) {
      throw invalid(tx, 'originAccountId', 'ORIGIN_NOT_ALLOWED');
    }
    if (rule.destinationMode === 'REQUIRED' && !destination) {
      throw invalid(tx, 'destinationAccountId', 'DESTINATION_REQUIRED');
    }
    if (rule.destinationMode === 'NONE' && destination) {
      throw invalid(tx, 'destinationAccountId', 'DESTINATION_NOT_ALLOWED');
    }
    if (destination && !rule.destinations.includes(destination.type)) {
      throw invalid(tx, 'destinationAccountId', 'DESTINATION_NOT_ALLOWED');
    }
    const variant = this.variant(tx.type, origin.type, destination?.type ?? null);
    if (!variant) {
      throw invalid(tx, 'destinationAccountId', 'DESTINATION_NOT_ALLOWED');
    }
    if (tx.fee > 0 && !variant.feeEnabled) {
      throw invalid(tx, 'fee', 'FEE_NOT_ALLOWED');
    }
    if (variant.feeMustBeBelowAmount && tx.fee >= tx.amount) {
      throw invalid(tx, 'fee', 'FEE_NOT_BELOW_AMOUNT');
    }
    if (!tx.applied && !rule.pendingAllowed) {
      throw invalid(tx, 'applied', 'PENDING_NOT_ALLOWED');
    }
    requireActive(tx, origin);
    if (destination) {
      requireActive(tx, destination);
    }
    return variant;
  }
}

// ------------------------------------------------------------------ effects

function add(account: EngineAccount, cents: Cents): void {
  if (account.balance !== null) {
    account.balance += cents;
  }
}

/** EXPENSE origin: STORAGE pays A + F; a DEBTOR (card purchase) grows its debt by A + F. */
function debitExpense(tx: EngineTransaction, origin: EngineAccount): void {
  const total = tx.amount + tx.fee;
  if (origin.type === 'DEBTOR') {
    requireCredit(tx, origin, total);
    add(origin, total);
  } else {
    requireFunds(tx, origin, total);
    add(origin, -total);
  }
}

/** A PROFIT disables its temporary origin when the transaction is applied (the investment is over). */
function disableTemporary(tx: EngineTransaction, origin: EngineAccount): boolean {
  if (tx.type === 'PROFIT' && origin.temporary) {
    origin.status = 'DISABLED';
    return true;
  }
  return false;
}

// -------------------------------------------------------------- validations

function account(
  state: Map<number, EngineAccount>,
  tx: EngineTransaction,
  id: number,
  field: string,
): EngineAccount {
  const found = state.get(id);
  if (!found) {
    throw invalid(tx, field, 'ACCOUNT_NOT_FOUND');
  }
  return found;
}

function requireActive(tx: EngineTransaction, account: EngineAccount): void {
  if (account.status !== 'ACTIVE') {
    throw new EngineError('ACCOUNT_DISABLED', tx.uuid, tx.index, { accountId: account.id });
  }
}

function requireFunds(tx: EngineTransaction, account: EngineAccount, required: Cents): void {
  const balance = account.balance ?? 0;
  if (balance < required) {
    throw new EngineError('INSUFFICIENT_FUNDS', tx.uuid, tx.index, {
      accountId: account.id,
      available: balance,
      required,
    });
  }
}

/** With a credit line, the debt cannot exceed the limit. */
function requireCredit(tx: EngineTransaction, account: EngineAccount, increase: Cents): void {
  if (account.creditLimit === null) {
    return;
  }
  const balance = account.balance ?? 0;
  if (balance + increase > account.creditLimit) {
    throw new EngineError('CREDIT_LIMIT_EXCEEDED', tx.uuid, tx.index, {
      accountId: account.id,
      available: Math.max(account.creditLimit - balance, 0),
      required: increase,
    });
  }
}

function senseless(tx: EngineTransaction, account: EngineAccount): EngineError {
  return new EngineError('SENSELESS_TRANSACTION', tx.uuid, tx.index, {
    accountId: account.id,
    available: account.balance ?? 0,
  });
}

function invalid(tx: EngineTransaction, field: string, code: string): EngineError {
  return new EngineError('VALIDATION_ERROR', tx.uuid, tx.index, {}, field, code);
}
