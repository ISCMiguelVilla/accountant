import { AccountType } from '../../shared/enums/account-type.enum';

export const DIMENSIONS = ['YEAR', 'MONTH', 'WEEK', 'DAY'] as const;
export type Dimension = (typeof DIMENSIONS)[number];

/** Window bounds per dimension (PROMPT 6.1), mirrored from the backend `Dimension`. */
export const DIMENSION_SIZES: Record<Dimension, { min: number; max: number; default: number }> = {
  YEAR: { min: 2, max: 4, default: 2 },
  MONTH: { min: 3, max: 12, default: 6 },
  WEEK: { min: 4, max: 12, default: 4 },
  DAY: { min: 7, max: 15, default: 7 },
};

export interface IncomeStatementPeriod {
  /** First day of the period (yyyy-MM-dd). */
  start: string;
  income: number;
  expense: number;
  net: number;
}

export interface IncomeStatement {
  dimension: Dimension;
  size: number;
  reference: string;
  periods: IncomeStatementPeriod[];
}

/** `accountId` null = the fixed "fees" concept. */
export interface ExpenseConcept {
  accountId: number | null;
  name: string | null;
  icon: string | null;
  color: string | null;
  amount: number;
}

export interface ExpensesByConcept {
  /** yyyy-MM */
  month: string;
  total: number;
  concepts: ExpenseConcept[];
}

export interface SummaryNode {
  id: number;
  name: string;
  type: AccountType;
  icon: string | null;
  color: string | null;
  balance: number;
  total: number;
  percentage: number;
  children: SummaryNode[];
}

export interface Summary {
  assets: number;
  debt: number;
  net: number;
  nodes: SummaryNode[];
}

export type ProgressStatus = 'SUCCESS' | 'WARNING' | 'DANGER';

export interface MonthProgress {
  month: number;
  net: number;
  status: ProgressStatus | null;
}

export interface YearProgress {
  year: number;
  target: number | null;
  monthlyTarget: number | null;
  accumulated: number;
  expected: number | null;
  percentage: number | null;
  status: ProgressStatus | null;
  months: MonthProgress[];
}

export interface Goal {
  year: number;
  targetAmount: number;
}
