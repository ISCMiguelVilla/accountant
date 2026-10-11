import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface CronCheck {
  valid: boolean;
  nextExecutions: string[];
}

@Injectable({ providedIn: 'root' })
export class CronApiService {
  private readonly http = inject(HttpClient);

  check(expression: string, count = 3): Observable<CronCheck> {
    const params = new HttpParams().set('expression', expression).set('count', count);
    return this.http.get<CronCheck>(`${environment.apiUrl}/schedules/cron/check`, { params });
  }
}
