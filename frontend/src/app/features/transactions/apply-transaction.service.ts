import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { ConfirmationService } from 'primeng/api';
import { ErrorNotifier } from '../../core/http/error-notifier.service';
import { Transaction } from '../../shared/models/transaction.model';
import { TransactionApiService } from './transaction-api.service';

/** "Apply" action of a pending transaction (PATCH /transactions/{id}/apply), with confirmation. */
@Injectable({ providedIn: 'root' })
export class ApplyTransactionService {
  private readonly api = inject(TransactionApiService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly translate = inject(TranslateService);
  private readonly notifier = inject(ErrorNotifier);

  confirmApply(transaction: Transaction, applied: () => void): void {
    const temporaryHint =
      transaction.type === 'PROFIT' ? this.translate.instant('transactions.apply.profitHint') : '';
    this.confirmation.confirm({
      header: this.translate.instant('transactions.apply.title'),
      message: `${this.translate.instant(
        `transactions.apply.confirm.${transaction.type === 'EXPENSE' ? 'EXPENSE' : 'TRANSIT'}`,
        {
          description: transaction.description,
        },
      )} ${temporaryHint}`.trim(),
      icon: 'pi pi-check-circle',
      acceptButtonProps: { label: this.translate.instant('transactions.apply.action') },
      rejectButtonProps: {
        label: this.translate.instant('common.cancel'),
        severity: 'secondary',
        text: true,
      },
      accept: () =>
        this.api.apply(transaction.id).subscribe(() => {
          this.notifier.success('transactions.apply.done');
          applied();
        }),
    });
  }
}
