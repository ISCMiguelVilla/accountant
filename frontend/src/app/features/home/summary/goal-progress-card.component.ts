import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { format } from 'date-fns';
import { ConfirmationService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { ErrorNotifier } from '../../../core/http/error-notifier.service';
import { LanguageService } from '../../../core/i18n/language.service';
import { formatAmount } from '../../../shared/money/money';
import { MoneyPipe } from '../../../shared/money/money.pipe';
import { TagSeverity } from '../../../shared/pipes/status-severity.pipe';
import { DashboardApiService } from '../dashboard-api.service';
import { MonthProgress, ProgressStatus, YearProgress } from '../dashboard.model';

const SEVERITIES: Record<ProgressStatus, TagSeverity> = {
  SUCCESS: 'success',
  WARNING: 'warn',
  DANGER: 'danger',
};

const ICONS: Record<ProgressStatus, string> = {
  SUCCESS: 'pi pi-check',
  WARNING: 'pi pi-exclamation-triangle',
  DANGER: 'pi pi-times',
};

/** Yearly savings progress against the goal (docs/documentacion-tecnica.md §10), with the goal dialog. */
@Component({
  selector: 'app-goal-progress-card',
  imports: [
    DecimalPipe,
    FormsModule,
    TranslatePipe,
    ButtonModule,
    CardModule,
    DialogModule,
    InputNumberModule,
    TagModule,
    TooltipModule,
    MoneyPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card>
      <div class="mb-4 flex items-center justify-between gap-2">
        <h2 class="m-0 text-lg font-semibold">{{ 'home.goals.title' | translate }}</h2>
        <p-button
          icon="pi pi-flag"
          size="small"
          [outlined]="true"
          [label]="'home.goals.set' | translate"
          (onClick)="openDialog(currentYear)"
        />
      </div>

      <div class="flex flex-col gap-6">
        @for (year of progress.value() ?? []; track year.year) {
          <div class="flex flex-col gap-2">
            <div class="flex flex-wrap items-center gap-2">
              <span class="text-base font-semibold">{{ year.year }}</span>
              @if (year.status; as status) {
                <p-tag
                  [icon]="icons[status]"
                  [severity]="severities[status]"
                  [value]="'home.goals.status.' + status | translate"
                />
              }
              <span class="flex-1"></span>
              <span class="text-sm">
                {{ 'home.goals.saved' | translate }}
                <span class="font-mono font-semibold">{{ year.accumulated | money }}</span>
                @if (year.target !== null) {
                  / <span class="font-mono">{{ year.target | money }}</span>
                }
              </span>
              <p-button
                icon="pi pi-pencil"
                [text]="true"
                [rounded]="true"
                size="small"
                severity="secondary"
                [ariaLabel]="'home.goals.edit' | translate"
                [pTooltip]="'home.goals.edit' | translate"
                (onClick)="openDialog(year.year, year.target)"
              />
              <!-- Goals of years that already ended are history: only current / future ones can be deleted. -->
              @if (year.year >= currentYear) {
                <p-button
                  icon="pi pi-trash"
                  [text]="true"
                  [rounded]="true"
                  size="small"
                  severity="danger"
                  [ariaLabel]="'home.goals.delete' | translate"
                  [pTooltip]="'home.goals.delete' | translate"
                  (onClick)="confirmDelete(year.year)"
                />
              }
            </div>
            @if (year.percentage !== null) {
              <div
                class="h-2 overflow-hidden rounded-full bg-surface-200 dark:bg-surface-700"
                role="progressbar"
                [attr.aria-valuenow]="year.percentage"
                aria-valuemin="0"
                aria-valuemax="100"
              >
                <div
                  class="h-full rounded-full"
                  [class]="barClass(year)"
                  [style.width.%]="year.percentage"
                ></div>
              </div>
              <small class="text-muted-color">
                {{ year.percentage | number: '1.0-1' : language.locale() }} % ·
                {{ 'home.goals.expected' | translate }}
                {{ year.expected | money }}
              </small>
            } @else {
              <small class="text-muted-color">{{ 'home.goals.noGoal' | translate }}</small>
            }
            <div class="grid grid-cols-6 gap-1 sm:grid-cols-12">
              @for (month of year.months; track month.month) {
                <span
                  class="flex flex-col items-center rounded-border border px-1 py-1 text-xs"
                  [class]="monthClass(month)"
                  [pTooltip]="monthTooltip(year, month)"
                >
                  <span class="capitalize">{{ monthName(year.year, month.month) }}</span>
                  @if (month.status; as status) {
                    <i [class]="icons[status]" class="text-[0.6rem]"></i>
                  }
                </span>
              }
            </div>
          </div>
        } @empty {
          <p class="m-0 text-sm text-muted-color">{{ 'home.goals.empty' | translate }}</p>
        }
      </div>
    </p-card>

    <p-dialog
      [(visible)]="dialogVisible"
      [modal]="true"
      [header]="'home.goals.dialogTitle' | translate: { year: dialogYear() }"
      [style]="{ width: '24rem' }"
    >
      <div class="flex flex-col gap-2">
        <label for="goal-target">{{ 'home.goals.target' | translate }}</label>
        <p-inputnumber
          size="small"
          inputId="goal-target"
          [ngModel]="dialogTarget()"
          (ngModelChange)="dialogTarget.set($event)"
          mode="decimal"
          [minFractionDigits]="2"
          [maxFractionDigits]="2"
          [min]="0"
          [locale]="language.locale()"
          styleClass="w-full"
        />
        <small class="text-muted-color">{{ 'home.goals.targetHelp' | translate }}</small>
      </div>
      <ng-template #footer>
        @if (dialogHasGoal() && dialogYear() >= currentYear) {
          <p-button
            size="small"
            icon="pi pi-trash"
            severity="danger"
            [text]="true"
            [label]="'common.delete' | translate"
            (onClick)="deleteGoal()"
          />
        }
        <p-button
          size="small"
          [label]="'common.cancel' | translate"
          severity="secondary"
          [text]="true"
          (onClick)="dialogVisible.set(false)"
        />
        <p-button
          size="small"
          icon="pi pi-save"
          [label]="'common.save' | translate"
          [disabled]="!dialogTarget()"
          (onClick)="saveGoal()"
        />
      </ng-template>
    </p-dialog>
  `,
})
export class GoalProgressCardComponent {
  private readonly api = inject(DashboardApiService);
  private readonly translate = inject(TranslateService);
  private readonly notifier = inject(ErrorNotifier);
  private readonly confirmation = inject(ConfirmationService);
  protected readonly language = inject(LanguageService);

  protected readonly currentYear = new Date().getFullYear();
  protected readonly severities = SEVERITIES;
  protected readonly icons = ICONS;

  protected readonly progress = rxResource({ stream: () => this.api.progress(3) });

  protected readonly dialogVisible = signal(false);
  protected readonly dialogYear = signal(this.currentYear);
  protected readonly dialogTarget = signal<number | null>(null);
  protected readonly dialogHasGoal = signal(false);

  protected openDialog(year: number, target?: number | null): void {
    const current =
      target ?? this.progress.value()?.find((progress) => progress.year === year)?.target ?? null;
    this.dialogYear.set(year);
    this.dialogTarget.set(current);
    this.dialogHasGoal.set(current !== null);
    this.dialogVisible.set(true);
  }

  protected confirmDelete(year: number): void {
    this.confirmation.confirm({
      header: this.translate.instant('home.goals.delete'),
      message: this.translate.instant('home.goals.deleteConfirm', { year }),
      icon: 'pi pi-exclamation-triangle',
      acceptButtonProps: {
        size: 'small',
        label: this.translate.instant('common.delete'),
        severity: 'danger',
      },
      rejectButtonProps: {
        size: 'small',
        label: this.translate.instant('common.cancel'),
        severity: 'secondary',
        text: true,
      },
      accept: () => {
        this.dialogYear.set(year);
        this.deleteGoal();
      },
    });
  }

  protected saveGoal(): void {
    const target = this.dialogTarget();
    if (!target) {
      return;
    }
    this.api.saveGoal(this.dialogYear(), target).subscribe(() => {
      this.notifier.success('home.goals.goalSaved');
      this.dialogVisible.set(false);
      this.progress.reload();
    });
  }

  protected deleteGoal(): void {
    this.api.deleteGoal(this.dialogYear()).subscribe(() => {
      this.notifier.success('home.goals.deleted');
      this.dialogVisible.set(false);
      this.progress.reload();
    });
  }

  protected barClass(year: YearProgress): string {
    switch (year.status) {
      case 'SUCCESS':
        return 'bg-green-500';
      case 'WARNING':
        return 'bg-orange-400';
      case 'DANGER':
        return 'bg-red-500';
      default:
        return 'bg-primary';
    }
  }

  protected monthClass(month: MonthProgress): string {
    switch (month.status) {
      case 'SUCCESS':
        return 'border-green-500 text-green-600 dark:text-green-400';
      case 'WARNING':
        return 'border-orange-400 text-orange-600 dark:text-orange-300';
      case 'DANGER':
        return 'border-red-500 text-red-600 dark:text-red-400';
      default:
        return 'border-surface text-muted-color';
    }
  }

  protected monthName(year: number, month: number): string {
    return format(new Date(year, month - 1, 1), 'MMM', { locale: this.language.dateFnsLocale() });
  }

  protected monthTooltip(year: YearProgress, month: MonthProgress): string {
    const net = formatAmount(month.net, this.language.locale());
    const status = month.status
      ? ` · ${this.translate.instant('home.goals.status.' + month.status) as string}`
      : '';
    return `${this.translate.instant('home.net') as string}: ${net}${status}`;
  }
}
