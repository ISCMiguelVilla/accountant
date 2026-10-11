import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { SKIP_ERROR_TOAST } from '../../../core/http/http-context';
import { Page } from '../../../shared/models/page.model';
import { User, UserUpdateRequest } from '../../../shared/models/user.model';

@Injectable({ providedIn: 'root' })
export class UserAdminApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/admin/users`;

  findAll(params: HttpParams): Observable<Page<User>> {
    return this.http.get<Page<User>>(this.baseUrl, { params });
  }

  update(id: number, request: UserUpdateRequest): Observable<User> {
    return this.http.put<User>(`${this.baseUrl}/${id}`, request, {
      context: new HttpContext().set(SKIP_ERROR_TOAST, true),
    });
  }
}
