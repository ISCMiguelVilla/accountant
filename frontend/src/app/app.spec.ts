import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { providePrimeNG } from 'primeng/config';
import { App } from './app';
import { provideI18n } from './core/i18n/i18n.providers';
import { DARK_MODE_CLASS } from './core/theme/accountant-preset';

describe('App', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        providePrimeNG({}),
        MessageService,
        ConfirmationService,
        ...provideI18n(),
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('loads the fallback (es) and the initial language files', () => {
    TestBed.createComponent(App);
    const http = TestBed.inject(HttpTestingController);
    const requests = http.match((req) => /i18n\/(es|en)\.json$/.test(req.url));
    expect(requests.map((req) => req.request.url)).toContain('i18n/es.json');
    requests.forEach((req) => req.flush({ primeng: {} }));
    http.verify();
  });

  it('applies the stored dark mode preference', () => {
    localStorage.setItem('accountant:dark-mode', 'true');
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    expect(document.documentElement.classList.contains(DARK_MODE_CLASS)).toBe(true);
  });
});
