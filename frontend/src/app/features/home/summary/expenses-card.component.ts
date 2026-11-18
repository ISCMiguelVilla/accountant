import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import type { ChartData, ChartOptions } from 'chart.js';
import { addMonths, format } from 'date-fns';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ChartModule } from 'primeng/chart';
import { TooltipModule } from 'primeng/tooltip';
import { LanguageService } from '../../../core/i18n/language.service';
import { ThemeService } from '../../../core/theme/theme.service';
import { formatAmount } from '../../../shared/money/money';
import { MoneyPipe } from '../../../shared/money/money.pipe';
import { DashboardApiService } from '../dashboard-api.service';
import { ExpenseConcept } from '../dashboard.model';
import { chartTheme } from './chart-theme';

/** Categorical fallback (fixed order) for concepts whose account has no color. */
const FALLBACK = [
  '#2a78d6',
  '#eb6834',
  '#1baf7a',
  '#eda100',
  '#e87ba4',
  '#008300',
  '#6250d6',
  '#e34948',
];

interface ConceptRow {
  concept: ExpenseConcept;
  label: string;
  color: string;
  percentage: number;
}

/** Expenses of a month by concept (docs/documentacion-tecnica.md §10), each with its account color; fees in neutral gray. */
@Component({
  selector: 'app-expenses-card',
  imports: [
    DecimalPipe,
    RouterLink,
    TranslatePipe,
    ButtonModule,
    CardModule,
    ChartModule,
    TooltipModule,
    MoneyPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card styleClass="h-full">
      <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 class="m-0 text-lg font-semibold whitespace-nowrap">
          {{ 'home.expenses.title' | translate }}
        </h2>
        <div class="flex items-center">
          <p-button
            icon="pi pi-chevron-left"
            [text]="true"
            size="small"
            [ariaLabel]="'home.expenses.previous' | translate"
            (onClick)="move(-1)"
          />
          <span class="min-w-28 text-center text-sm capitalize">{{ monthLabel() }}</span>
          <p-button
            icon="pi pi-chevron-right"
            [text]="true"
            size="small"
            [ariaLabel]="'home.expenses.next' | translate"
            (onClick)="move(1)"
          />
        </div>
      </div>

      @if (rows().length) {
        <div class="relative mx-auto h-56 max-w-56">
          <p-chart type="doughnut" [data]="chartData()" [options]="chartOptions()" height="100%" />
          <div
            class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"
          >
            <span class="text-xs text-muted-color">{{ 'home.expenses.total' | translate }}</span>
            <span class="font-mono text-lg font-semibold">{{ data.value()?.total | money }}</span>
          </div>
        </div>
        <ul class="m-0 mt-4 flex list-none flex-col gap-2 p-0">
          @for (row of rows(); track row.label) {
            <li class="flex items-center gap-2 text-sm">
              <span
                class="inline-block h-3 w-3 shrink-0 rounded-full"
                [style.background-color]="row.color"
                aria-hidden="true"
              ></span>
              @if (row.concept.accountId; as id) {
                <a class="flex-1 truncate text-color" [routerLink]="['/accounts', id]">{{
                  row.label
                }}</a>
              } @else {
                <span class="flex-1 truncate">{{ row.label }}</span>
              }
              <span class="text-muted-color"
                >{{ row.percentage | number: '1.0-1' : language.locale() }} %</span
              >
              <span class="w-28 text-right font-mono">{{ row.concept.amount | money }}</span>
            </li>
          }
        </ul>
      } @else if (!data.isLoading()) {
        <div class="flex h-56 flex-col items-center justify-center gap-2 text-muted-color">
          <i class="pi pi-inbox text-3xl"></i>
          <span>{{ 'home.expenses.empty' | translate }}</span>
        </div>
      }
    </p-card>
  `,
})
export class ExpensesCardComponent {
  private readonly api = inject(DashboardApiService);
  private readonly translate = inject(TranslateService);
  private readonly theme = inject(ThemeService);
  protected readonly language = inject(LanguageService);

  private readonly month = signal(new Date());

  protected readonly data = rxResource({
    params: () => format(this.month(), 'yyyy-MM'),
    stream: ({ params }) => this.api.expensesByConcept(params),
  });

  protected readonly monthLabel = computed(() =>
    format(this.month(), 'MMMM yyyy', { locale: this.language.dateFnsLocale() }),
  );

  protected readonly rows = computed<ConceptRow[]>(() => {
    this.language.language();
    const data = this.data.value();
    const colors = chartTheme(this.theme.darkMode());
    if (!data || !data.total) {
      return [];
    }
    let fallback = 0;
    return data.concepts.map((concept) => ({
      concept,
      label: concept.accountId
        ? (concept.name ?? '')
        : (this.translate.instant('home.expenses.fees') as string),
      color: concept.accountId
        ? concept.color || FALLBACK[fallback++ % FALLBACK.length]
        : colors.fees,
      percentage: (concept.amount / data.total) * 100,
    }));
  });

  protected readonly chartData = computed<ChartData>(() => {
    const colors = chartTheme(this.theme.darkMode());
    const rows = this.rows();
    return {
      labels: rows.map((row) => row.label),
      datasets: [
        {
          data: rows.map((row) => row.concept.amount),
          backgroundColor: rows.map((row) => row.color),
          borderColor: colors.surface,
          borderWidth: 2,
          hoverOffset: 6,
        },
      ],
    };
  });

  protected readonly chartOptions = computed<ChartOptions<'doughnut'>>(() => {
    const locale = this.language.locale();
    return {
      maintainAspectRatio: false,
      cutout: '70%',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: { label: (item) => `${item.label}: ${formatAmount(item.parsed, locale)}` },
        },
      },
    };
  });

  protected move(months: number): void {
    this.month.set(addMonths(this.month(), months));
  }
}
