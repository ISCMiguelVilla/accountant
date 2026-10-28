import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CalendarRange,
  Dimension,
  ExpensesByConcept,
  Goal,
  IncomeStatement,
  Summary,
  YearProgress,
} from './dashboard.model';

@Injectable({ providedIn: 'root' })
export class DashboardApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/dashboard`;

  incomeStatement(
    dimension: Dimension,
    size: number,
    reference: string,
  ): Observable<IncomeStatement> {
    const params = new HttpParams()
      .set('dimension', dimension)
      .set('size', size)
      .set('reference', reference);
    return this.http.get<IncomeStatement>(`${this.baseUrl}/income-statement`, { params });
  }

  expensesByConcept(month: string): Observable<ExpensesByConcept> {
    return this.http.get<ExpensesByConcept>(`${this.baseUrl}/expenses-by-concept`, {
      params: new HttpParams().set('month', month),
    });
  }

  summary(): Observable<Summary> {
    return this.http.get<Summary>(`${this.baseUrl}/summary`);
  }

  progress(years = 3): Observable<YearProgress[]> {
    return this.http.get<YearProgress[]>(`${this.baseUrl}/progress`, {
      params: new HttpParams().set('years', years),
    });
  }

  saveGoal(year: number, targetAmount: number): Observable<Goal> {
    return this.http.put<Goal>(`${environment.apiUrl}/goals/${year}`, { targetAmount });
  }

  deleteGoal(year: number): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/goals/${year}`);
  }

  /** Range of at most 62 days (yyyy-MM-dd, both inclusive). */
  calendar(from: string, to: string): Observable<CalendarRange> {
    return this.http.get<CalendarRange>(`${environment.apiUrl}/calendar`, {
      params: new HttpParams().set('from', from).set('to', to),
    });
  }
}
