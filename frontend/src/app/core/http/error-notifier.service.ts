import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { ApiProblem, INTERNAL_SERVER_ERROR } from '../../shared/models/api-problem.model';

/** Translates API problems (code + params) into user facing messages and toasts. */
@Injectable({ providedIn: 'root' })
export class ErrorNotifier {
  private readonly translate = inject(TranslateService);
  private readonly messages = inject(MessageService);

  message(problem: ApiProblem): string {
    // A more specific message per reason, e.g. errors.ACCOUNT_NOT_DELETABLE_BALANCE.
    const reason = problem.params?.['reason'];
    if (typeof reason === 'string') {
      const specificKey = `errors.${problem.code}_${reason}`;
      const specific = this.translate.instant(specificKey, problem.params) as string;
      if (specific !== specificKey) {
        return specific;
      }
    }
    const key = `errors.${problem.code}`;
    const translated = this.translate.instant(key, problem.params ?? {}) as string;
    return translated === key
      ? (this.translate.instant(`errors.${INTERNAL_SERVER_ERROR}`) as string)
      : translated;
  }

  notify(problem: ApiProblem): void {
    this.messages.add({
      severity: 'error',
      summary: this.translate.instant('common.error') as string,
      detail: this.message(problem),
      life: 6000,
    });
  }

  success(key: string, params?: Record<string, unknown>): void {
    this.messages.add({
      severity: 'success',
      summary: this.translate.instant('common.done') as string,
      detail: this.translate.instant(key, params ?? {}) as string,
      life: 3000,
    });
  }
}
