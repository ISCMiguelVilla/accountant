import rules from '../../../../../../test-fixtures/transaction-rules.json';
import { AccountOption, TransactionRules } from '../../../shared/models/transaction.model';
import {
  DRAFT_SCHEMA_VERSION,
  DraftTransaction,
  TransactionDraftStore,
  draftKey,
} from './transaction-draft.store';

const USER = 7;

function option(id: number, type: AccountOption['type'], balance: number | null): AccountOption {
  return {
    id,
    name: `Account ${id}`,
    type,
    status: 'ACTIVE',
    parentId: null,
    balance,
    currency: { id: 1, name: 'Peso', iso: 'MXN', symbol: '$' },
    icon: null,
    color: null,
    temporary: false,
    version: 0,
    lastOperationDate: null,
    credit: null,
  };
}

function expense(
  uuid: string,
  amount: number,
  operationDate = '2026-10-10T10:00:00',
): DraftTransaction {
  return {
    uuid,
    type: 'EXPENSE',
    originAccountId: 1,
    destinationAccountId: 2,
    amount,
    fee: 0,
    description: 'Gasto',
    descriptionEdited: false,
    applied: true,
    operationDate,
    scheduleId: null,
  };
}

function accounts(bankVersion = 0): AccountOption[] {
  return [{ ...option(1, 'STORAGE', 1000), version: bankVersion }, option(2, 'CONSUMER', null)];
}

function newStore(options = accounts()): TransactionDraftStore {
  const store = new TransactionDraftStore();
  store.init(USER, rules as TransactionRules, options);
  return store;
}

describe('TransactionDraftStore', () => {
  beforeEach(() => localStorage.clear());

  it('recomputes the projection on every change and persists the draft per user', () => {
    const store = newStore();

    expect(store.add(expense('a', 30_000))).toBeNull();
    expect(store.add(expense('b', 20_000))).toBeNull();

    const projection = store.projection();
    expect(projection.ok).toBe(true);
    expect(store.projectedAccounts().find((a) => a.id === 1)?.balance).toBe(500);

    const stored = JSON.parse(localStorage.getItem(draftKey(USER))!);
    expect(stored.schemaVersion).toBe(DRAFT_SCHEMA_VERSION);
    expect(stored.accountVersions).toEqual({ 1: 0, 2: 0 });
    expect(stored.transactions.map((t: DraftTransaction) => t.uuid)).toEqual(['a', 'b']);
  });

  it('rejects a change that makes the batch fail and keeps the draft as it was', () => {
    const store = newStore();
    store.add(expense('a', 60_000, '2026-10-12T10:00:00'));

    // An earlier expense leaves no funds for the later one: the later one is the one that fails.
    const error = store.add(expense('b', 50_000, '2026-10-11T10:00:00'));

    expect(error?.code).toBe('INSUFFICIENT_FUNDS');
    expect(error?.transactionUuid).toBe('a');
    expect(store.transactions().map((t) => t.uuid)).toEqual(['a']);
  });

  it('editing or removing an intermediate transaction revalidates the later ones', () => {
    const store = newStore();
    store.add(expense('a', 40_000, '2026-10-10T10:00:00'));
    store.add(expense('b', 50_000, '2026-10-11T10:00:00'));

    expect(
      store.update({ ...expense('a', 60_000), operationDate: '2026-10-10T10:00:00' })?.code,
    ).toBe('INSUFFICIENT_FUNDS');
    expect(store.remove('a')).toBeNull();
    expect(store.projectedAccounts().find((a) => a.id === 1)?.balance).toBe(500);
  });

  it('restores the draft after a reload', () => {
    newStore().add(expense('a', 10_000));

    const restored = newStore();

    expect(restored.transactions().map((t) => t.uuid)).toEqual(['a']);
    expect(restored.changedAccounts()).toEqual([]);
    expect(restored.projectedAccounts().find((a) => a.id === 1)?.balance).toBe(900);
  });

  it('warns when an account version changed and recomputes against the new balances', () => {
    newStore().add(expense('a', 80_000));

    // Meanwhile the bank was edited: balance 500, version 1.
    const changed = accounts(1);
    changed[0] = { ...changed[0], balance: 500 };
    const restored = newStore(changed);

    expect(restored.changedAccounts()).toEqual([1]);
    const projection = restored.projection();
    expect(projection.ok).toBe(false);
    if (!projection.ok) {
      expect(projection.error.code).toBe('INSUFFICIENT_FUNDS');
    }
    // The failing draft can still be fixed.
    expect(restored.update(expense('a', 40_000))).toBeNull();
    expect(restored.projection().ok).toBe(true);
    expect(JSON.parse(localStorage.getItem(draftKey(USER))!).accountVersions).toEqual({
      1: 1,
      2: 0,
    });
  });

  it('discards a draft stored with another schema version', () => {
    localStorage.setItem(
      draftKey(USER),
      JSON.stringify({ schemaVersion: 0, createdAt: '', accountVersions: {}, transactions: [] }),
    );

    const store = newStore();

    expect(store.transactions()).toEqual([]);
    expect(localStorage.getItem(draftKey(USER))).toBeNull();
  });

  it('rejects dates before the last persisted transaction of an account', () => {
    const options = accounts();
    options[0] = { ...options[0], lastOperationDate: '2026-10-15T08:00:00' };
    const store = newStore(options);

    const error = store.add(expense('a', 100, '2026-10-14T08:00:00'));

    expect(error?.code).toBe('DATE_BEFORE_LAST_TRANSACTION');
    expect(store.add(expense('b', 100, '2026-10-15T08:00:00'))).toBeNull();
  });

  it('previews the balances before and after a candidate', () => {
    const store = newStore();
    store.add(expense('a', 30_000));

    const ok = store.preview(expense('b', 20_000, '2026-10-11T10:00:00'));
    expect(ok.originBefore).toBe(70_000);
    expect(ok.result?.originBalanceAfter).toBe(50_000);

    const failing = store.preview(expense('c', 90_000, '2026-10-11T10:00:00'));
    expect(failing.error?.code).toBe('INSUFFICIENT_FUNDS');
    expect(failing.originBefore).toBe(70_000);
  });

  it('builds the batch request with decimals and the account versions', () => {
    const store = newStore(accounts(3));
    store.add({ ...expense('a', 12_345), fee: 5 });

    expect(store.batchRequest()).toEqual({
      transactions: [
        expect.objectContaining({ uuid: 'a', amount: 123.45, fee: 0.05, applied: true }),
      ],
      accountVersions: { 1: 3, 2: 0 },
    });
  });

  it('clear empties the draft and the storage', () => {
    const store = newStore();
    store.add(expense('a', 100));

    store.clear();

    expect(store.transactions()).toEqual([]);
    expect(localStorage.getItem(draftKey(USER))).toBeNull();
  });
});
