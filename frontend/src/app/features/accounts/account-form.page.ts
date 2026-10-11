import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  numberAttribute,
  signal,
} from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { FormGroup, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ColorPickerModule } from 'primeng/colorpicker';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { SelectButtonModule } from 'primeng/selectbutton';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { Observable, concatMap, of } from 'rxjs';
import { ErrorNotifier } from '../../core/http/error-notifier.service';
import { LanguageService } from '../../core/i18n/language.service';
import { AccountAvatarComponent } from '../../shared/components/account-avatar.component';
import { IconPickerComponent } from '../../shared/components/icon-picker.component';
import { CronFieldComponent } from '../../shared/cron/cron-field.component';
import { AccountStatus, EDITABLE_ACCOUNT_STATUSES } from '../../shared/enums/account-status.enum';
import {
  ACCOUNT_TYPES,
  ALLOWED_CHILDREN,
  AccountType,
  canBeTemporary,
  freeTypeChanges,
  hasBalance,
} from '../../shared/enums/account-type.enum';
import { FieldErrorComponent } from '../../shared/forms/field-error.component';
import { applyServerErrors } from '../../shared/forms/server-errors';
import { AccountDetail, AccountRequest } from '../../shared/models/account.model';
import { ApiProblem, toApiProblem } from '../../shared/models/api-problem.model';
import { CurrencyApiService } from '../admin/currencies/currency-api.service';
import { AccountApiService } from './account-api.service';

const DEFAULT_CRON = '0 0 0 15 * *';
const DEFAULT_PAYMENT_CRON = '0 0 0 5 * *';

