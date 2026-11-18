import { Injectable, computed, signal } from '@angular/core';
import { AccountType } from '../../../shared/enums/account-type.enum';
import { TransactionType } from '../../../shared/enums/transaction-type.enum';
import {
  AccountOption,
  BatchRequest,
  TransactionRules,
  TransactionTypeRule,
  TransactionVariant,
} from '../../../shared/models/transaction.model';
import { readStorage, removeStorage, writeStorage } from '../../../core/storage/local-storage';
import { Cents, fromCents, toCents } from '../../../shared/money/money';
import {
  BatchResult,
  EngineAccount,
  EngineError,
  EngineResult,
  EngineTransaction,
  TransactionEngine,
} from '../engine/transaction-engine';

/** Bump when the stored shape changes: older drafts are discarded instead of misread. */
export const DRAFT_SCHEMA_VERSION = 1;

export function draftKey(userId: number): string {
  return `accountant:draft:${userId}`;
}

/** A transaction of the batch being captured. Money in cents. */
export interface DraftTransaction {
  uuid: string;
  type: TransactionType;
  originAccountId: number;
  destinationAccountId: number | null;
  amount: Cents;
  fee: Cents;
  description: string;
  /** False while the description is the generated one (it follows type and accounts). */
  descriptionEdited: boolean;
  applied: boolean;
  /** `yyyy-MM-ddTHH:mm:ss` (local time). */
  operationDate: string;
  scheduleId: number | null;
}

interface StoredDraft {
  schemaVersion: number;
  createdAt: string;
  /** Account id → version the draft was computed with. */
  accountVersions: Record<string, number>;
  transactions: DraftTransaction[];
}

export type Projection = { ok: true; result: BatchResult } | { ok: false; error: EngineError };

export interface Preview {
  /** Result of the candidate when the whole batch is valid with it. */
  result: EngineResult | null;
  error: EngineError | null;
  /** Projected balances just before the candidate (null for accounts without balance). */
  originBefore: Cents | null;
  destinationBefore: Cents | null;
}

/**
 * Local batch draft (docs/documentacion-tecnica.md §11.4): persisted per user in localStorage and recomputed from scratch on
 * every change, from the pristine accounts of `GET /accounts/options`. A change that would make a
 * valid batch fail is rejected and the draft stays as it was.
 */
@Injectable()
export class TransactionDraftStore {
  private engine: TransactionEngine | null = null;
  private storageKey: string | null = null;
  private createdAt = '';

  private readonly pristine = signal<AccountOption[]>([]);
  private readonly items = signal<DraftTransaction[]>([]);

  readonly transactions = this.items.asReadonly();
  /** Accounts whose balance base changed since the draft was computed (another batch, manual edit). */
  readonly changedAccounts = signal<number[]>([]);

  readonly projection = computed<Projection>(() => this.compute(this.items()));

  /** Pristine accounts with the balance and status at the end of the batch (selectors). */
  readonly projectedAccounts = computed<AccountOption[]>(() => {
    const projection = this.projection();
    if (!projection.ok) {
      return this.pristine();
    }
    return this.pristine().map((option) => {
      const state = projection.result.accounts.get(option.id);
      return state
        ? {
            ...option,
            balance: state.balance === null ? null : fromCents(state.balance),
            status: state.status,
          }
        : option;
    });
  });

  readonly baseAccounts = this.pristine.asReadonly();

  /** Starts (or restarts with fresh accounts) the store for a user, restoring the stored draft. */
  init(userId: number, rules: TransactionRules, accounts: AccountOption[]): void {
    this.engine = new TransactionEngine(rules);
    this.storageKey = draftKey(userId);
    this.pristine.set(accounts);

    const stored = this.read();
    if (!stored) {
      this.createdAt = new Date().toISOString();
      this.items.set([]);
      this.changedAccounts.set([]);
      return;
    }
    this.createdAt = stored.createdAt;
    this.changedAccounts.set(
      Object.entries(stored.accountVersions)
        .filter(([id, version]) => {
          const account = accounts.find((option) => option.id === Number(id));
          return !account || account.version !== version;
        })
        .map(([id]) => Number(id)),
    );
    this.items.set(stored.transactions);
    // Recomputed against the current accounts: from now on the draft uses their versions.
    this.persist();
  }

  add(transaction: DraftTransaction): EngineError | null {
    return this.commit([...this.items(), transaction]);
  }

  update(transaction: DraftTransaction): EngineError | null {
    return this.commit(
      this.items().map((item) => (item.uuid === transaction.uuid ? transaction : item)),
    );
  }

  remove(uuid: string): EngineError | null {
    return this.commit(this.items().filter((item) => item.uuid !== uuid));
  }

  clear(): void {
    this.items.set([]);
    this.changedAccounts.set([]);
    this.createdAt = new Date().toISOString();
    this.persist();
  }

  rule(type: TransactionType): TransactionTypeRule | null {
    return this.engine?.rule(type) ?? null;
  }

  variant(
    type: TransactionType,
    origin: AccountType,
    destination: AccountType | null,
  ): TransactionVariant | null {
    return this.engine?.variant(type, origin, destination) ?? null;
  }

  dismissBaseChange(): void {
    this.changedAccounts.set([]);
  }

