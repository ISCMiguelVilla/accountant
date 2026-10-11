import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';

describe('authInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;
  const auth = { token: vi.fn<() => string | null>(), signOut: vi.fn() };

  beforeEach(() => {
    auth.token.mockReset().mockReturnValue('jwt');
    auth.signOut.mockReset();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: auth },
      ],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
  });

  it('adds the bearer token to API calls', () => {
    http.get('/accountant/me').subscribe();
    const request = controller.expectOne('/accountant/me');
    expect(request.request.headers.get('Authorization')).toBe('Bearer jwt');
    request.flush({});
  });

  it('does not send the token to auth endpoints or non API URLs', () => {
    http.post('/accountant/auth/sign-in', {}).subscribe();
    http.get('i18n/es.json').subscribe();
    expect(
      controller.expectOne('/accountant/auth/sign-in').request.headers.has('Authorization'),
    ).toBe(false);
    expect(controller.expectOne('i18n/es.json').request.headers.has('Authorization')).toBe(false);
  });

  it('signs out when an authenticated call returns 401', () => {
    http.get('/accountant/me').subscribe({ error: () => undefined });
    controller
      .expectOne('/accountant/me')
      .flush({ code: 'BAD_CREDENTIALS' }, { status: 401, statusText: 'Unauthorized' });
    expect(auth.signOut).toHaveBeenCalledTimes(1);
  });

  it('leaves 401 of sign-in to the form', () => {
    http.post('/accountant/auth/sign-in', {}).subscribe({ error: () => undefined });
    controller
      .expectOne('/accountant/auth/sign-in')
      .flush({ code: 'BAD_CREDENTIALS' }, { status: 401, statusText: 'Unauthorized' });
    expect(auth.signOut).not.toHaveBeenCalled();
  });
});
