import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SKIP_ERROR_TOAST } from '../../core/http/http-context';
import { ScheduleStatus } from '../../shared/enums/schedule-status.enum';
import { Page } from '../../shared/models/page.model';
import { Schedule, ScheduleRequest } from '../../shared/models/schedule.model';

@Injectable({ providedIn: 'root' })
export class ScheduleApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/schedules`;

  findAll(params: HttpParams): Observable<Page<Schedule>> {
    return this.http.get<Page<Schedule>>(this.baseUrl, { params });
  }

  /** ACTIVE schedules due up to the end of tomorrow (batch editor panel). */
  applicable(): Observable<Schedule[]> {
    return this.http.get<Schedule[]>(`${this.baseUrl}/applicable`);
  }

  findById(id: number): Observable<Schedule> {
    return this.http.get<Schedule>(`${this.baseUrl}/${id}`);
  }

  create(request: ScheduleRequest): Observable<Schedule> {
    return this.http.post<Schedule>(this.baseUrl, request, { context: formContext() });
  }

  update(id: number, request: ScheduleRequest): Observable<Schedule> {
    return this.http.put<Schedule>(`${this.baseUrl}/${id}`, request, { context: formContext() });
  }

  changeStatus(id: number, status: ScheduleStatus): Observable<Schedule> {
    return this.http.patch<Schedule>(`${this.baseUrl}/${id}/status`, { status });
  }

  skip(id: number): Observable<Schedule> {
    return this.http.patch<Schedule>(`${this.baseUrl}/${id}/skip`, null);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}

function formContext(): HttpContext {
  return new HttpContext().set(SKIP_ERROR_TOAST, true);
}