  /** Projects the batch with `candidate` added (or replacing the item with its uuid). */
  preview(candidate: DraftTransaction): Preview {
    const items = this.items();
    const exists = items.some((item) => item.uuid === candidate.uuid);
    const next = exists
      ? items.map((item) => (item.uuid === candidate.uuid ? candidate : item))
      : [...items, candidate];
    const projection = this.compute(next);
    if (projection.ok) {
      const result =
        projection.result.results.find((r) => r.transaction.uuid === candidate.uuid) ?? null;
      return {
        result,
        error: null,
        originBefore: result?.originBalanceBefore ?? null,
        destinationBefore: result?.destinationBalanceBefore ?? null,
      };
    }
    const before = this.balancesBefore(next, candidate);
    return { result: null, error: projection.error, ...before };
  }

  /** Index (capture order) of a transaction, as the API reports it in `params.index`. */
  indexOf(uuid: string): number {
    return this.items().findIndex((item) => item.uuid === uuid);
  }

  batchRequest(): BatchRequest {
    const items = this.items();
    const ids = new Set(
      items.flatMap((item) =>
        item.destinationAccountId === null
          ? [item.originAccountId]
          : [item.originAccountId, item.destinationAccountId],
      ),
    );
    return {
      transactions: items.map((item) => ({
        uuid: item.uuid,
        type: item.type,
        originAccountId: item.originAccountId,
        destinationAccountId: item.destinationAccountId,
        amount: fromCents(item.amount),
        fee: fromCents(item.fee),
        description: item.description,
        applied: item.applied,
        operationDate: item.operationDate,
        scheduleId: item.scheduleId,
      })),
      accountVersions: Object.fromEntries(
        this.pristine()
          .filter((account) => ids.has(account.id))
          .map((account) => [account.id, account.version]),
      ),
    };
  }

  // ---------------------------------------------------------------- internals

  private commit(next: DraftTransaction[]): EngineError | null {
    const projection = this.compute(next);
    // A failing draft (e.g. restored over new balances) can still be edited until it is fixed.
    if (!projection.ok && this.projection().ok) {
      return projection.error;
    }
    this.items.set(next);
    this.persist();
    return null;
  }

  private compute(items: DraftTransaction[]): Projection {
    if (!this.engine) {
      return { ok: true, result: { results: [], accounts: new Map() } };
    }
    try {
      const transactions = items.map((item, index) => this.toEngine(item, index));
      transactions.forEach((tx) => this.checkDate(tx));
      return { ok: true, result: this.engine.project(this.engineAccounts(), transactions) };
    } catch (error) {
      if (error instanceof EngineError) {
        return { ok: false, error };
      }
      throw error;
    }
  }

  /** The date cannot be before the last persisted transaction of its accounts (equal is allowed). */
  private checkDate(tx: EngineTransaction): void {
    for (const id of [tx.originId, tx.destinationId]) {
      const last = this.pristine().find((account) => account.id === id)?.lastOperationDate;
      if (last && tx.operationDate < last) {
        throw new EngineError('DATE_BEFORE_LAST_TRANSACTION', tx.uuid, tx.index, {
          accountId: id,
          lastOperationDate: last,
          index: tx.index,
        });
      }
    }
  }

  /** Balances just before `candidate`, applying only the transactions ordered before it. */
  private balancesBefore(
    items: DraftTransaction[],
    candidate: DraftTransaction,
  ): Pick<Preview, 'originBefore' | 'destinationBefore'> {
    const candidateIndex = items.findIndex((item) => item.uuid === candidate.uuid);
    const earlier = items
      .map((item, index) => this.toEngine(item, index))
      .filter(
        (tx) =>
          tx.operationDate < candidate.operationDate ||
          (tx.operationDate === candidate.operationDate && tx.index < candidateIndex),
      );
    let accounts: Map<number, EngineAccount>;
    try {
      accounts = this.engine!.project(this.engineAccounts(), earlier).accounts;
    } catch {
      accounts = new Map(this.engineAccounts().map((account) => [account.id, account]));
    }
    return {
      originBefore: accounts.get(candidate.originAccountId)?.balance ?? null,
      destinationBefore:
        candidate.destinationAccountId === null
          ? null
          : (accounts.get(candidate.destinationAccountId)?.balance ?? null),
    };
  }

  private engineAccounts(): EngineAccount[] {
    return this.pristine().map((option) => ({
      id: option.id,
      type: option.type,
      status: option.status,
      balance: option.balance === null ? null : toCents(option.balance),
      creditLimit: option.credit ? toCents(option.credit.creditLimit) : null,
      temporary: option.temporary,
    }));
  }

  private toEngine(item: DraftTransaction, index: number): EngineTransaction {
    return {
      uuid: item.uuid,
      index,
      type: item.type,
      originId: item.originAccountId,
      destinationId: item.destinationAccountId,
      amount: item.amount,
      fee: item.fee,
      applied: item.applied,
      operationDate: item.operationDate,
    };
  }

  private read(): StoredDraft | null {
    if (!this.storageKey) {
      return null;
    }
    const text = readStorage(this.storageKey);
    if (!text) {
      return null;
    }
    try {
      const draft = JSON.parse(text) as StoredDraft;
      if (draft.schemaVersion !== DRAFT_SCHEMA_VERSION || !Array.isArray(draft.transactions)) {
        removeStorage(this.storageKey);
        return null;
      }
      return draft;
    } catch {
      removeStorage(this.storageKey);
      return null;
    }
  }

  private persist(): void {
    if (!this.storageKey) {
      return;
    }
    const items = this.items();
    if (!items.length) {
      removeStorage(this.storageKey);
      return;
    }
    const draft: StoredDraft = {
      schemaVersion: DRAFT_SCHEMA_VERSION,
      createdAt: this.createdAt,
      accountVersions: this.batchRequest().accountVersions,
      transactions: items,
    };
    writeStorage(this.storageKey, JSON.stringify(draft));
  }
}
