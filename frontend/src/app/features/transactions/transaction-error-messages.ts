import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { ErrorNotifier } from '../../core/http/error-notifier.service';
import { LanguageService } from '../../core/i18n/language.service';
import { ApiProblem } from '../../shared/models/api-problem.model';
import { fromCents, formatAmount } from '../../shared/money/money';
import { EngineError } from './engine/transaction-engine';

/** Accounts known by the page, to name them in the messages. */
export type AccountNames = (id: number) => string | undefined;

/**
 * Messages of transaction errors, from the client engine or from the API (same codes): names the
 * account and formats the amounts (`transactions.errors.<CODE>`, falling back to `errors.<CODE>`).
 */
@Injectable({ providedIn: 'root' })
export class TransactionErrorMessages {
  private readonly translate = inject(TranslateService);
  private readonly notifier = inject(ErrorNotifier);
  private readonly language = inject(LanguageService);

  fromEngine(error: EngineError, names: AccountNames): string {
    const params: Record<string, unknown> = { ...error.params };
    for (const key of ['available', 'required']) {
      if (typeof params[key] === 'number') {
        params[key] = fromCents(params[key]);
      }
    }
    return this.message(
      {
        code: error.code,
        params,
        errors: error.field && error.fieldCode ? { [error.field]: error.fieldCode } : undefined,
      },
      names,
    );
  }

  message(problem: ApiProblem, names: AccountNames): string {
    const fieldCode = Object.values(problem.errors ?? {})[0];
    if (problem.code === 'VALIDATION_ERROR' && fieldCode) {
      const key = `validation.server.${fieldCode}`;
      const translated = this.translate.instant(key) as string;
      if (translated !== key) {
        return translated;
      }
    }
    const params = problem.params ?? {};
    const accountId = Number(params['accountId']);
    const locale = this.language.locale();
    const detailed = {
      ...params,
      account: names(accountId) ?? '',
      available: formatAmount(params['available'] as number | string | undefined, locale),
      required: formatAmount(params['required'] as number | string | undefined, locale),
      date:
        typeof params['lastOperationDate'] === 'string'
          ? formatDate(params['lastOperationDate'], locale)
          : '',
    };
    const key = `transactions.errors.${problem.code}`;
    const translated = this.translate.instant(key, detailed) as string;
    return translated === key ? this.notifier.message(problem) : translated;
  }
}

function formatDate(value: string, locale: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });
}
