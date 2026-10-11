import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { SelectButtonModule } from 'primeng/selectbutton';
import { Observable } from 'rxjs';
import { ErrorNotifier } from '../../../core/http/error-notifier.service';
import { CURRENCY_STATUSES, CurrencyStatus } from '../../../shared/enums/currency-status.enum';
import { FieldErrorComponent } from '../../../shared/forms/field-error.component';
import { applyServerErrors } from '../../../shared/forms/server-errors';
import { toApiProblem } from '../../../shared/models/api-problem.model';
import { Currency } from '../../../shared/models/currency.model';
import { CurrencyApiService } from './currency-api.service';

@Component({
  selector: 'app-currency-form-dialog',
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    ButtonModule,
    DialogModule,
    InputTextModule,
    MessageModule,
    SelectButtonModule,
    FieldErrorComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      [header]="(isNew() ? 'admin.currencies.new' : 'admin.currencies.edit') | translate"
      [visible]="currency() !== null"
      (visibleChange)="!$event && closed.emit()"
      [modal]="true"
      [style]="{ width: '28rem' }"
      [breakpoints]="{ '640px': '95vw' }"
    >
      <form class="flex flex-col gap-4" [formGroup]="form" (ngSubmit)="save()">
        @if (error(); as message) {
          <p-message severity="error" [text]="message" />
        }
        <div class="flex flex-col gap-2">
          <label for="currency-name">{{ 'common.name' | translate }}</label>
          <input pInputText id="currency-name" formControlName="name" />
          <app-field-error [control]="form.controls.name" />
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div class="flex flex-col gap-2">
            <label for="currency-iso">{{ 'admin.currencies.iso' | translate }}</label>
            <input
              pInputText
              id="currency-iso"
              formControlName="iso"
              maxlength="3"
              class="font-mono uppercase"
            />
            <app-field-error [control]="form.controls.iso" />
          </div>
          <div class="flex flex-col gap-2">
            <label for="currency-symbol">{{ 'admin.currencies.symbol' | translate }}</label>
            <input pInputText id="currency-symbol" formControlName="symbol" maxlength="5" />
            <app-field-error [control]="form.controls.symbol" />
          </div>
        </div>
        <div class="flex flex-col gap-2">
          <span>{{ 'common.status' | translate }}</span>
          <p-selectbutton
            [options]="statusOptions"
            formControlName="status"
            [allowEmpty]="false"
            [ariaLabel]="'common.status' | translate"
          >
            <ng-template #item let-option>{{
              'enums.currencyStatus.' + option | translate
            }}</ng-template>
          </p-selectbutton>
        </div>
        <div class="flex justify-end gap-2">
          <p-button
            [label]="'common.cancel' | translate"
            severity="secondary"
            [text]="true"
            (onClick)="closed.emit()"
          />
          <p-button type="submit" [label]="'common.save' | translate" [loading]="saving()" />
        </div>
      </form>
    </p-dialog>
  `,
})
export class CurrencyFormDialogComponent {
  private readonly api = inject(CurrencyApiService);
  private readonly notifier = inject(ErrorNotifier);

  /** `'new'` to create, a currency to edit, null when closed. */
  readonly currency = input<Currency | 'new' | null>(null);
  readonly closed = output<void>();
  readonly saved = output<Currency>();

  protected readonly isNew = computed(() => this.currency() === 'new');
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly statusOptions = [...CURRENCY_STATUSES];

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(50)]],
    iso: ['', [Validators.required, Validators.pattern(/^[A-Za-z]{3}$/)]],
    symbol: ['', [Validators.required, Validators.maxLength(5)]],
    status: ['ACTIVE' as CurrencyStatus, Validators.required],
  });

  constructor() {
    effect(() => {
      const currency = this.currency();
      this.error.set(null);
      if (currency === 'new') {
        this.form.reset({ name: '', iso: '', symbol: '', status: 'ACTIVE' });
      } else if (currency) {
        this.form.reset({
          name: currency.name,
          iso: currency.iso,
          symbol: currency.symbol,
          status: currency.status,
        });
      }
    });
  }

  protected save(): void {
    const currency = this.currency();
    if (currency === null || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const request = { ...value, iso: value.iso.toUpperCase() };
    const call: Observable<Currency> =
      currency === 'new' ? this.api.create(request) : this.api.update(currency.id, request);

    this.saving.set(true);
    this.error.set(null);
    call.subscribe({
      next: (saved) => {
        this.saving.set(false);
        this.notifier.success('admin.currencies.saved');
        this.saved.emit(saved);
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
}
