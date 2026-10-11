import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { User } from '../../shared/models/user.model';
import { SKIP_ERROR_TOAST } from '../http/http-context';
import { Language } from '../i18n/language';
import { AuthResponse, SignInRequest, SignUpRequest } from './auth.model';

@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  /** Forms show their own errors, so the global error toast is skipped. */
  private readonly formContext = () => new HttpContext().set(SKIP_ERROR_TOAST, true);

  signIn(request: SignInRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/auth/sign-in`, request, {
      context: this.formContext(),
    });
  }

  signUp(request: SignUpRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/auth/sign-up`, request, {
      context: this.formContext(),
    });
  }

  me(): Observable<User> {
    return this.http.get<User>(`${this.baseUrl}/me`);
  }

  updateLanguage(language: Language): Observable<User> {
    return this.http.patch<User>(`${this.baseUrl}/me/language`, { language });
  }
}
