import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectButtonModule } from 'primeng/selectbutton';
import { catchError, of, switchMap, timer } from 'rxjs';
import { LanguageService } from '../../core/i18n/language.service';
import { CronApiService } from './cron-api.service';
import { MonthlyDay, monthlyCron, parseMonthlyCron } from './monthly-cron';

type Mode = 'day' | 'last' | 'advanced';

/**
 * Cron expression input. Simple modes generate "day N of every month" / "last day of the month";
 * the advanced mode accepts any Spring (6 field) expression. Shows the next 3 dates from the API.
 */
@Component({
  selector: 'app-cron-field',
  imports: [
    DatePipe,
    FormsModule,
    TranslatePipe,
    InputNumberModule,
    InputTextModule,
    SelectButtonModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => CronFieldComponent), multi: true },
  ],
  template: `
    <div class="flex flex-col gap-2">
      <p-selectbutton
        [options]="modes"
        [ngModel]="mode()"
        (ngModelChange)="changeMode($event)"
        [allowEmpty]="false"
        [disabled]="disabled()"
        size="small"
        [ariaLabel]="label()"
      >
        <ng-template #item let-option>{{ 'cron.mode.' + option | translate }}</ng-template>
      </p-selectbutton>

      @switch (mode()) {
        @case ('day') {
          <div class="flex items-center gap-2">
            <span>{{ 'cron.dayOfMonth' | translate }}</span>
            <p-inputnumber
              [ngModel]="day()"
              (ngModelChange)="changeDay($event)"
              [min]="1"
              [max]="31"
              [showButtons]="true"
              [disabled]="disabled()"
              [inputId]="inputId()"
              inputStyleClass="w-20"
            />
          </div>
        }
        @case ('advanced') {
          <input
            pInputText
            class="font-mono"
            [id]="inputId()"
            [ngModel]="expression()"
            (ngModelChange)="changeExpression($event)"
            [disabled]="disabled()"
            placeholder="0 0 0 15 * *"
          />
          <small class="text-muted-color">{{ 'cron.advancedHint' | translate }}</small>
        }
      }

      <small class="text-muted-color" aria-live="polite">
        @if (preview.isLoading()) {
          {{ 'common.loading' | translate }}
        } @else if (preview.value(); as check) {
          @if (check.valid) {
            {{ 'cron.next' | translate }}:
            @for (date of check.nextExecutions; track date; let last = $last) {
              {{ date | date: 'mediumDate' : undefined : language.locale() }}{{ last ? '' : ' · ' }}
            }
          } @else {
            <span class="text-red-500">{{ 'validation.server.INVALID_CRON' | translate }}</span>
          }
        }
      </small>
    </div>
  `,
})
export class CronFieldComponent implements ControlValueAccessor {
  private readonly cronApi = inject(CronApiService);
  protected readonly language = inject(LanguageService);

  readonly inputId = input<string>();
  readonly label = input<string>('');

  protected readonly modes: Mode[] = ['day', 'last', 'advanced'];
  protected readonly mode = signal<Mode>('day');
  protected readonly day = signal<number>(1);
  protected readonly expression = signal<string>('');
  protected readonly disabled = signal(false);

  private readonly value = computed(() => {
    switch (this.mode()) {
      case 'day':
        return monthlyCron(this.day());
      case 'last':
        return monthlyCron('L');
      default:
        return this.expression().trim();
    }
  });

  /** Debounced preview of the next executions. */
  protected readonly preview = rxResource({
    params: () => this.value(),
    stream: ({ params: expression }) =>
      expression
        ? timer(300).pipe(
            switchMap(() => this.cronApi.check(expression)),
            catchError(() => of({ valid: false, nextExecutions: [] })),
          )
        : of(null),
  });

  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  writeValue(value: string | null): void {
    const day: MonthlyDay | null = parseMonthlyCron(value);
    if (day === 'L') {
      this.mode.set('last');
    } else if (day !== null) {
      this.mode.set('day');
      this.day.set(day);
    } else if (value) {
      this.mode.set('advanced');
    }
    this.expression.set(value ?? '');
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.disabled.set(disabled);
  }

  protected changeMode(mode: Mode): void {
    if (mode === 'advanced' && !this.expression()) {
      this.expression.set(this.value());
    }
    this.mode.set(mode);
    this.emit();
  }

  protected changeDay(day: number | null): void {
    this.day.set(day ?? 1);
    this.emit();
  }

  protected changeExpression(expression: string): void {
    this.expression.set(expression);
    this.emit();
  }

  private emit(): void {
    this.onChange(this.value());
    this.onTouched();
  }
}
