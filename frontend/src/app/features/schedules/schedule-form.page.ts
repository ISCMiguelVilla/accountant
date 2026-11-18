import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  numberAttribute,
  signal,
  untracked,
} from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { parseISO } from 'date-fns';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DatePickerModule } from 'primeng/datepicker';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { forkJoin, map, of } from 'rxjs';
import { ErrorNotifier } from '../../core/http/error-notifier.service';
import { LanguageService } from '../../core/i18n/language.service';
import { AccountAvatarComponent } from '../../shared/components/account-avatar.component';
import { CronFieldComponent } from '../../shared/cron/cron-field.component';
import { TRANSACTION_TYPES, TransactionType } from '../../shared/enums/transaction-type.enum';
import { FieldErrorComponent } from '../../shared/forms/field-error.component';
import { applyServerErrors } from '../../shared/forms/server-errors';
import { toApiProblem } from '../../shared/models/api-problem.model';
import { ScheduleRequest } from '../../shared/models/schedule.model';
import { AccountOption } from '../../shared/models/transaction.model';
import { TransactionTypeIconPipe } from '../../shared/pipes/transaction-type.pipes';
import { toLocalIso } from '../transactions/editor/transaction-form.component';
import { TransactionEngine } from '../transactions/engine/transaction-engine';
import { TransactionApiService } from '../transactions/transaction-api.service';
import { ScheduleApiService } from './schedule-api.service';

const DEFAULT_CRON = '0 0 0 1 * *';

