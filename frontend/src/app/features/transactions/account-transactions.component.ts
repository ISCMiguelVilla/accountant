import { HttpParams } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { LanguageService } from '../../core/i18n/language.service';
import { Transaction } from '../../shared/models/transaction.model';
import { fromCents } from '../../shared/money/money';
import { MoneyPipe } from '../../shared/money/money.pipe';
import { TransactionTypeIconPipe } from '../../shared/pipes/transaction-type.pipes';
import { ApplyTransactionService } from './apply-transaction.service';
import { TransactionApiService } from './transaction-api.service';
import { effectOn, isPendingOn } from './transaction-effect';

/** Last transactions where the account is origin or destination (account detail). */
@Component({
  selector: 'app-account-transactions',
  imports: [
    DatePipe,
    RouterLink,
    TranslatePipe,
    ButtonModule,
    TableModule,
    TagModule,
    TooltipModule,
    MoneyPipe,
    TransactionTypeIconPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (data.value()?.content; as transactions) {
      @if (transactions.length) {
        <p-table
          size="small"
          [value]="transactions"
          dataKey="id"
          [tableStyle]="{ 'min-width': '52rem' }"
        >
          <ng-template #header>
            <tr>
              <th>{{ 'transactions.operationDate' | translate }}</th>
              <th>{{ 'transactions.type' | translate }}</th>
              <th>{{ 'transactions.counterparty' | translate }}</th>
              <th class="text-right">{{ 'transactions.amount' | translate }}</th>
              <th class="text-right">{{ 'transactions.balanceBeforeAfter' | translate }}</th>
              <th>{{ 'transactions.applied' | translate }}</th>
            </tr>
          </ng-template>
          <ng-template #body let-tx>
            <tr>
              <td class="whitespace-nowrap">
                {{ tx.operationDate | date: 'short' : undefined : language.locale() }}
              </td>
              <td class="whitespace-nowrap" [pTooltip]="tx.description">
                <i [class]="tx.type | transactionTypeIcon" class="mr-1"></i>
                {{ 'enums.transactionType.' + tx.type | translate }}
              </td>
              <td>
                @if (counterparty(tx); as other) {
                  <a [routerLink]="['/accounts', other.id]">{{ other.name }}</a>
                } @else {
                  —
                }
              </td>
              <td
                class="text-right font-mono whitespace-nowrap"
                [class.text-green-600]="effect(tx) > 0"
                [class.text-red-500]="effect(tx) < 0"
                [class.opacity-60]="pending(tx)"
              >
                {{ effect(tx) > 0 ? '+' : '' }}{{ effect(tx) | money: tx.currency?.iso }}
              </td>
              <td class="text-right font-mono whitespace-nowrap text-muted-color">
                @if (before(tx) !== null) {
                  {{ before(tx) | money }} → {{ after(tx) | money }}
                } @else {
                  —
                }
              </td>
              <td>
                @if (tx.applied) {
                  <p-tag severity="success" [value]="'common.yes' | translate" />
                } @else {
                  <p-button
                    icon="pi pi-check"
                    size="small"
                    severity="warn"
                    [outlined]="true"
                    [label]="'transactions.apply.action' | translate"
                    (onClick)="apply(tx)"
                  />
                }
              </td>
            </tr>
          </ng-template>
        </p-table>
        <div class="mt-3 text-right">
          <a [routerLink]="['/transactions']" [queryParams]="{ accountId: accountId() }">
            {{ 'transactions.viewAll' | translate }} <i class="pi pi-arrow-right text-xs"></i>
          </a>
        </div>
      } @else {
        <p class="m-0 text-muted-color">{{ 'transactions.noneForAccount' | translate }}</p>
      }
    }
  `,
})
export class AccountTransactionsComponent {
  private readonly api = inject(TransactionApiService);
  private readonly applyAction = inject(ApplyTransactionService);
  protected readonly language = inject(LanguageService);

  readonly accountId = input.required<number>();
  /** Emitted after applying a transaction (the account balance changed). */
  readonly changed = output<void>();

  protected readonly data = rxResource({
    params: () => this.accountId(),
    stream: ({ params: id }) =>
      this.api.findByAccount(
        id,
        new HttpParams().set('size', 10).set('sort', 'operationDate,desc'),
      ),
  });

  protected counterparty(tx: Transaction) {
    return tx.origin.id === this.accountId() ? tx.destination : tx.origin;
  }

  protected effect(tx: Transaction): number {
    return fromCents(effectOn(tx, this.accountId()));
  }

  protected pending(tx: Transaction): boolean {
    return isPendingOn(tx, this.accountId());
  }

  protected before(tx: Transaction): number | null {
    return tx.origin.id === this.accountId() ? tx.originBalanceBefore : tx.destinationBalanceBefore;
  }

  protected after(tx: Transaction): number | null {
    return tx.origin.id === this.accountId() ? tx.originBalanceAfter : tx.destinationBalanceAfter;
  }

  protected apply(tx: Transaction): void {
    this.applyAction.confirmApply(tx, () => {
      this.data.reload();
      this.changed.emit();
    });
  }
}
