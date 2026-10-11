import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { SKIP_ERROR_TOAST } from '../../../core/http/http-context';
import { Currency, CurrencyOption, CurrencyRequest } from '../../../shared/models/currency.model';
import { Page } from '../../../shared/models/page.model';

@Injectable({ providedIn: 'root' })
export class CurrencyApiService {
  private readonly http = inject(HttpClient);
  private readonly adminUrl = `${environment.apiUrl}/admin/currencies`;

  /** Active currencies for selects (any signed-in user). */
  options(): Observable<CurrencyOption[]> {
    return this.http.get<CurrencyOption[]>(`${environment.apiUrl}/currencies/options`);
  }

  findAll(params: HttpParams): Observable<Page<Currency>> {
    return this.http.get<Page<Currency>>(this.adminUrl, { params });
  }

  create(request: CurrencyRequest): Observable<Currency> {
    return this.http.post<Currency>(this.adminUrl, request, { context: formContext() });
  }

  update(id: number, request: CurrencyRequest): Observable<Currency> {
    return this.http.put<Currency>(`${this.adminUrl}/${id}`, request, { context: formContext() });
  }
}

function formContext(): HttpContext {
  return new HttpContext().set(SKIP_ERROR_TOAST, true);
}
