import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  model,
  output,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { MessageModule } from 'primeng/message';
import { TableModule } from 'primeng/table';
import { AccountAvatarComponent } from '../../../shared/components/account-avatar.component';
import { hasBalance } from '../../../shared/enums/account-type.enum';
import { AccountOption } from '../../../shared/models/transaction.model';
import { Cents, fromCents, toCents } from '../../../shared/money/money';
import { MoneyPipe } from '../../../shared/money/money.pipe';
import { ReportAmounts, batchReport } from '../engine/transaction-engine';
import { TransactionDraftStore } from '../draft/transaction-draft.store';

interface AffectedAccount {
  account: AccountOption;
  current: Cents;
  projected: Cents;
  difference: Cents;
  availableCredit: Cents | null;
}

interface Review {
  accounts: AffectedAccount[];
  report: ReportAmounts;
  count: number;
  pending: number;
  /** Temporary accounts disabled by this batch. */
  disabled: string[];
  /** Temporary accounts that a pending PROFIT will disable when applied. */
  disabledOnApply: string[];
  scheduled: number;
}

/** "Review" (docs/documentacion-tecnica.md §11.4): the summary of movements is the control before saving. */
@Component({
  selector: 'app-batch-review-dialog',
  imports: [
    TranslatePipe,
    ButtonModule,
    DialogModule,
    MessageModule,
    TableModule,
    AccountAvatarComponent,
    MoneyPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      [(visible)]="visible"
      [modal]="true"
      [header]="'transactions.review.title' | translate"
      [style]="{ width: '56rem' }"
      [breakpoints]="{ '960px': '95vw' }"
      [dismissableMask]="!saving()"
      [closable]="!saving()"
    >
      @if (review(); as review) {
        <div class="flex flex-col gap-5">
          <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div class="flex flex-col rounded-border border border-surface p-3">
              <span class="text-sm text-muted-color">{{
                'transactions.review.income' | translate
              }}</span>
              <span class="font-mono text-lg text-green-600">{{
                cents(review.report.income) | money
              }}</span>
            </div>
            <div class="flex flex-col rounded-border border border-surface p-3">
              <span class="text-sm text-muted-color">{{
                'transactions.review.expense' | translate
              }}</span>
              <span class="font-mono text-lg text-red-500">{{
                cents(review.report.expense) | money
              }}</span>
            </div>
            <div class="flex flex-col rounded-border border border-surface p-3">
              <span class="text-sm text-muted-color">{{
                'transactions.review.net' | translate
              }}</span>
              <span
                class="font-mono text-lg"
                [class.text-green-600]="review.report.net > 0"
                [class.text-red-500]="review.report.net < 0"
                >{{ cents(review.report.net) | money }}</span
              >
            </div>
            <div class="flex flex-col rounded-border border border-surface p-3">
              <span class="text-sm text-muted-color">{{
                'transactions.review.count' | translate
              }}</span>
              <span class="text-lg">
                {{ review.count }}
                @if (review.pending) {
                  <small class="text-orange-500">
                    ({{ 'transactions.review.pendingCount' | translate: { n: review.pending } }})
                  </small>
                }
              </span>
            </div>
          </div>

          @for (name of review.disabled; track name) {
            <p-message
              severity="warn"
              icon="pi pi-hourglass"
              [text]="'transactions.review.temporaryDisabled' | translate: { name }"
            />
          }
          @for (name of review.disabledOnApply; track name) {
            <p-message
              severity="info"
              icon="pi pi-hourglass"
              [text]="'transactions.review.temporaryDisabledOnApply' | translate: { name }"
            />
          }
          @if (review.pending) {
            <p-message
              severity="info"
              icon="pi pi-clock"
              [text]="'transactions.review.pendingWarning' | translate: { n: review.pending }"
            />
          }
          @if (review.scheduled) {
            <p-message
              severity="info"
              icon="pi pi-calendar"
              [text]="'transactions.review.scheduled' | translate: { n: review.scheduled }"
            />
          }

          <div>
            <h3 class="mt-0 mb-2 text-base font-semibold">
              {{ 'transactions.review.accounts' | translate }}
            </h3>
            <p-table size="small" [value]="review.accounts" [tableStyle]="{ 'min-width': '40rem' }">
              <ng-template #header>
                <tr>
                  <th>{{ 'transactions.account' | translate }}</th>
                  <th class="text-right">{{ 'transactions.review.current' | translate }}</th>
                  <th class="text-right">{{ 'transactions.review.projected' | translate }}</th>
                  <th class="text-right">{{ 'transactions.review.difference' | translate }}</th>
                  <th class="text-right">{{ 'accounts.credit.available' | translate }}</th>
                </tr>
              </ng-template>
              <ng-template #body let-row>
                <tr>
                  <td>
                    <div class="flex items-center gap-2">
                      <app-account-avatar
                        [icon]="row.account.icon"
                        [color]="row.account.color"
                        [type]="row.account.type"
                      />
                      {{ row.account.name }}
                    </div>
                  </td>
                  <td class="text-right font-mono">
                    {{ cents(row.current) | money: row.account.currency.iso }}
                  </td>
                  <td class="text-right font-mono">
                    {{ cents(row.projected) | money: row.account.currency.iso }}
                  </td>
                  <td
                    class="text-right font-mono"
                    [class.text-green-600]="row.difference > 0"
                    [class.text-red-500]="row.difference < 0"
                  >
                    {{ row.difference > 0 ? '+' : '' }}{{ cents(row.difference) | money }}
                  </td>
                  <td class="text-right font-mono">
                    {{ row.availableCredit === null ? '—' : (cents(row.availableCredit) | money) }}
                  </td>
                </tr>
              </ng-template>
            </p-table>
          </div>
        </div>
      }

      <ng-template #footer>
        <p-button
          size="small"
          [label]="'common.cancel' | translate"
          severity="secondary"
          [text]="true"
          [disabled]="saving()"
          (onClick)="visible.set(false)"
        />
        <p-button
          size="small"
          icon="pi pi-save"
          [label]="'transactions.review.save' | translate"
          [loading]="saving()"
          [disabled]="!review()"
          (onClick)="save.emit()"
        />
      </ng-template>
    </p-dialog>
  `,
})
export class BatchReviewDialogComponent {
  private readonly store = inject(TransactionDraftStore);

  readonly visible = model(false);
  readonly saving = input(false);
  readonly save = output<void>();

  protected readonly review = computed<Review | null>(() => {
    const projection = this.store.projection();
    if (!projection.ok) {
      return null;
    }
    const { results, accounts: state } = projection.result;
    const items = this.store.transactions();
    const involved = new Set(
      items.flatMap((item) => [item.originAccountId, item.destinationAccountId ?? -1]),
    );
    const base = this.store.baseAccounts();
    const nameOf = (id: number) => base.find((account) => account.id === id)?.name ?? '';

    const affected = base
      .filter((account) => involved.has(account.id) && hasBalance(account.type))
      .map((account) => {
        const current = toCents(account.balance);
        const projected = state.get(account.id)?.balance ?? current;
        const limit = account.credit ? toCents(account.credit.creditLimit) : null;
        return {
          account,
          current,
          projected,
          difference: projected - current,
          availableCredit: limit === null ? null : Math.max(limit - projected, 0),
        };
      });

    return {
      accounts: affected,
      report: batchReport(results),
      count: items.length,
      pending: items.filter((item) => !item.applied).length,
      disabled: results.filter((r) => r.originDisabled).map((r) => nameOf(r.transaction.originId)),
      disabledOnApply: results
        .filter(
          (r) =>
            r.transaction.type === 'PROFIT' &&
            !r.transaction.applied &&
            base.find((account) => account.id === r.transaction.originId)?.temporary,
        )
        .map((r) => nameOf(r.transaction.originId)),
      scheduled: items.filter((item) => item.scheduleId !== null).length,
    };
  });

  protected cents(value: Cents): number {
    return fromCents(value);
  }
}
