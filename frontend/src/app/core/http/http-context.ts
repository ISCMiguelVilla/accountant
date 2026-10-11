import { HttpContextToken } from '@angular/common/http';

/** Set on requests whose errors are shown by the caller (e.g. forms) instead of a global toast. */
export const SKIP_ERROR_TOAST = new HttpContextToken<boolean>(() => false);
