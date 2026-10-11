import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SKIP_ERROR_TOAST } from '../../core/http/http-context';
import { AccountType } from '../../shared/enums/account-type.enum';
import {
  Account,
  AccountDetail,
  AccountRef,
  AccountRequest,
  Credit,
  CreditRequest,
} from '../../shared/models/account.model';
import { Page } from '../../shared/models/page.model';

@Injectable({ providedIn: 'root' })
export class AccountApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/accounts`;

  findAll(params: HttpParams): Observable<Page<Account>> {
    return this.http.get<Page<Account>>(this.baseUrl, { params });
  }

  findById(id: number): Observable<AccountDetail> {
    return this.http.get<AccountDetail>(`${this.baseUrl}/${id}`);
  }

  inUse(): Observable<Account[]> {
    return this.http.get<Account[]>(`${this.baseUrl}/in-use`);
  }

  parentOptions(type: AccountType, accountId?: number | null): Observable<AccountRef[]> {
    let params = new HttpParams().set('type', type);
    if (accountId) {
      params = params.set('accountId', accountId);
    }
    return this.http.get<AccountRef[]>(`${this.baseUrl}/parent-options`, { params });
  }

  create(request: AccountRequest): Observable<AccountDetail> {
    return this.http.post<AccountDetail>(this.baseUrl, request, { context: formContext() });
  }

  update(id: number, request: AccountRequest): Observable<AccountDetail> {
    return this.http.put<AccountDetail>(`${this.baseUrl}/${id}`, request, {
      context: formContext(),
    });
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  saveCredit(accountId: number, request: CreditRequest): Observable<Credit> {
    return this.http.put<Credit>(`${this.baseUrl}/${accountId}/credit`, request, {
      context: formContext(),
    });
  }

  deleteCredit(accountId: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${accountId}/credit`);
  }
}

function formContext(): HttpContext {
  return new HttpContext().set(SKIP_ERROR_TOAST, true);
}
