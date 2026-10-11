import { HttpErrorResponse } from '@angular/common/http';
import { safeReturnUrl } from '../../features/auth/sign-in.page';
import { toMessage } from '../forms/field-error.component';
import { toApiProblem } from './api-problem.model';

describe('toApiProblem', () => {
  it('keeps the backend problem body', () => {
    const error = new HttpErrorResponse({
      status: 422,
      error: { code: 'INSUFFICIENT_FUNDS', params: { available: '10.00' } },
    });
    expect(toApiProblem(error)).toEqual({
      code: 'INSUFFICIENT_FUNDS',
      params: { available: '10.00' },
      status: 422,
    });
  });

  it('maps connection failures and unknown bodies', () => {
    expect(toApiProblem(new HttpErrorResponse({ status: 0 })).code).toBe('NETWORK_ERROR');
    expect(toApiProblem(new HttpErrorResponse({ status: 502, error: '<html>' })).code).toBe(
      'INTERNAL_SERVER_ERROR',
    );
  });
});

describe('form error messages', () => {
  it('translates server codes and validator params', () => {
    expect(toMessage({ server: 'USERNAME_TAKEN' })).toEqual({
      key: 'validation.server.USERNAME_TAKEN',
      params: {},
    });
    expect(toMessage({ minlength: { requiredLength: 8, actualLength: 3 } })).toEqual({
      key: 'validation.minlength',
      params: { requiredLength: 8, actualLength: 3 },
    });
  });
});

describe('safeReturnUrl', () => {
  it('only accepts internal paths', () => {
    expect(safeReturnUrl('/admin/users?page=2')).toBe('/admin/users?page=2');
    expect(safeReturnUrl('https://evil.example')).toBe('/home');
    expect(safeReturnUrl('//evil.example')).toBe('/home');
    expect(safeReturnUrl(undefined)).toBe('/home');
  });
});