@Component({
  selector: 'app-account-form-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    TranslatePipe,
    ButtonModule,
    CardModule,
    ColorPickerModule,
    InputNumberModule,
    InputTextModule,
    MessageModule,
    SelectModule,
    SelectButtonModule,
    ToggleSwitchModule,
    AccountAvatarComponent,
    CronFieldComponent,
    FieldErrorComponent,
    IconPickerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="mb-4 text-2xl font-semibold">
      {{ (isEdit() ? 'accounts.edit' : 'accounts.new') | translate }}
    </h1>

    <form class="flex max-w-3xl flex-col gap-4" [formGroup]="form" (ngSubmit)="save()">
      @if (error(); as message) {
        <p-message severity="error" [text]="message" />
      }

      <p-card>
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div class="flex flex-col gap-2 md:col-span-2">
            <label for="name">{{ 'common.name' | translate }}</label>
            <div class="flex items-center gap-3">
              <app-account-avatar
                [icon]="form.controls.icon.value"
                [color]="colorHex()"
                [type]="type()"
              />
              <input pInputText id="name" formControlName="name" class="flex-1" />
            </div>
            <app-field-error [control]="form.controls.name" />
          </div>

          <div class="flex flex-col gap-2">
            <label for="type">{{ 'accounts.type' | translate }}</label>
            <p-select
              inputId="type"
              formControlName="type"
              [options]="typeOptions()"
              styleClass="w-full"
            >
              <ng-template #selectedItem let-type>{{
                'enums.accountType.' + type | translate
              }}</ng-template>
              <ng-template #item let-type>
                <div class="flex flex-col">
                  <span>{{ 'enums.accountType.' + type | translate }}</span>
                  <small class="text-muted-color">{{
                    'accounts.typeHelp.' + type | translate
                  }}</small>
                </div>
              </ng-template>
            </p-select>
            @if (typeLocked()) {
              <small class="text-muted-color">{{ 'accounts.typeLocked' | translate }}</small>
            }
            <app-field-error [control]="form.controls.type" />
          </div>

          <div class="flex flex-col gap-2">
            <label for="parent">{{ 'accounts.parent' | translate }}</label>
            <p-select
              inputId="parent"
              formControlName="parentId"
              [options]="parents.value() ?? []"
              optionLabel="name"
              optionValue="id"
              [showClear]="true"
              [filter]="true"
              [loading]="parents.isLoading()"
              [placeholder]="'accounts.noParent' | translate"
              styleClass="w-full"
            />
            <app-field-error [control]="form.controls.parentId" />
          </div>

          <div class="flex flex-col gap-2">
            <label for="currency">{{ 'accounts.currency' | translate }}</label>
            <p-select
              inputId="currency"
              formControlName="currencyId"
              [options]="currencies.value() ?? []"
              optionValue="id"
              styleClass="w-full"
            >
              <ng-template #selectedItem let-currency>
                {{ currency.iso }} · {{ currency.name }}
              </ng-template>
              <ng-template #item let-currency>{{ currency.iso }} · {{ currency.name }}</ng-template>
            </p-select>
            <small class="text-muted-color">{{
              'admin.currencies.illustrative' | translate
            }}</small>
            <app-field-error [control]="form.controls.currencyId" />
          </div>

          @if (isEdit()) {
            <div class="flex flex-col gap-2">
              <span>{{ 'common.status' | translate }}</span>
              <p-selectbutton
                formControlName="status"
                [options]="statusOptions"
                [allowEmpty]="false"
                [ariaLabel]="'common.status' | translate"
              >
                <ng-template #item let-status>{{
                  'enums.accountStatus.' + status | translate
                }}</ng-template>
              </p-selectbutton>
              <app-field-error [control]="form.controls.status" />
            </div>
          }

          @if (showBalance()) {
            <div class="flex flex-col gap-2">
              <label for="balance">{{ 'accounts.balance' | translate }}</label>
              <p-inputnumber
                inputId="balance"
                formControlName="balance"
                mode="decimal"
                [minFractionDigits]="2"
                [maxFractionDigits]="2"
                [min]="0"
                [locale]="language.locale()"
                styleClass="w-full"
              />
              @if (isEdit() && account.value()?.hasTransactions) {
                <small class="text-orange-500">{{
                  'accounts.balanceOverwriteWarning' | translate
                }}</small>
              }
              <app-field-error [control]="form.controls.balance" />
            </div>
          }

          @if (type() === 'DEBTOR') {
            <div class="flex flex-col gap-2">
              <label for="pendingExpense">{{ 'accounts.pendingExpense' | translate }}</label>
              <p-inputnumber
                inputId="pendingExpense"
                formControlName="pendingExpense"
                mode="decimal"
                [minFractionDigits]="2"
                [maxFractionDigits]="2"
                [min]="0"
                [locale]="language.locale()"
                styleClass="w-full"
              />
              <small class="text-muted-color">{{
                'accounts.pendingExpenseHelp' | translate
              }}</small>
              <app-field-error [control]="form.controls.pendingExpense" />
            </div>
          }

          <div class="flex flex-col gap-2">
            <label for="icon">{{ 'accounts.icon' | translate }}</label>
            <app-icon-picker
              inputId="icon"
              formControlName="icon"
              [placeholder]="'accounts.iconPlaceholder' | translate"
            />
          </div>

          <div class="flex flex-col gap-2">
            <label for="color">{{ 'accounts.color' | translate }}</label>
            <div class="flex items-center gap-3">
              <p-colorpicker inputId="color" formControlName="color" />
              <span class="font-mono text-sm">{{ colorHex() ?? '—' }}</span>
            </div>
          </div>

          <div class="flex items-center gap-3">
            <p-toggleswitch inputId="includeInBalance" formControlName="includeInBalance" />
            <label for="includeInBalance">{{ 'accounts.includeInBalance' | translate }}</label>
          </div>

          @if (showTemporary()) {
            <div class="flex flex-col gap-1">
              <div class="flex items-center gap-3">
                <p-toggleswitch inputId="temporary" formControlName="temporary" />
                <label for="temporary">{{ 'accounts.temporary' | translate }}</label>
              </div>
              <small class="text-muted-color">{{ 'accounts.temporaryHelp' | translate }}</small>
            </div>
          }
        </div>
      </p-card>

      @if (type() === 'DEBTOR') {
        <p-card [header]="'accounts.credit.title' | translate">
          <div class="flex flex-col gap-4" [formGroup]="creditForm">
            <div class="flex items-center gap-3">
              <p-toggleswitch inputId="hasCredit" formControlName="enabled" />
              <label for="hasCredit">{{ 'accounts.credit.enabled' | translate }}</label>
            </div>
            @if (creditForm.controls.enabled.value) {
              <div class="flex flex-col gap-2">
                <label for="creditLimit">{{ 'accounts.credit.limit' | translate }}</label>
                <p-inputnumber
                  inputId="creditLimit"
                  formControlName="creditLimit"
                  mode="decimal"
                  [minFractionDigits]="2"
                  [maxFractionDigits]="2"
                  [min]="0"
                  [locale]="language.locale()"
                  styleClass="w-full"
                />
                <app-field-error [control]="creditForm.controls.creditLimit" />
              </div>
              <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div class="flex flex-col gap-2">
                  <label for="cutOffCron">{{ 'accounts.credit.cutOff' | translate }}</label>
                  <app-cron-field
                    inputId="cutOffCron"
                    formControlName="cutOffCron"
                    [label]="'accounts.credit.cutOff' | translate"
                  />
                  <app-field-error [control]="creditForm.controls.cutOffCron" />
                </div>
                <div class="flex flex-col gap-2">
                  <label for="paymentDueCron">{{ 'accounts.credit.paymentDue' | translate }}</label>
                  <app-cron-field
                    inputId="paymentDueCron"
                    formControlName="paymentDueCron"
                    [label]="'accounts.credit.paymentDue' | translate"
                  />
                  <app-field-error [control]="creditForm.controls.paymentDueCron" />
                </div>
              </div>
            }
          </div>
        </p-card>
      }

      <div class="flex justify-end gap-2">
        <p-button
          [label]="'common.cancel' | translate"
          severity="secondary"
          [text]="true"
          [routerLink]="isEdit() ? ['/accounts', id()] : ['/accounts']"
        />
        <p-button
          type="submit"
          icon="pi pi-check"
          [label]="'common.save' | translate"
          [loading]="saving()"
        />
      </div>
    </form>
  `,
})
export class AccountFormPage {
  private readonly api = inject(AccountApiService);
  private readonly currencyApi = inject(CurrencyApiService);
  private readonly router = inject(Router);
  private readonly notifier = inject(ErrorNotifier);
  protected readonly language = inject(LanguageService);
  private readonly fb = inject(NonNullableFormBuilder);

  /** Route param `:id` (absent when creating). */
  readonly id = input(undefined, { transform: numberAttribute });

  protected readonly isEdit = computed(() => !!this.id() && !Number.isNaN(this.id()));
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly statusOptions = [...EDITABLE_ACCOUNT_STATUSES];

  protected readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    type: ['STORAGE' as AccountType, Validators.required],
    parentId: this.fb.control<number | null>(null),
    currencyId: this.fb.control<number | null>(null, Validators.required),
    balance: this.fb.control<number | null>(0, Validators.min(0)),
    pendingExpense: this.fb.control<number | null>(null, Validators.min(0)),
    icon: this.fb.control<string | null>(null),
    color: this.fb.control<string | null>(null),
    includeInBalance: [true],
    temporary: [false],
    status: ['ACTIVE' as AccountStatus],
  });

  protected readonly creditForm = this.fb.group({
    enabled: [false],
    creditLimit: this.fb.control<number | null>(null, [Validators.required, Validators.min(0.01)]),
    cutOffCron: [DEFAULT_CRON, Validators.required],
    paymentDueCron: [DEFAULT_PAYMENT_CRON, Validators.required],
  });

  protected readonly type = toSignal(this.form.controls.type.valueChanges, {
    initialValue: this.form.controls.type.value,
  });
  private readonly colorValue = toSignal(this.form.controls.color.valueChanges, {
    initialValue: null,
  });

  protected readonly account = rxResource({
    params: () => (this.isEdit() ? this.id() : undefined),
    stream: ({ params: id }) => this.api.findById(id),
  });

  protected readonly currencies = rxResource({ stream: () => this.currencyApi.options() });

  protected readonly parents = rxResource({
    params: () => ({ type: this.type(), accountId: this.isEdit() ? this.id() : null }),
    stream: ({ params }) => this.api.parentOptions(params.type, params.accountId),
  });

  private readonly parentId = toSignal(this.form.controls.parentId.valueChanges, {
    initialValue: this.form.controls.parentId.value,
  });

  protected readonly typeLocked = computed(() => {
    const account = this.account.value();
    return !!account && (account.hasChildren || account.hasTransactions || !!account.credit);
  });

  /**
   * Mirrors the backend rules: a credit line pins DEBTOR; the type must keep accepting its sub-accounts;
   * with transactions only the types allowed by the parent group (never GROUP) — a root account can
   * only switch STORAGE ↔ INVESTMENT.
   */
  protected readonly typeOptions = computed<AccountType[]>(() => {
    const account = this.account.value();
    if (!account) {
      return [...ACCOUNT_TYPES];
    }
    if (account.credit) {
      return ['DEBTOR'];
    }
    let options = ACCOUNT_TYPES.filter((type) =>
      account.childTypes.every((child) => ALLOWED_CHILDREN[type].includes(child)),
    );
    if (account.hasTransactions) {
      const parentId = this.parentId();
      const parentType =
        parentId === account.parent?.id
          ? account.parent.type
          : this.parents.value()?.find((parent) => parent.id === parentId)?.type;
      const allowed = parentType ? ALLOWED_CHILDREN[parentType] : freeTypeChanges(account.type);
      options = options.filter((type) => type !== 'GROUP' && allowed.includes(type));
    }
    return options.includes(account.type) ? options : [account.type, ...options];
  });

  protected readonly showBalance = computed(() => hasBalance(this.type()));
  protected readonly showTemporary = computed(() => canBeTemporary(this.type()));
  protected readonly colorHex = computed(() => normalizeColor(this.colorValue()));

  constructor() {
    // Fill the form once the account (edit) or the currencies (create) are loaded.
    effect(() => {
      const account = this.account.value();
      if (account) {
        this.fill(account);
      }
    });
    effect(() => {
      const currencies = this.currencies.value();
      if (!this.isEdit() && currencies?.length && this.form.controls.currencyId.value === null) {
        this.form.controls.currencyId.setValue(
          currencies.find((currency) => currency.iso === 'MXN')?.id ?? currencies[0].id,
        );
      }
    });
    // Drop a parent that no longer accepts the selected type.
    effect(() => {
      const parents = this.parents.value();
      const parentId = this.form.controls.parentId.value;
      if (parents && parentId !== null && !parents.some((parent) => parent.id === parentId)) {
        this.form.controls.parentId.setValue(null);
      }
    });
  }

  protected save(): void {
    const creditEnabled = this.type() === 'DEBTOR' && this.creditForm.controls.enabled.value;
    if (this.form.invalid || (creditEnabled && this.creditForm.invalid)) {
      this.form.markAllAsTouched();
      this.creditForm.markAllAsTouched();
      return;
    }
    const request = this.request();
    const account = this.account.value();
    const save$: Observable<AccountDetail> = account
      ? this.api.update(account.id, request)
      : this.api.create(request);

    this.saving.set(true);
    this.error.set(null);
    save$.pipe(concatMap((saved) => this.saveCredit(saved, creditEnabled, account))).subscribe({
      next: (saved) => {
        this.notifier.success('accounts.saved');
        void this.router.navigate(['/accounts', saved.id]);
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.showError(toApiProblem(err));
      },
    });
  }

  /** Creates/updates or removes the credit line after the account itself is saved. */
  private saveCredit(
    saved: AccountDetail,
    enabled: boolean,
    previous: AccountDetail | undefined,
  ): Observable<AccountDetail> {
    if (enabled) {
      const { creditLimit, cutOffCron, paymentDueCron } = this.creditForm.getRawValue();
      return this.api
        .saveCredit(saved.id, { creditLimit: creditLimit ?? 0, cutOffCron, paymentDueCron })
        .pipe(concatMap(() => of(saved)));
    }
    if (previous?.credit && saved.type === 'DEBTOR') {
      return this.api.deleteCredit(saved.id).pipe(concatMap(() => of(saved)));
    }
    return of(saved);
  }

  private request(): AccountRequest {
    const value = this.form.getRawValue();
    const type = value.type;
    return {
      name: value.name.trim(),
      type,
      parentId: value.parentId,
      currencyId: value.currencyId ?? 0,
      balance: hasBalance(type) ? (value.balance ?? 0) : null,
      pendingExpense: type === 'DEBTOR' ? value.pendingExpense : null,
      icon: value.icon,
      color: normalizeColor(value.color),
      includeInBalance: value.includeInBalance,
      temporary: canBeTemporary(type) && value.temporary,
      status: value.status,
      version: this.account.value()?.version ?? null,
    };
  }

  private fill(account: AccountDetail): void {
    this.form.reset({
      name: account.name,
      type: account.type,
      parentId: account.parent?.id ?? null,
      currencyId: account.currency.id,
      balance: account.balance,
      pendingExpense: account.pendingExpense,
      icon: account.icon,
      color: account.color,
      includeInBalance: account.includeInBalance,
      temporary: account.temporary,
      status: account.status === 'DELETED' ? 'ACTIVE' : account.status,
    });
    this.creditForm.reset({
      enabled: !!account.credit,
      creditLimit: account.credit?.creditLimit ?? null,
      cutOffCron: account.credit?.cutOffCron ?? DEFAULT_CRON,
      paymentDueCron: account.credit?.paymentDueCron ?? DEFAULT_PAYMENT_CRON,
    });
  }

  private showError(problem: ApiProblem): void {
    const forms: FormGroup[] = [this.form, this.creditForm];
    const applied = forms.map((form) => applyServerErrors(form, problem)).some(Boolean);
    if (!applied) {
      this.error.set(this.notifier.message(problem));
    }
  }
}

/** p-colorpicker returns `abc123`; the API stores `#ABC123`. */
function normalizeColor(color: string | null | undefined): string | null {
  if (!color) {
    return null;
  }
  const hex = color.startsWith('#') ? color.slice(1) : color;
  return /^[0-9a-fA-F]{6}$/.test(hex) ? `#${hex.toUpperCase()}` : null;
}