/** Scheduled transaction form: same matrix and enabled fields as a normal transaction (docs/documentacion-tecnica.md §8.6). */
@Component({
  selector: 'app-schedule-form-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    TranslatePipe,
    ButtonModule,
    CardModule,
    DatePickerModule,
    InputNumberModule,
    InputTextModule,
    MessageModule,
    SelectModule,
    AccountAvatarComponent,
    CronFieldComponent,
    FieldErrorComponent,
    TransactionTypeIconPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="mb-4 text-2xl font-semibold">
      {{ (id() ? 'schedules.edit' : 'schedules.new') | translate }}
    </h1>

    <form class="flex max-w-3xl flex-col gap-4" [formGroup]="form" (ngSubmit)="save()">
      @if (error(); as message) {
        <p-message severity="error" [text]="message" />
      }

      <p-card>
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
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
                <i [class]="type | transactionTypeIcon" class="mr-2"></i
                >{{ 'enums.transactionType.' + type | translate }}
              </ng-template>
            </p-select>
          </div>

          <div class="flex flex-col gap-2">
            <label for="description">{{ 'transactions.description' | translate }}</label>
            <input pInputText pSize="small" id="description" formControlName="description" />
            <app-field-error [control]="form.controls.description" />
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
              <ng-template #item let-account>
                <div class="flex items-center gap-2">
                  <app-account-avatar
                    [icon]="account.icon"
                    [color]="account.color"
                    [type]="account.type"
                  />
                  {{ account.name }}
                </div>
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
                <ng-template #item let-account>
                  <div class="flex items-center gap-2">
                    <app-account-avatar
                      [icon]="account.icon"
                      [color]="account.color"
                      [type]="account.type"
                    />
                    {{ account.name }}
                  </div>
                </ng-template>
              </p-select>
              <app-field-error [control]="form.controls.destinationAccountId" />
            </div>
          }

          <div class="flex flex-col gap-2">
            <label for="amount">{{ 'transactions.amount' | translate }}</label>
            <p-inputnumber
              size="small"
              inputId="amount"
              formControlName="amount"
              mode="decimal"
              [minFractionDigits]="2"
              [maxFractionDigits]="2"
              [min]="0"
              [locale]="language.locale()"
              styleClass="w-full"
            />
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
            <app-field-error [control]="form.controls.fee" />
          </div>

          <div class="flex flex-col gap-2 md:col-span-2">
            <label for="cron">{{ 'schedules.cron' | translate }}</label>
            <app-cron-field
              inputId="cron"
              formControlName="cronExpression"
              [label]="'schedules.cron' | translate"
            />
            <app-field-error [control]="form.controls.cronExpression" />
          </div>

          <div class="flex flex-col gap-2">
            <label for="next">{{ 'schedules.nextExecution' | translate }}</label>
            <p-datepicker
              size="small"
              inputId="next"
              formControlName="nextExecution"
              [showClear]="true"
              [showIcon]="true"
              appendTo="body"
              styleClass="w-full"
            />
            <small class="text-muted-color">{{ 'schedules.nextExecutionHelp' | translate }}</small>
          </div>
        </div>
      </p-card>

      <div class="flex justify-end gap-2">
        <p-button
          size="small"
          [label]="'common.cancel' | translate"
          severity="secondary"
          [text]="true"
          routerLink="/schedules"
        />
        <p-button
          size="small"
          type="submit"
          icon="pi pi-save"
          [label]="'common.save' | translate"
          [loading]="saving()"
        />
      </div>
    </form>
  `,
})
export class ScheduleFormPage {
  private readonly api = inject(ScheduleApiService);
  private readonly transactions = inject(TransactionApiService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly router = inject(Router);
  private readonly notifier = inject(ErrorNotifier);
  protected readonly language = inject(LanguageService);

  /** Route param; absent when creating. */
  readonly id = input(undefined, {
    transform: (value: unknown) => numberAttribute(value, 0) || null,
  });

  protected readonly types = [...TRANSACTION_TYPES];
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = this.fb.group({
    type: this.fb.control<TransactionType>('EXPENSE'),
    originAccountId: this.fb.control<number | null>(null, Validators.required),
    destinationAccountId: this.fb.control<number | null>(null),
    amount: this.fb.control<number | null>(null, [Validators.required, Validators.min(0.01)]),
    fee: this.fb.control<number | null>(0),
    description: this.fb.control('', [
      Validators.required,
      Validators.minLength(3),
      Validators.maxLength(255),
    ]),
    cronExpression: this.fb.control(DEFAULT_CRON, Validators.required),
    nextExecution: this.fb.control<Date | null>(null),
  });

  private readonly value = toSignal(
    this.form.valueChanges.pipe(map(() => this.form.getRawValue())),
    { initialValue: this.form.getRawValue() },
  );

  private readonly data = rxResource({
    stream: () =>
      forkJoin({
        rules: this.transactions.rules(),
        accounts: this.transactions.accountOptions(),
      }).pipe(map(({ rules, accounts }) => ({ engine: new TransactionEngine(rules), accounts }))),
  });

  private readonly schedule = rxResource({
    params: () => this.id(),
    stream: ({ params: id }) => (id ? this.api.findById(id) : of(null)),
  });

  protected readonly rule = computed(
    () => this.data.value()?.engine.rule(this.value().type) ?? null,
  );

  private readonly accounts = computed<AccountOption[]>(() => this.data.value()?.accounts ?? []);

  protected readonly originOptions = computed(() =>
    this.optionsFor(this.rule()?.origins ?? [], this.value().destinationAccountId),
  );
  protected readonly destinationOptions = computed(() =>
    this.optionsFor(this.rule()?.destinations ?? [], this.value().originAccountId),
  );

  protected readonly feeEnabled = computed(() => {
    const rule = this.rule();
    const engine = this.data.value()?.engine;
    const origin = this.accountOf(this.value().originAccountId);
    const destination = this.accountOf(this.value().destinationAccountId);
    if (!rule || !engine) {
      return true;
    }
    if (origin && (destination || rule.destinationMode !== 'REQUIRED')) {
      return engine.variant(rule.type, origin.type, destination?.type ?? null)?.feeEnabled ?? true;
    }
    return rule.variants.some((variant) => variant.feeEnabled);
  });

  constructor() {
    effect(() => {
      const schedule = this.schedule.value();
      if (!schedule) {
        return;
      }
      untracked(() =>
        this.form.reset({
          type: schedule.type,
          originAccountId: schedule.origin.id,
          destinationAccountId: schedule.destination?.id ?? null,
          amount: schedule.amount,
          fee: schedule.fee,
          description: schedule.description,
          cronExpression: schedule.cronExpression,
          nextExecution: parseISO(schedule.nextExecution),
        }),
      );
    });

    // Keep accounts and fields consistent with the rules of the type.
    effect(() => {
      const rule = this.rule();
      const value = this.value();
      if (!rule || !this.accounts().length) {
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
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const request: ScheduleRequest = {
      type: value.type,
      originAccountId: value.originAccountId!,
      destinationAccountId:
        this.rule()?.destinationMode === 'NONE' ? null : value.destinationAccountId,
      amount: value.amount ?? 0,
      fee: this.feeEnabled() ? (value.fee ?? 0) : 0,
      description: value.description.trim(),
      cronExpression: value.cronExpression,
      nextExecution: value.nextExecution ? toLocalIso(value.nextExecution) : null,
    };
    const id = this.id();
    this.saving.set(true);
    this.error.set(null);
    (id ? this.api.update(id, request) : this.api.create(request)).subscribe({
      next: () => {
        this.notifier.success('schedules.saved');
        void this.router.navigate(['/schedules']);
      },
      error: (err: unknown) => {
        this.saving.set(false);
        const problem = toApiProblem(err);
        if (!applyServerErrors(this.form, problem)) {
          this.error.set(this.notifier.message(problem));
        }
      },
    });
  }

  private accountOf(id: number | null): AccountOption | undefined {
    return id === null ? undefined : this.accounts().find((account) => account.id === id);
  }

  private optionsFor(types: string[], otherId: number | null): AccountOption[] {
    return this.accounts().filter(
      (account) => types.includes(account.type) && account.id !== otherId,
    );
  }
}
