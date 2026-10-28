import { ScheduleStatus } from '../enums/schedule-status.enum';
import { OperationType, TransactionType } from '../enums/transaction-type.enum';
import { AccountRef } from './account.model';
import { CurrencyOption } from './currency.model';

/** Scheduled (recurring) transaction; it becomes real through the batch editor. */
export interface Schedule {
  id: number;
  type: TransactionType;
  operationType: OperationType;
  origin: AccountRef;
  destination: AccountRef | null;
  currency: CurrencyOption;
  amount: number;
  fee: number;
  description: string;
  /** Spring cron, 6 fields. */
  cronExpression: string;
  nextExecution: string;
  lastExecution: string | null;
  status: ScheduleStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleRequest {
  type: TransactionType;
  originAccountId: number;
  destinationAccountId: number | null;
  amount: number;
  fee: number;
  description: string;
  cronExpression: string;
  /** Null: first occurrence of the cron from today. */
  nextExecution: string | null;
}
