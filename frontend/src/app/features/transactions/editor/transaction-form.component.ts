import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgTemplateOutlet } from '@angular/common';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { format, parseISO } from 'date-fns';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DatePickerModule } from 'primeng/datepicker';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { TooltipModule } from 'primeng/tooltip';
import { map } from 'rxjs';
import { LanguageService } from '../../../core/i18n/language.service';
import { AccountAvatarComponent } from '../../../shared/components/account-avatar.component';
import { hasBalance } from '../../../shared/enums/account-type.enum';
import { TRANSACTION_TYPES, TransactionType } from '../../../shared/enums/transaction-type.enum';
import { FieldErrorComponent } from '../../../shared/forms/field-error.component';
import { Schedule } from '../../../shared/models/schedule.model';
import { AccountOption } from '../../../shared/models/transaction.model';
import { Cents, fromCents, toCents } from '../../../shared/money/money';
import { MoneyPipe } from '../../../shared/money/money.pipe';
import { TransactionTypeIconPipe } from '../../../shared/pipes/transaction-type.pipes';
import { DraftTransaction, TransactionDraftStore } from '../draft/transaction-draft.store';
import { TransactionErrorMessages } from '../transaction-error-messages';

/** Local date-time as the API expects it (`yyyy-MM-ddTHH:mm:ss`). */
export function toLocalIso(date: Date): string {
  return format(date, "yyyy-MM-dd'T'HH:mm:ss");
}

interface BalancePreview {
  account: AccountOption;
  before: Cents | null;
  after: Cents | null;
  /** Credit available after the transaction (DEBTOR with credit line). */
  availableCredit: Cents | null;
  pending: boolean;
}

/**
 * Form of one transaction of the batch, with the live preview of the balances before / after it
 * (PROMPT 5.4). Selectors and enabled fields come from the rules; balances from the draft projection.
 */
