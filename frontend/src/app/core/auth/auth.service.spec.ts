import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { providePrimeNG } from 'primeng/config';
import { User } from '../../shared/models/user.model';
import { provideI18n } from '../i18n/i18n.providers';
import { AuthResponse, Session } from './auth.model';
import { AuthService, SESSION_STORAGE_KEY } from './auth.service';

const user: User = {
  id: 1,
  name: 'Ana',
  username: 'ana',
  role: 'ADMIN',
  status: 'ACTIVE',
  preferredLanguage: 'en',
  createdAt: '2026-10-10T10:00:00',
  updatedAt: '2026-10-10T10:00:00',
};

function inHours(hours: number): string {
  return new Date(Date.now() + hours * 3_600_000).toISOString();
}

function setUp(): { auth: AuthService; http: HttpTestingController } {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      providePrimeNG({}),
      ...provideI18n(),
    ],
  });
  return { auth: TestBed.inject(AuthService), http: TestBed.inject(HttpTestingController) };
}

describe('AuthService', () => {
  beforeEach(() => localStorage.clear());

  it('starts signed out without a stored session', () => {
    const { auth } = setUp();
    expect(auth.isAuthenticated()).toBe(false);
    expect(auth.token()).toBeNull();
  });

  it('restores a valid stored session', () => {
    const session: Session = { token: 'jwt', expiresAt: inHours(1), user };
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));

    const { auth } = setUp();

    expect(auth.token()).toBe('jwt');
    expect(auth.isAdmin()).toBe(true);
  });

  it('discards an expired or corrupted stored session', () => {
    localStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({ token: 'old', expiresAt: inHours(-1), user }),
    );
    expect(setUp().auth.token()).toBeNull();
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();

    TestBed.resetTestingModule();
    localStorage.setItem(SESSION_STORAGE_KEY, '{not json');
    expect(setUp().auth.isAuthenticated()).toBe(false);
  });

  it('persists the session on sign-in and applies the preferred language', () => {
    const { auth, http } = setUp();
    let signedIn: User | undefined;

    auth.signIn({ username: 'ana', password: 'secret123' }).subscribe((u) => (signedIn = u));
    const response: AuthResponse = { token: 'jwt', expiresAt: inHours(4), user };
    http.expectOne('/accountant/auth/sign-in').flush(response);

    expect(signedIn?.username).toBe('ana');
    expect(auth.token()).toBe('jwt');
    expect(JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY) ?? '{}').token).toBe('jwt');
    http.match(() => true).forEach((req) => req.flush({}));
    expect(document.documentElement.lang).toBe('en');
  });

  it('clears the session and goes to sign-in on sign-out', () => {
    localStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({ token: 'jwt', expiresAt: inHours(1), user }),
    );
    const { auth } = setUp();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    auth.signOut('/admin/users');

    expect(auth.isAuthenticated()).toBe(false);
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
    expect(navigate).toHaveBeenCalledWith(['/sign-in'], {
      queryParams: { returnUrl: '/admin/users' },
    });
  });
});
