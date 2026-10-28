import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SKIP_ERROR_TOAST } from '../../core/http/http-context';
import { Page } from '../../shared/models/page.model';
import {
  AccountOption,
  BatchRequest,
  BatchResponse,
  Transaction,
  TransactionRules,
} from '../../shared/models/transaction.model';

@Injectable({ providedIn: 'root' })
export class TransactionApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/transactions`;

  findAll(params: HttpParams): Observable<Page<Transaction>> {
    return this.http.get<Page<Transaction>>(this.baseUrl, { params });
  }

  findByAccount(accountId: number, params: HttpParams): Observable<Page<Transaction>> {
    return this.http.get<Page<Transaction>>(
      `${environment.apiUrl}/accounts/${accountId}/transactions`,
      { params },
    );
  }

  rules(): Observable<TransactionRules> {
    return this.http.get<TransactionRules>(`${this.baseUrl}/rules`);
  }

  accountOptions(): Observable<AccountOption[]> {
    return this.http.get<AccountOption[]>(`${environment.apiUrl}/accounts/options`);
  }

  /** The editor reports batch errors itself (persistent toast pointing at the failing row). */
  saveBatch(request: BatchRequest): Observable<BatchResponse> {
    return this.http.post<BatchResponse>(`${this.baseUrl}/batch`, request, {
      context: new HttpContext().set(SKIP_ERROR_TOAST, true),
    });
  }

  apply(id: number): Observable<Transaction> {
    return this.http.patch<Transaction>(`${this.baseUrl}/${id}/apply`, null);
  }
}
