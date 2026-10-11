import { CurrencyStatus } from '../enums/currency-status.enum';

export interface Currency {
  id: number;
  name: string;
  iso: string;
  symbol: string;
  status: CurrencyStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CurrencyOption {
  id: number;
  name: string;
  iso: string;
  symbol: string;
}

export interface CurrencyRequest {
  name: string;
  iso: string;
  symbol: string;
  status: CurrencyStatus;
}
