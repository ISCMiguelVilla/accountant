import { HttpErrorResponse } from '@angular/common/http';

/** RFC 7807 body returned by the backend for every error. */
export interface ApiProblem {
  code: string;
  title?: string;
  detail?: string;
  status?: number;
  params?: Record<string, unknown>;
  /** Field → error code (e.g. `NotBlank`, `USERNAME_TAKEN`). */
  errors?: Record<string, string>;
  transactionUuid?: string;
}

export const NETWORK_ERROR = 'NETWORK_ERROR';
export const INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR';

/** Normalizes any HTTP failure into an {@link ApiProblem}. */
export function toApiProblem(error: unknown): ApiProblem {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) {
      return { code: NETWORK_ERROR, status: 0 };
    }
    const body = error.error as Partial<ApiProblem> | null;
    if (body && typeof body === 'object' && typeof body.code === 'string') {
      return { ...body, code: body.code, status: error.status };
    }
    return { code: INTERNAL_SERVER_ERROR, status: error.status };
  }
  return { code: INTERNAL_SERVER_ERROR };
}