@Component({
  selector: 'app-transaction-form',
  imports: [
    NgTemplateOutlet,
    ReactiveFormsModule,
    TranslatePipe,
    ButtonModule,
    CardModule,
    DatePickerModule,
    InputNumberModule,
    InputTextModule,
    MessageModule,
    SelectModule,
    ToggleSwitchModule,
    TooltipModule,
    AccountAvatarComponent,
    FieldErrorComponent,
    MoneyPipe,
    TransactionTypeIconPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card>
      <form class="flex flex-col gap-4" [formGroup]="form" (ngSubmit)="save()">
        @if (scheduled()) {
          <p-message
            severity="info"
            icon="pi pi-calendar"
            [text]="'transactions.fromSchedule' | translate"
          />
        }
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div class="flex flex-col gap-2">
            <label for="type">{{ 'transactions.type' | translate }}</label>
            <p-select
              size="small"
              inputId="type"
              formControlName="type"
              [options]="types"
              styleClass="w-full"
            >
              <ng-template #selectedItem let-type>
                <i [class]="type | transactionTypeIcon" class="mr-2"></i
                >{{ 'enums.transactionType.' + type | translate }}
              </ng-template>
              <ng-template #item let-type>
                <div class="flex flex-col">
                  <span>
                    <i [class]="type | transactionTypeIcon" class="mr-2"></i
                    >{{ 'enums.transactionType.' + type | translate }}
                  </span>
                  <small class="text-muted-color">{{
                    'transactions.typeHelp.' + type | translate
                  }}</small>
                </div>
              </ng-template>
            </p-select>
          </div>

          <div class="flex flex-col gap-2">
            <label for="origin">{{ 'transactions.origin' | translate }}</label>
            <p-select
              size="small"
              inputId="origin"
              formControlName="originAccountId"
              [options]="originOptions()"
              optionValue="id"
              optionLabel="name"
              [filter]="true"
              [placeholder]="'transactions.selectAccount' | translate"
              styleClass="w-full"
            >
              <ng-template #selectedItem let-account>
                <ng-container
                  *ngTemplateOutlet="accountItem; context: { $implicit: account }"
                ></ng-container>
              </ng-template>
              <ng-template #item let-account>
                <ng-container
                  *ngTemplateOutlet="accountItem; context: { $implicit: account }"
                ></ng-container>
              </ng-template>
            </p-select>
            <app-field-error [control]="form.controls.originAccountId" />
          </div>

          @if (rule()?.destinationMode !== 'NONE') {
            <div class="flex flex-col gap-2">
              <label for="destination">
                {{ 'transactions.destination' | translate }}
                @if (rule()?.destinationMode === 'OPTIONAL') {
                  <small class="text-muted-color">({{ 'common.optional' | translate }})</small>
                }
              </label>
              <p-select
                size="small"
                inputId="destination"
                formControlName="destinationAccountId"
                [options]="destinationOptions()"
                optionValue="id"
                optionLabel="name"
                [filter]="true"
                [showClear]="rule()?.destinationMode === 'OPTIONAL'"
                [placeholder]="'transactions.selectAccount' | translate"
                styleClass="w-full"
              >
                <ng-template #selectedItem let-account>
                  <ng-container
                    *ngTemplateOutlet="accountItem; context: { $implicit: account }"
                  ></ng-container>
                </ng-template>
                <ng-template #item let-account>
                  <ng-container
                    *ngTemplateOutlet="accountItem; context: { $implicit: account }"
                  ></ng-container>
                </ng-template>
              </p-select>
              <app-field-error [control]="form.controls.destinationAccountId" />
            </div>
          }

          <div class="flex flex-col gap-2">
            <label for="amount">{{ 'transactions.amount' | translate }}</label>
            <div class="flex gap-2">
              <p-inputnumber
                size="small"
                inputId="amount"
                formControlName="amount"
                mode="decimal"
                [minFractionDigits]="2"
                [maxFractionDigits]="2"
                [min]="0"
                [locale]="language.locale()"
                class="flex-1"
                styleClass="w-full"
              />
              @if (canUseTotal()) {
                <p-button
                  size="small"
                  icon="pi pi-arrow-circle-down"
                  severity="secondary"
                  [outlined]="true"
                  [pTooltip]="'transactions.useTotal' | translate"
                  [ariaLabel]="'transactions.useTotal' | translate"
                  (onClick)="useTotal()"
                />
              }
            </div>
            <app-field-error [control]="form.controls.amount" />
          </div>

          <div class="flex flex-col gap-2">
            <label for="fee">{{ 'transactions.fee' | translate }}</label>
            <p-inputnumber
              size="small"
              inputId="fee"
              formControlName="fee"
              mode="decimal"
              [minFractionDigits]="2"
              [maxFractionDigits]="2"
              [min]="0"
              [locale]="language.locale()"
              styleClass="w-full"
            />
            @if (!feeEnabled()) {
              <small class="text-muted-color">{{ 'transactions.feeDisabled' | translate }}</small>
            }
          </div>

          <div class="flex flex-col gap-2">
            <label for="date">{{ 'transactions.operationDate' | translate }}</label>
            <p-datepicker
              size="small"
              inputId="date"
              formControlName="operationDate"
              [showTime]="true"
              hourFormat="24"
              [minDate]="minDate()"
              [showIcon]="true"
              appendTo="body"
              styleClass="w-full"
            />
            @if (minDate(); as min) {
              <small class="text-muted-color">{{
                'transactions.minDate' | translate: { date: min.toLocaleString(language.locale()) }
              }}</small>
            }
          </div>

          <div class="flex flex-col gap-2 md:col-span-2">
            <label for="description">{{ 'transactions.description' | translate }}</label>
            <input
              pInputText
              pSize="small"
              id="description"
              formControlName="description"
              (input)="descriptionEdited.set(!!form.controls.description.value)"
            />
            <app-field-error [control]="form.controls.description" />
          </div>

          @if (rule()?.pendingAllowed) {
            <div class="flex flex-col gap-2">
              <label for="pending">{{ 'transactions.pending' | translate }}</label>
              <div class="flex items-center gap-3">
                <p-toggleswitch size="small" inputId="pending" formControlName="pending" />
                <small class="text-muted-color">{{
                  'transactions.pendingHelp.' + value().type | translate
                }}</small>
              </div>
            </div>
          }
        </div>

        @if (balances().length) {
          <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
            @for (balance of balances(); track balance.account.id) {
              <div
                class="flex flex-col gap-1 rounded-border border border-surface p-3"
                [class.border-red-500]="!!errorMessage()"
              >
                <span class="text-sm text-muted-color">{{ balance.account.name }}</span>
                <span class="font-mono">
                  {{ cents(balance.before) | money: balance.account.currency.iso }}
                  <i class="pi pi-arrow-right mx-1 text-xs"></i>
                  @if (balance.after !== null) {
                    <span [class.text-red-500]="balance.after < 0">{{
                      cents(balance.after) | money: balance.account.currency.iso
                    }}</span>
                  } @else {
                    <span [class.text-red-500]="!!errorMessage()">—</span>
                  }
                </span>
                @if (balance.pending) {
                  <small class="text-orange-500">{{
                    'transactions.pendingPreview' | translate
                  }}</small>
                }
                @if (balance.availableCredit !== null) {
                  <small class="text-muted-color">
                    {{ 'transactions.availableCreditAfter' | translate }}:
                    {{ cents(balance.availableCredit) | money: balance.account.currency.iso }}
                  </small>
                }
              </div>
            }
          </div>
        }

        @if (errorMessage(); as message) {
          <p-message severity="error" [text]="message" />
        }

        <div class="flex flex-wrap justify-end gap-2">
          @if (editing() || scheduled()) {
            <p-button
              size="small"
              [label]="'common.cancel' | translate"
              severity="secondary"
              [text]="true"
              (onClick)="cancel()"
            />
          }
          <p-button
            size="small"
            type="submit"
            [icon]="editing() ? 'pi pi-check' : 'pi pi-plus'"
            [label]="(editing() ? 'transactions.update' : 'transactions.add') | translate"
          />
        </div>
      </form>
    </p-card>

    <ng-template #accountItem let-account>
      @if (account) {
        <div class="flex items-center gap-2">
          <app-account-avatar [icon]="account.icon" [color]="account.color" [type]="account.type" />
          <span class="flex-1 truncate">{{ account.name }}</span>
          @if (account.balance !== null) {
            <span class="font-mono text-sm text-muted-color">{{
              account.balance | money: account.currency.iso
            }}</span>
          }
        </div>
      }
    </ng-template>
  `,
})
export class TransactionFormComponent {
  private readonly store = inject(TransactionDraftStore);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly translate = inject(TranslateService);
  private readonly messages = inject(MessageService);
  private readonly errors = inject(TransactionErrorMessages);
  protected readonly language = inject(LanguageService);

  /** Transaction being edited; null captures a new one. */
  readonly editing = input<DraftTransaction | null>(null);
  readonly done = output<void>();

  protected readonly types = [...TRANSACTION_TYPES];
  protected readonly descriptionEdited = signal(false);
  private readonly uuid = signal<string>(crypto.randomUUID());
  private readonly scheduleId = signal<number | null>(null);
  protected readonly scheduled = computed(() => this.scheduleId() !== null);
  /** Shown after a rejected add / update until the form changes. */
  private readonly rejected = signal<string | null>(null);

  protected readonly form = this.fb.group({
    type: this.fb.control<TransactionType>('EXPENSE'),
    originAccountId: this.fb.control<number | null>(null, Validators.required),
    destinationAccountId: this.fb.control<number | null>(null),
    amount: this.fb.control<number | null>(null, [Validators.required, Validators.min(0.01)]),
    fee: this.fb.control<number | null>(0),
    operationDate: this.fb.control<Date>(new Date(), Validators.required),
    pending: this.fb.control(false),
    description: this.fb.control('', [
      Validators.required,
      Validators.minLength(3),
      Validators.maxLength(255),
    ]),
  });

  protected readonly value = toSignal(
    this.form.valueChanges.pipe(map(() => this.form.getRawValue())),
    { initialValue: this.form.getRawValue() },
  );

  protected readonly rule = computed(() => this.store.rule(this.value().type));
  private readonly accounts = computed(() => this.store.projectedAccounts());
  private readonly origin = computed(() => this.accountOf(this.value().originAccountId));
  private readonly destination = computed(() => this.accountOf(this.value().destinationAccountId));

  protected readonly originOptions = computed(() =>
    this.optionsFor(
      this.rule()?.origins ?? [],
      this.value().destinationAccountId,
      this.value().originAccountId,
    ),
  );
  protected readonly destinationOptions = computed(() =>
    this.optionsFor(
      this.rule()?.destinations ?? [],
      this.value().originAccountId,
      this.value().destinationAccountId,
    ),
  );

  protected readonly feeEnabled = computed(() => {
    const rule = this.rule();
    const origin = this.origin();
    if (!rule) {
      return true;
    }
    if (origin && (this.destination() || rule.destinationMode !== 'REQUIRED')) {
      const variant = this.store.variant(rule.type, origin.type, this.destination()?.type ?? null);
      return variant?.feeEnabled ?? true;
    }
    return rule.variants.some((variant) => variant.feeEnabled);
  });

  /** The date cannot be before the last persisted transaction of the chosen accounts. */
  protected readonly minDate = computed<Date | null>(() => {
    const dates = [this.origin(), this.destination()]
      .map((account) => account?.lastOperationDate)
      .filter((date): date is string => !!date)
      .sort();
    return dates.length ? parseISO(dates[dates.length - 1]) : null;
  });

  private readonly candidate = computed<DraftTransaction | null>(() => {
    const value = this.value();
    if (!value.originAccountId || !value.operationDate) {
      return null;
    }
    return {
      uuid: this.uuid(),
      type: value.type,
      originAccountId: value.originAccountId,
      destinationAccountId:
        this.rule()?.destinationMode === 'NONE' ? null : value.destinationAccountId,
      amount: toCents(value.amount),
      fee: this.feeEnabled() ? toCents(value.fee) : 0,
      description: value.description.trim(),
      descriptionEdited: this.descriptionEdited(),
      applied: !(this.rule()?.pendingAllowed && value.pending),
      operationDate: toLocalIso(value.operationDate),
      scheduleId: this.scheduleId(),
    };
  });

  private readonly preview = computed(() => {
    const candidate = this.candidate();
    return candidate ? this.store.preview(candidate) : null;
  });

  protected readonly errorMessage = computed(() => {
    const rejected = this.rejected();
    if (rejected) {
      return rejected;
    }
    const preview = this.preview();
    if (!preview?.error || !this.value().amount) {
      return null;
    }
    const error = preview.error;
    const message = this.errors.fromEngine(error, (id) => this.accountOf(id)?.name);
    return error.transactionUuid === this.uuid()
      ? message
      : this.translate.instant('transactions.breaksLater', {
          n: this.store.indexOf(error.transactionUuid) + 1,
          message,
        });
  });

  protected readonly balances = computed<BalancePreview[]>(() => {
    const preview = this.preview();
    const candidate = this.candidate();
    if (!preview || !candidate) {
      return [];
    }
    const sides: BalancePreview[] = [];
    const origin = this.origin();
    if (origin && hasBalance(origin.type)) {
      sides.push(
        this.balancePreview(
          origin,
          preview.originBefore,
          preview.result ? preview.result.originBalanceAfter : null,
          !candidate.applied && candidate.type === 'EXPENSE',
        ),
      );
    }
    const destination = candidate.destinationAccountId === null ? null : this.destination();
    if (destination && hasBalance(destination.type)) {
      sides.push(
        this.balancePreview(
          destination,
          preview.destinationBefore,
          preview.result ? preview.result.destinationBalanceAfter : null,
          !candidate.applied && candidate.type !== 'EXPENSE',
        ),
      );
    }
    return sides;
  });

  protected readonly canUseTotal = computed(() => {
    const origin = this.origin();
    return !!origin && hasBalance(origin.type) && origin.type !== 'DEBTOR';
  });

  constructor() {
    // Keep the form consistent with the rules of the chosen type.
    effect(() => {
      const rule = this.rule();
      const value = this.value();
      if (!rule) {
        return;
      }
      untracked(() => {
        const controls = this.form.controls;
        const origin = this.accountOf(value.originAccountId);
        if (origin && !rule.origins.includes(origin.type)) {
          controls.originAccountId.setValue(null);
        }
        const destination = this.accountOf(value.destinationAccountId);
        if (
          value.destinationAccountId !== null &&
          (rule.destinationMode === 'NONE' ||
            (destination && !rule.destinations.includes(destination.type)))
        ) {
          controls.destinationAccountId.setValue(null);
        }
        controls.destinationAccountId.setValidators(
          rule.destinationMode === 'REQUIRED' ? Validators.required : null,
        );
        controls.destinationAccountId.updateValueAndValidity({ emitEvent: false });
        if (!rule.pendingAllowed && value.pending) {
          controls.pending.setValue(false);
        }
      });
    });

    effect(() => {
      const enabled = this.feeEnabled();
      untracked(() => {
        const fee = this.form.controls.fee;
        if (enabled && fee.disabled) {
          fee.enable();
        } else if (!enabled && fee.enabled) {
          fee.setValue(0);
          fee.disable();
        }
      });
    });

    // Generated description "<type> <origin> → <destination>" until the user writes their own.
    effect(() => {
      const value = this.value();
      this.language.locale();
      if (this.descriptionEdited()) {
        return;
      }
      const origin = this.origin()?.name ?? '';
      const destination = this.destination()?.name;
      const typeLabel = this.translate.instant(`enums.transactionType.${value.type}`) as string;
      const generated = [typeLabel, origin, destination ? `→ ${destination}` : '']
        .filter(Boolean)
        .join(' ');
      untracked(() => {
        if (this.form.controls.description.value !== generated) {
          this.form.controls.description.setValue(generated);
        }
      });
    });

    effect(() => {
      this.value();
      untracked(() => this.rejected.set(null));
    });

    effect(() => {
      const editing = this.editing();
      untracked(() => (editing ? this.load(editing) : this.reset()));
    });
  }

  protected useTotal(): void {
    const before = this.preview()?.originBefore ?? toCents(this.origin()?.balance);
    this.form.controls.amount.setValue(fromCents(Math.max(before ?? 0, 0)));
  }

  protected save(): void {
    const candidate = this.candidate();
    if (this.form.invalid || !candidate || candidate.amount <= 0) {
      this.form.markAllAsTouched();
      return;
    }
    const error = this.editing() ? this.store.update(candidate) : this.store.add(candidate);
    if (error) {
      const failed =
        error.transactionUuid === candidate.uuid
          ? candidate
          : this.store.transactions().find((item) => item.uuid === error.transactionUuid);
      const message = this.errors.fromEngine(error, (id) => this.accountOf(id)?.name);
      this.messages.add({
        severity: 'error',
        summary: this.translate.instant('transactions.rejected') as string,
        detail: this.translate.instant('transactions.failedTransaction', {
          description: failed?.description ?? '',
          message,
        }) as string,
        sticky: true,
      });
      this.rejected.set(message);
      return;
    }
    this.messages.clear();
    this.done.emit();
    if (!this.editing()) {
      this.reset();
    }
  }

  /** Prefills the form from an applicable schedule: type and accounts stay fixed, date = now. */
  prefill(schedule: Schedule): void {
    this.load({
      uuid: crypto.randomUUID(),
      type: schedule.type,
      originAccountId: schedule.origin.id,
      destinationAccountId: schedule.destination?.id ?? null,
      amount: toCents(schedule.amount),
      fee: toCents(schedule.fee),
      description: schedule.description,
      descriptionEdited: true,
      applied: true,
      operationDate: toLocalIso(new Date()),
      scheduleId: schedule.id,
    });
  }

  protected cancel(): void {
    if (!this.editing()) {
      this.reset();
    }
    this.done.emit();
  }

  protected cents(value: Cents | null): number | null {
    return value === null ? null : fromCents(value);
  }

  private load(transaction: DraftTransaction): void {
    this.uuid.set(transaction.uuid);
    this.scheduleId.set(transaction.scheduleId);
    this.descriptionEdited.set(transaction.descriptionEdited);
    this.form.setValue({
      type: transaction.type,
      originAccountId: transaction.originAccountId,
      destinationAccountId: transaction.destinationAccountId,
      amount: fromCents(transaction.amount),
      fee: fromCents(transaction.fee),
      operationDate: parseISO(transaction.operationDate),
      pending: !transaction.applied,
      description: transaction.description,
    });
    this.form.markAsPristine();
    this.form.markAsUntouched();
    this.lockScheduled();
  }

  /** A transaction from a schedule keeps its type and accounts (they must match the schedule). */
  private lockScheduled(): void {
    const controls = this.form.controls;
    for (const control of [
      controls.type,
      controls.originAccountId,
      controls.destinationAccountId,
    ]) {
      if (this.scheduled()) {
        control.disable({ emitEvent: false });
      } else {
        control.enable({ emitEvent: false });
      }
    }
  }

  /** Empty form for a new transaction (also after each add). */
  private reset(): void {
    this.uuid.set(crypto.randomUUID());
    this.scheduleId.set(null);
    this.descriptionEdited.set(false);
    this.form.reset({
      type: 'EXPENSE',
      originAccountId: null,
      destinationAccountId: null,
      amount: null,
      fee: 0,
      operationDate: new Date(),
      pending: false,
      description: '',
    });
    this.lockScheduled();
  }

  private accountOf(id: number | null): AccountOption | undefined {
    return id === null ? undefined : this.accounts().find((account) => account.id === id);
  }

  /** Usable accounts of the allowed types, without the one chosen on the other side. */
  private optionsFor(
    types: string[],
    otherId: number | null,
    selectedId: number | null,
  ): AccountOption[] {
    return this.accounts().filter(
      (account) =>
        types.includes(account.type) &&
        account.id !== otherId &&
        (account.status === 'ACTIVE' || account.id === selectedId),
    );
  }

  private balancePreview(
    account: AccountOption,
    before: Cents | null,
    after: Cents | null,
    pending: boolean,
  ): BalancePreview {
    const limit = account.credit ? toCents(account.credit.creditLimit) : null;
    return {
      account,
      before,
      after,
      availableCredit: limit !== null && after !== null ? Math.max(limit - after, 0) : null,
      pending,
    };
  }
}
