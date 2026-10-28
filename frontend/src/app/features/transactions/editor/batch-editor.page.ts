import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { parseISO } from 'date-fns';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { ErrorNotifier } from '../../../core/http/error-notifier.service';
import { LanguageService } from '../../../core/i18n/language.service';
import { ApiProblem, toApiProblem } from '../../../shared/models/api-problem.model';
import { Cents, fromCents } from '../../../shared/money/money';
import { MoneyPipe } from '../../../shared/money/money.pipe';
import {
  OperationTypeSeverityPipe,
  TransactionTypeIconPipe,
} from '../../../shared/pipes/transaction-type.pipes';
import { EngineError, EngineResult } from '../engine/transaction-engine';
import { DraftTransaction, TransactionDraftStore } from '../draft/transaction-draft.store';
import { TransactionApiService } from '../transaction-api.service';
import { TransactionErrorMessages } from '../transaction-error-messages';
import { BatchReviewDialogComponent } from './batch-review-dialog.component';
import { TransactionFormComponent } from './transaction-form.component';

interface BatchRow {
  item: DraftTransaction;
  /** Capture position (1-based), the number the messages refer to. */
  number: number;
  result: EngineResult | null;
  failed: boolean;
}

/** Batch editor (PROMPT 5.6): capture locally, review the summary, save atomically. */
@Component({
  selector: 'app-batch-editor-page',
  imports: [
    DatePipe,
    TranslatePipe,
    ButtonModule,
    MessageModule,
    ProgressSpinnerModule,
    TableModule,
    TagModule,
    TooltipModule,
    BatchReviewDialogComponent,
    MoneyPipe,
    OperationTypeSeverityPipe,
    TransactionFormComponent,
    TransactionTypeIconPipe,
  ],
  providers: [TransactionDraftStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h1 class="m-0 text-2xl font-semibold">{{ 'transactions.batch.title' | translate }}</h1>
      <div class="flex gap-2">
        <p-button
          icon="pi pi-trash"
          [label]="'transactions.batch.clear' | translate"
          severity="secondary"
          [outlined]="true"
          [disabled]="!store.transactions().length"
          (onClick)="confirmClear()"
        />
        <p-button
          icon="pi pi-list-check"
          [label]="'transactions.batch.review' | translate"
          [disabled]="!store.transactions().length || !store.projection().ok"
          (onClick)="reviewVisible.set(true)"
        />
      </div>
    </div>

    @if (loading()) {
      <div class="flex justify-center p-8"><p-progressspinner /></div>
    } @else if (loadError()) {
      <p-message severity="error" [text]="loadError()!" />
    } @else {
      <div class="flex flex-col gap-4">
        @if (changedNames(); as names) {
          <div class="flex flex-wrap items-center gap-2">
            <p-message
              severity="warn"
              icon="pi pi-refresh"
              styleClass="flex-1"
              [text]="'transactions.batch.baseChanged' | translate: { names }"
            />
            <p-button
              [label]="'transactions.batch.understood' | translate"
              [text]="true"
              (onClick)="store.dismissBaseChange()"
            />
          </div>
        }
        @if (draftError(); as message) {
          <p-message severity="error" icon="pi pi-times-circle" [text]="message" />
        }

        <app-transaction-form [editing]="editing()" (done)="editing.set(null)" />

        <p-table
          [value]="rows()"
          dataKey="item.uuid"
          [tableStyle]="{ 'min-width': '72rem' }"
          [rowHover]="true"
        >
          <ng-template #header>
            <tr>
              <th class="w-12">#</th>
              <th>{{ 'transactions.operationDate' | translate }}</th>
              <th>{{ 'transactions.type' | translate }}</th>
              <th>{{ 'transactions.origin' | translate }}</th>
              <th>{{ 'transactions.destination' | translate }}</th>
              <th class="text-right">{{ 'transactions.amount' | translate }}</th>
              <th class="text-right">{{ 'transactions.fee' | translate }}</th>
              <th>{{ 'transactions.operationType' | translate }}</th>
              <th class="w-28"></th>
            </tr>
          </ng-template>
          <ng-template #body let-row>
            <tr [style.background]="rowBackground(row)">
              <td class="text-muted-color">{{ row.number }}</td>
              <td class="whitespace-nowrap">
                {{ parse(row.item.operationDate) | date: 'short' : undefined : language.locale() }}
                @if (!row.item.applied) {
                  <p-tag
                    severity="warn"
                    styleClass="ml-1"
                    [value]="'transactions.pendingTag' | translate"
                  />
                }
              </td>
              <td>
                <div class="flex flex-col">
                  <span class="whitespace-nowrap">
                    <i [class]="row.item.type | transactionTypeIcon" class="mr-1"></i>
                    {{ 'enums.transactionType.' + row.item.type | translate }}
                  </span>
                  <small
                    class="max-w-56 truncate text-muted-color"
                    [pTooltip]="row.item.description"
                    >{{ row.item.description }}</small
                  >
                </div>
              </td>
              <td>
                <div class="flex flex-col">
                  <span>{{ nameOf(row.item.originAccountId) }}</span>
                  @if (row.result?.originBalanceBefore !== null && row.result) {
                    <small class="font-mono text-muted-color whitespace-nowrap">
                      {{ cents(row.result.originBalanceBefore) | money }} →
                      {{ cents(row.result.originBalanceAfter) | money }}
                    </small>
                  }
                </div>
              </td>
              <td>
                @if (row.item.destinationAccountId !== null) {
                  <div class="flex flex-col">
                    <span>{{ nameOf(row.item.destinationAccountId) }}</span>
                    @if (row.result?.destinationBalanceBefore !== null && row.result) {
                      <small class="font-mono text-muted-color whitespace-nowrap">
                        {{ cents(row.result.destinationBalanceBefore) | money }} →
                        {{ cents(row.result.destinationBalanceAfter) | money }}
                      </small>
                    }
                  </div>
                } @else {
                  —
                }
              </td>
              <td class="text-right font-mono whitespace-nowrap">
                {{ cents(row.item.amount) | money }}
              </td>
              <td class="text-right font-mono whitespace-nowrap">
                {{ row.item.fee ? (cents(row.item.fee) | money) : '—' }}
              </td>
              <td>
                @if (row.result) {
                  <p-tag
                    [value]="'enums.operationType.' + row.result.operationType | translate"
                    [severity]="row.result.operationType | operationTypeSeverity"
                  />
                }
              </td>
              <td class="whitespace-nowrap text-right">
                <p-button
                  icon="pi pi-pencil"
                  [text]="true"
                  [rounded]="true"
                  severity="secondary"
                  [ariaLabel]="'common.edit' | translate"
                  [pTooltip]="'common.edit' | translate"
                  (onClick)="editing.set(row.item)"
                />
                <p-button
                  icon="pi pi-trash"
                  [text]="true"
                  [rounded]="true"
                  severity="danger"
                  [ariaLabel]="'common.delete' | translate"
                  [pTooltip]="'common.delete' | translate"
                  (onClick)="remove(row.item)"
                />
              </td>
            </tr>
          </ng-template>
          <ng-template #emptymessage>
            <tr>
              <td colspan="9" class="text-center text-muted-color">
                {{ 'transactions.batch.empty' | translate }}
              </td>
            </tr>
          </ng-template>
        </p-table>
      </div>
    }

    <app-batch-review-dialog [(visible)]="reviewVisible" [saving]="saving()" (save)="save()" />
  `,
})
export class BatchEditorPage {
  protected readonly store = inject(TransactionDraftStore);
  private readonly api = inject(TransactionApiService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly messages = inject(MessageService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly notifier = inject(ErrorNotifier);
  private readonly errors = inject(TransactionErrorMessages);
  protected readonly language = inject(LanguageService);

  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly reviewVisible = signal(false);
  protected readonly editing = signal<DraftTransaction | null>(null);

  protected readonly rows = computed<BatchRow[]>(() => {
    const items = this.store.transactions();
    const projection = this.store.projection();
    const numbered = (item: DraftTransaction) => items.indexOf(item) + 1;
    if (projection.ok) {
      return projection.result.results.map((result) => {
        const item = items.find((i) => i.uuid === result.transaction.uuid)!;
        return { item, number: numbered(item), result, failed: false };
      });
    }
    return items.map((item) => ({
      item,
      number: numbered(item),
      result: null,
      failed: item.uuid === projection.error.transactionUuid,
    }));
  });

  protected readonly changedNames = computed(() => {
    const ids = this.store.changedAccounts();
    return ids.length ? ids.map((id) => this.nameOf(id) || `#${id}`).join(', ') : null;
  });

  /** A restored draft that no longer fits the current balances. */
  protected readonly draftError = computed(() => {
    const projection = this.store.projection();
    return projection.ok ? null : this.failureMessage(projection.error);
  });

  constructor() {
    this.load();
  }

  protected nameOf(id: number): string {
    return this.store.baseAccounts().find((account) => account.id === id)?.name ?? '';
  }

  protected cents(value: Cents | null): number | null {
    return value === null ? null : fromCents(value);
  }

  protected rowBackground(row: BatchRow): string | null {
    if (row.failed) {
      return 'color-mix(in srgb, var(--p-red-500) 15%, transparent)';
    }
    return this.editing()?.uuid === row.item.uuid
      ? 'color-mix(in srgb, var(--p-primary-color) 12%, transparent)'
      : null;
  }

  protected parse(date: string): Date {
    return parseISO(date);
  }

  protected remove(item: DraftTransaction): void {
    const error = this.store.remove(item.uuid);
    if (error) {
      this.stickyError(this.failureMessage(error));
    } else if (this.editing()?.uuid === item.uuid) {
      this.editing.set(null);
    }
  }

  protected confirmClear(): void {
    this.confirmation.confirm({
      header: this.translate.instant('transactions.batch.clear'),
      message: this.translate.instant('transactions.batch.clearConfirm'),
      icon: 'pi pi-exclamation-triangle',
      acceptButtonProps: {
        label: this.translate.instant('transactions.batch.clear'),
        severity: 'danger',
      },
      rejectButtonProps: {
        label: this.translate.instant('common.cancel'),
        severity: 'secondary',
        text: true,
      },
      accept: () => {
        this.store.clear();
        this.editing.set(null);
        this.messages.clear();
      },
    });
  }

  protected save(): void {
    this.saving.set(true);
    this.api.saveBatch(this.store.batchRequest()).subscribe({
      next: (response) => {
        this.saving.set(false);
        this.reviewVisible.set(false);
        this.store.clear();
        this.messages.clear();
        this.notifier.success('transactions.batch.saved', { n: response.transactions.length });
        void this.router.navigate(['/transactions'], {
          queryParams: { batchUuid: response.batchUuid },
        });
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.reviewVisible.set(false);
        const problem = toApiProblem(error);
        this.stickyError(this.problemMessage(problem));
        if (problem.code === 'CONFLICT' || problem.code === 'RESOURCE_NOT_FOUND') {
          // Some account changed meanwhile: recompute the draft over the current balances.
          this.load();
        }
      },
    });
  }

  private load(): void {
    const user = this.auth.user();
    if (!user) {
      return;
    }
    this.loading.set(true);
    forkJoin({ rules: this.api.rules(), accounts: this.api.accountOptions() }).subscribe({
      next: ({ rules, accounts }) => {
        this.store.init(user.id, rules, accounts);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loadError.set(this.notifier.message(toApiProblem(error)));
        this.loading.set(false);
      },
    });
  }

  private failureMessage(error: EngineError): string {
    const item = this.store.transactions().find((i) => i.uuid === error.transactionUuid);
    return this.translate.instant('transactions.batch.failedAt', {
      n: this.store.indexOf(error.transactionUuid) + 1,
      description: item?.description ?? '',
      message: this.errors.fromEngine(error, (id) => this.nameOf(id)),
    }) as string;
  }

  private problemMessage(problem: ApiProblem): string {
    const message = this.errors.message(problem, (id) => this.nameOf(id));
    const uuid = problem.transactionUuid;
    if (!uuid) {
      return message;
    }
    const item = this.store.transactions().find((i) => i.uuid === uuid);
    return this.translate.instant('transactions.batch.failedAt', {
      n: this.store.indexOf(uuid) + 1,
      description: item?.description ?? '',
      message,
    }) as string;
  }

  private stickyError(detail: string): void {
    this.messages.add({
      severity: 'error',
      summary: this.translate.instant('common.error') as string,
      detail,
      sticky: true,
    });
  }
}
