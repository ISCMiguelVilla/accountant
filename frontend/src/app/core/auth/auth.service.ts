import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, map, tap } from 'rxjs';
import { User } from '../../shared/models/user.model';
import { Language, isLanguage } from '../i18n/language';
import { LanguageService } from '../i18n/language.service';
import { readStorage, removeStorage, writeStorage } from '../storage/local-storage';
import { AuthApiService } from './auth-api.service';
import { AuthResponse, Session, SignInRequest, SignUpRequest } from './auth.model';

export const SESSION_STORAGE_KEY = 'accountant:session';

/** Owns the signed-in session (JWT + user), persisted in localStorage until it expires. */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(AuthApiService);
  private readonly router = inject(Router);
  private readonly language = inject(LanguageService);

  private readonly session = signal<Session | null>(restoreSession());

  readonly user = computed(() => this.session()?.user ?? null);
  readonly isAuthenticated = computed(() => this.session() !== null);
  readonly isAdmin = computed(() => this.user()?.role === 'ADMIN');

  /** Token to send, or null when there is no session or it already expired. */
  token(): string | null {
    const session = this.session();
    if (!session) {
      return null;
    }
    if (isExpired(session)) {
      this.clear();
      return null;
    }
    return session.token;
  }

  signIn(request: SignInRequest): Observable<User> {
    return this.api.signIn(request).pipe(
      tap((response) => this.start(response)),
      map((response) => response.user),
    );
  }

  signUp(request: SignUpRequest): Observable<User> {
    return this.api.signUp(request).pipe(
      tap((response) => this.start(response)),
      map((response) => response.user),
    );
  }

  /** Clears the session and goes to sign-in, remembering where the user was. */
  signOut(returnUrl?: string): void {
    this.clear();
    void this.router.navigate(['/sign-in'], {
      queryParams: returnUrl ? { returnUrl } : {},
    });
  }

  /** Changes the UI language and, when signed in, stores it as the user's preference. */
  changeLanguage(language: Language): void {
    this.language.use(language).subscribe();
    if (this.isAuthenticated() && this.user()?.preferredLanguage !== language) {
      this.api.updateLanguage(language).subscribe((user) => this.updateUser(user));
    }
  }

  updateUser(user: User): void {
    const session = this.session();
    if (session) {
      this.persist({ ...session, user });
    }
  }

  private start(response: AuthResponse): void {
    this.persist({ token: response.token, expiresAt: response.expiresAt, user: response.user });
    if (isLanguage(response.user.preferredLanguage)) {
      this.language.use(response.user.preferredLanguage).subscribe();
    }
  }

  private persist(session: Session): void {
    this.session.set(session);
    writeStorage(SESSION_STORAGE_KEY, JSON.stringify(session));
  }

  private clear(): void {
    this.session.set(null);
    removeStorage(SESSION_STORAGE_KEY);
  }
}

function isExpired(session: Session, now = Date.now()): boolean {
  return Date.parse(session.expiresAt) <= now;
}

function restoreSession(): Session | null {
  const raw = readStorage(SESSION_STORAGE_KEY);
  if (!raw) {
    return null;
  }
  try {
    const session = JSON.parse(raw) as Session;
    if (!session.token || !session.user || isExpired(session)) {
      removeStorage(SESSION_STORAGE_KEY);
      return null;
    }
    return session;
  } catch {
    removeStorage(SESSION_STORAGE_KEY);
    return null;
  }
}
