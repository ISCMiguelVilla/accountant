import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import type { ChartData, ChartOptions } from 'chart.js';
import { format, parseISO } from 'date-fns';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ChartModule } from 'primeng/chart';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TableModule } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';
import { LanguageService } from '../../../core/i18n/language.service';
import { ThemeService } from '../../../core/theme/theme.service';
import { formatAmount } from '../../../shared/money/money';
import { MoneyPipe } from '../../../shared/money/money.pipe';
import { DashboardApiService } from '../dashboard-api.service';
import { DIMENSIONS, DIMENSION_SIZES, Dimension, IncomeStatementPeriod } from '../dashboard.model';
import { chartTheme } from './chart-theme';

const LABEL_FORMATS: Record<Dimension, string> = {
  YEAR: 'yyyy',
  MONTH: 'MMM yyyy',
  WEEK: 'd MMM',
  DAY: 'EEE d',
};

/** Income statement (docs/documentacion-tecnica.md §10): income and expense bars plus the net line per period. */
@Component({
  selector: 'app-income-statement-card',
  imports: [
    FormsModule,
    TranslatePipe,
    ButtonModule,
    CardModule,
    ChartModule,
    SelectButtonModule,
    TableModule,
    TooltipModule,
    MoneyPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card>
      <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 class="m-0 text-lg font-semibold">{{ 'home.statement.title' | translate }}</h2>
        <div class="flex flex-wrap items-center gap-2">
          <p-selectbutton
            [options]="dimensions"
            [ngModel]="dimension()"
            (ngModelChange)="changeDimension($event)"
            [allowEmpty]="false"
            size="small"
            [ariaLabel]="'home.statement.dimension' | translate"
          >
            <ng-template #item let-option>{{
              'home.statement.dimensions.' + option | translate
            }}</ng-template>
          </p-selectbutton>
          <div class="flex items-center">
            <p-button
              icon="pi pi-chevron-left"
              [text]="true"
              size="small"
              [ariaLabel]="'home.statement.previous' | translate"
              [pTooltip]="'home.statement.previous' | translate"
              (onClick)="move(-1)"
            />
            <p-button
              icon="pi pi-calendar"
              [text]="true"
              size="small"
              [ariaLabel]="'home.statement.today' | translate"
              [pTooltip]="'home.statement.today' | translate"
              (onClick)="today()"
            />
            <p-button
              icon="pi pi-chevron-right"
              [text]="true"
              size="small"
              [ariaLabel]="'home.statement.next' | translate"
              [pTooltip]="'home.statement.next' | translate"
              (onClick)="move(1)"
            />
            <p-button
              icon="pi pi-search-minus"
              [text]="true"
              size="small"
              [disabled]="size() >= bounds().max"
              [ariaLabel]="'home.statement.widen' | translate"
              [pTooltip]="'home.statement.widen' | translate"
              (onClick)="resize(1)"
            />
            <p-button
              icon="pi pi-search-plus"
              [text]="true"
              size="small"
              [disabled]="size() <= bounds().min"
              [ariaLabel]="'home.statement.narrow' | translate"
              [pTooltip]="'home.statement.narrow' | translate"
              (onClick)="resize(-1)"
            />
            <p-button
              [icon]="showTable() ? 'pi pi-chart-bar' : 'pi pi-table'"
              [text]="true"
              size="small"
              [ariaLabel]="(showTable() ? 'home.showChart' : 'home.showTable') | translate"
              [pTooltip]="(showTable() ? 'home.showChart' : 'home.showTable') | translate"
              (onClick)="showTable.set(!showTable())"
            />
          </div>
        </div>
      </div>

      @if (showTable()) {
        <p-table size="small" [value]="periods()" [tableStyle]="{ 'min-width': '28rem' }">
          <ng-template #header>
            <tr>
              <th>{{ 'home.statement.period' | translate }}</th>
              <th class="text-right">{{ 'home.income' | translate }}</th>
              <th class="text-right">{{ 'home.expense' | translate }}</th>
              <th class="text-right">{{ 'home.net' | translate }}</th>
            </tr>
          </ng-template>
          <ng-template #body let-period>
            <tr>
              <td>{{ label(period) }}</td>
              <td class="text-right font-mono">{{ period.income | money }}</td>
              <td class="text-right font-mono">{{ period.expense | money }}</td>
              <td class="text-right font-mono">{{ period.net | money }}</td>
            </tr>
          </ng-template>
        </p-table>
      } @else {
        <div class="h-72">
          <p-chart type="bar" [data]="chartData()" [options]="chartOptions()" height="100%" />
        </div>
      }
    </p-card>
  `,
})
export class IncomeStatementCardComponent {
  private readonly api = inject(DashboardApiService);
  private readonly translate = inject(TranslateService);
  private readonly theme = inject(ThemeService);
  private readonly language = inject(LanguageService);

  protected readonly dimensions = [...DIMENSIONS];
  protected readonly dimension = signal<Dimension>('MONTH');
  protected readonly size = signal(DIMENSION_SIZES.MONTH.default);
  protected readonly reference = signal(new Date());
  protected readonly showTable = signal(false);
  protected readonly bounds = computed(() => DIMENSION_SIZES[this.dimension()]);

  private readonly data = rxResource({
    params: () => ({
      dimension: this.dimension(),
      size: this.size(),
      reference: format(this.reference(), 'yyyy-MM-dd'),
    }),
    stream: ({ params }) =>
      this.api.incomeStatement(params.dimension, params.size, params.reference),
  });

  protected readonly periods = computed(() => this.data.value()?.periods ?? []);

  protected readonly chartData = computed<ChartData>(() => {
    this.language.language();
    const colors = chartTheme(this.theme.darkMode());
    const periods = this.periods();
    return {
      labels: periods.map((period) => this.label(period)),
      datasets: [
        {
          type: 'line',
          label: this.translate.instant('home.net') as string,
          data: periods.map((period) => period.net),
          borderColor: colors.net,
          backgroundColor: colors.net,
          borderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBorderColor: colors.surface,
          pointBorderWidth: 2,
          tension: 0,
          order: 0,
        },
        {
          type: 'bar',
          label: this.translate.instant('home.income') as string,
          data: periods.map((period) => period.income),
          backgroundColor: colors.income,
          borderRadius: 4,
          borderSkipped: 'start',
          maxBarThickness: 28,
          order: 1,
        },
        {
          type: 'bar',
          label: this.translate.instant('home.expense') as string,
          data: periods.map((period) => period.expense),
          backgroundColor: colors.expense,
          borderRadius: 4,
          borderSkipped: 'start',
          maxBarThickness: 28,
          order: 1,
        },
      ],
    };
  });

  protected readonly chartOptions = computed<ChartOptions>(() => {
    const colors = chartTheme(this.theme.darkMode());
    const locale = this.language.locale();
    return {
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      datasets: { bar: { categoryPercentage: 0.7, barPercentage: 0.9 } },
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: colors.muted, usePointStyle: true, boxWidth: 8, boxHeight: 8 },
        },
        tooltip: {
          callbacks: {
            label: (item) => `${item.dataset.label}: ${formatAmount(item.parsed.y, locale)}`,
          },
        },
      },
      scales: {
        x: {
          ticks: { color: colors.muted },
          grid: { display: false },
          border: { color: colors.grid },
        },
        y: {
          ticks: {
            color: colors.muted,
            callback: (value) =>
              new Intl.NumberFormat(locale, { notation: 'compact' }).format(Number(value)),
          },
          grid: { color: colors.grid },
          border: { display: false },
        },
      },
    };
  });

  protected label(period: IncomeStatementPeriod): string {
    return format(parseISO(period.start), LABEL_FORMATS[this.dimension()], {
      locale: this.language.dateFnsLocale(),
    });
  }

  protected changeDimension(dimension: Dimension): void {
    this.dimension.set(dimension);
    this.size.set(DIMENSION_SIZES[dimension].default);
  }

  protected resize(delta: number): void {
    const { min, max } = this.bounds();
    this.size.set(Math.min(Math.max(this.size() + delta, min), max));
  }

  /** Moves the reference one period back / forward. */
  protected move(direction: number): void {
    const date = new Date(this.reference());
    switch (this.dimension()) {
      case 'YEAR':
        date.setFullYear(date.getFullYear() + direction);
        break;
      case 'MONTH':
        date.setDate(1);
        date.setMonth(date.getMonth() + direction);
        break;
      case 'WEEK':
        date.setDate(date.getDate() + 7 * direction);
        break;
      case 'DAY':
        date.setDate(date.getDate() + direction);
        break;
    }
    this.reference.set(date);
  }

  protected today(): void {
    this.reference.set(new Date());
  }
}
