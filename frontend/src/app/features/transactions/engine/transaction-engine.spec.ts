import cases from '../../../../../../docs/transaction-cases.json';
import rules from '../../../../../../docs/transaction-rules.json';
import { AccountStatus } from '../../../shared/enums/account-status.enum';
import { AccountType } from '../../../shared/enums/account-type.enum';
import { TransactionType } from '../../../shared/enums/transaction-type.enum';
import { TransactionRules } from '../../../shared/models/transaction.model';
import { Cents, toCents } from '../../../shared/money/money';
import {
  EngineAccount,
  EngineError,
  EngineTransaction,
  TransactionEngine,
  batchReport,
} from './transaction-engine';

/** Shape of `docs/transaction-cases.json` (shared with the backend engine test). */
interface CaseAccount {
  id: number;
  type: string;
  status?: string;
  balance?: string;
  creditLimit?: string | null;
  temporary?: boolean;
}

interface CaseTransaction {
  uuid: string;
  type: string;
  origin: number;
  destination?: number | null;
  amount: string;
  fee?: string;
  applied?: boolean;
  operationDate?: string;
}

interface ExpectedTransaction {
  uuid: string;
  operationType: string;
  originBalanceBefore: string | null;
  originBalanceAfter: string | null;
  destinationBalanceBefore: string | null;
  destinationBalanceAfter: string | null;
}

interface SharedCase {
  name: string;
  accounts: CaseAccount[];
  transactions: CaseTransaction[];
  expected?: {
    accounts: { id: number; balance: string | null; status: string }[];
    transactions: ExpectedTransaction[];
    report?: { income: string; expense: string; net: string };
  };
  error?: { code: string; transactionUuid: string; field?: string; fieldCode?: string };
}

const DEFAULT_DATE = '2026-10-01T12:00:00';
const engine = new TransactionEngine(rules as TransactionRules);

function toAccount(account: CaseAccount): EngineAccount {
  return {
    id: account.id,
    type: account.type as AccountType,
    status: (account.status ?? 'ACTIVE') as AccountStatus,
    balance: account.balance === undefined ? null : toCents(account.balance),
    creditLimit: account.creditLimit ? toCents(account.creditLimit) : null,
    temporary: account.temporary ?? false,
  };
}

function toTransaction(tx: CaseTransaction, index: number): EngineTransaction {
  return {
    uuid: tx.uuid,
    index,
    type: tx.type as TransactionType,
    originId: tx.origin,
    destinationId: tx.destination ?? null,
    amount: toCents(tx.amount),
    fee: toCents(tx.fee),
    applied: tx.applied ?? true,
    operationDate: tx.operationDate ?? DEFAULT_DATE,
  };
}

function cents(value: string | null): Cents | null {
  return value === null ? null : toCents(value);
}

describe('TransactionEngine (docs/transaction-cases.json)', () => {
  const shared = (cases as { cases: SharedCase[] }).cases;

  it('loads the shared cases', () => {
    expect(shared.length).toBeGreaterThan(50);
  });

  for (const testCase of shared) {
    it(testCase.name, () => {
      const accounts = testCase.accounts.map(toAccount);
      const transactions = testCase.transactions.map(toTransaction);

      if (testCase.error) {
        let thrown: unknown;
        try {
          engine.project(accounts, transactions);
        } catch (error) {
          thrown = error;
        }
        expect(thrown).toBeInstanceOf(EngineError);
        const error = thrown as EngineError;
        expect(error.code).toBe(testCase.error.code);
        expect(error.transactionUuid).toBe(testCase.error.transactionUuid);
        if (testCase.error.field) {
          expect(error.field).toBe(testCase.error.field);
          expect(error.fieldCode).toBe(testCase.error.fieldCode);
        }
        return;
      }

      const result = engine.project(accounts, transactions);
      const expected = testCase.expected!;
      for (const account of expected.accounts) {
        const actual = result.accounts.get(account.id)!;
        expect(actual.balance, `balance of ${account.id}`).toBe(cents(account.balance));
        expect(actual.status).toBe(account.status);
      }

      const expectedOrder = expected.transactions.map((tx) => tx.uuid);
      const order = result.results.map((r) => r.transaction.uuid);
      expect(order.filter((uuid) => expectedOrder.includes(uuid))).toEqual(expectedOrder);
      for (const tx of expected.transactions) {
        const actual = result.results.find((r) => r.transaction.uuid === tx.uuid)!;
        expect(actual.operationType, `operationType of ${tx.uuid}`).toBe(tx.operationType);
        expect(actual.originBalanceBefore).toBe(cents(tx.originBalanceBefore));
        expect(actual.originBalanceAfter).toBe(cents(tx.originBalanceAfter));
        expect(actual.destinationBalanceBefore).toBe(cents(tx.destinationBalanceBefore));
        expect(actual.destinationBalanceAfter).toBe(cents(tx.destinationBalanceAfter));
      }

      if (expected.report) {
        const report = batchReport(result.results);
        expect(report.income).toBe(toCents(expected.report.income));
        expect(report.expense).toBe(toCents(expected.report.expense));
        expect(report.net).toBe(toCents(expected.report.net));
      }
    });
  }

  it('does not modify the input accounts', () => {
    const bank: EngineAccount = {
      id: 1,
      type: 'STORAGE',
      status: 'ACTIVE',
      balance: 10_000,
      creditLimit: null,
      temporary: false,
    };
    const food: EngineAccount = { ...bank, id: 2, type: 'CONSUMER', balance: null };
    engine.project(
      [bank, food],
      [toTransaction({ uuid: 't', type: 'EXPENSE', origin: 1, destination: 2, amount: '10' }, 0)],
    );
    expect(bank.balance).toBe(10_000);
  });
});
