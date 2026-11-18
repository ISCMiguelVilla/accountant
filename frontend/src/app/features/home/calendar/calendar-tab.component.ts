import { DatePipe } from '@angular/common';
import { HttpParams } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { ButtonModule } from 'primeng/button';
import { DrawerModule } from 'primeng/drawer';
import { TagModule } from 'primeng/tag';
import { of } from 'rxjs';
import { LanguageService } from '../../../core/i18n/language.service';
import { MoneyPipe } from '../../../shared/money/money.pipe';
import { TransactionTypeIconPipe } from '../../../shared/pipes/transaction-type.pipes';
import { TransactionApiService } from '../../transactions/transaction-api.service';
import { DashboardApiService } from '../dashboard-api.service';
import { CalendarDay } from '../dashboard.model';

const ISO_DATE = 'yyyy-MM-dd';

interface Cell {
  date: Date;
  key: string;
  inMonth: boolean;
  today: boolean;
  data: CalendarDay | undefined;
}

/**
 * Monthly calendar (docs/documentacion-tecnica.md §10): weeks start on Monday; per day the applied income / expense, the
 * credit cut-off and payment dates and the future scheduled transactions. Click → day detail.
 */
@Component({
  selector: 'app-calendar-tab',
  imports: [
    DatePipe,
    RouterLink,
    TranslatePipe,
    ButtonModule,
    DrawerModule,
    TagModule,
    MoneyPipe,
    TransactionTypeIconPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h2 class="m-0 text-xl font-semibold capitalize">{{ monthLabel() }}</h2>
      <div class="flex items-center gap-1">
        <p-button
          size="small"
          icon="pi pi-chevron-left"
          [text]="true"
          [ariaLabel]="'home.calendar.previous' | translate"
          (onClick)="move(-1)"
        />
        <p-button
          [label]="'home.calendar.today' | translate"
          severity="secondary"
          [outlined]="true"
          size="small"
          (onClick)="month.set(today)"
        />
        <p-button
          size="small"
          icon="pi pi-chevron-right"
          [text]="true"
          [ariaLabel]="'home.calendar.next' | translate"
          (onClick)="move(1)"
        />
      </div>
    </div>

    <div class="overflow-hidden rounded-border border border-surface">
      <div class="grid grid-cols-7 border-b border-surface bg-surface-50 dark:bg-surface-900">
        @for (name of weekDays(); track $index) {
          <div class="px-2 py-2 text-center text-xs font-medium uppercase text-muted-color">
            {{ name }}
          </div>
        }
      </div>
      <div class="grid grid-cols-7" [class.opacity-60]="data.isLoading()">
        @for (cell of cells(); track cell.key) {
          <button
            type="button"
            class="flex min-h-20 flex-col gap-1 border-b border-r border-surface p-1 text-left align-top transition-colors hover:bg-emphasis sm:min-h-28 sm:p-2"
            [class]="cell.inMonth ? '' : 'bg-surface-50 text-muted-color dark:bg-surface-950'"
            [attr.aria-label]="cell.date | date: 'fullDate' : undefined : language.locale()"
            (click)="open(cell)"
          >
            <span
              class="inline-flex h-6 w-6 items-center justify-center self-start rounded-full text-xs font-medium"
              [class.bg-primary]="cell.today"
              [class.text-primary-contrast]="cell.today"
              >{{ cell.date.getDate() }}</span
            >
            @if (cell.data; as day) {
              <!-- Compact dots on phones, details from sm up. -->
              <span class="flex gap-1 sm:hidden">
                @if (day.income > 0) {
                  <span class="h-1.5 w-1.5 rounded-full bg-green-500"></span>
                }
                @if (day.expense > 0) {
                  <span class="h-1.5 w-1.5 rounded-full bg-red-500"></span>
                }
                @if (day.creditEvents.length) {
                  <span class="h-1.5 w-1.5 rounded-full bg-primary"></span>
                }
                @if (day.scheduled.length) {
                  <span class="h-1.5 w-1.5 rounded-full border border-muted-color"></span>
                }
              </span>
              <span class="hidden flex-col gap-0.5 text-xs sm:flex">
                @if (day.income > 0) {
                  <span class="truncate font-mono text-green-600 dark:text-green-400"
                    >+{{ day.income | money }}</span
                  >
                }
                @if (day.expense > 0) {
                  <span class="truncate font-mono text-red-600 dark:text-red-400"
                    >-{{ day.expense | money }}</span
                  >
                }
                @for (event of day.creditEvents; track event.accountId + event.kind) {
                  <span class="flex items-center gap-1 truncate">
                    <i
                      [class]="
                        event.kind === 'CUT_OFF' ? 'pi pi-calendar-minus' : 'pi pi-credit-card'
                      "
                      class="text-[0.65rem]"
                      [style.color]="event.color"
                    ></i>
                    <span class="truncate"
                      >{{ 'home.calendar.' + event.kind | translate }} {{ event.accountName }}</span
                    >
                  </span>
                }
                @for (item of day.scheduled; track item.scheduleId + item.time) {
                  <span
                    class="truncate rounded border border-dashed border-surface px-1 text-muted-color"
                    >{{ item.description }}</span
                  >
                }
              </span>
            }
          </button>
        }
      </div>
    </div>

    <p-drawer
      [(visible)]="drawerVisible"
      position="right"
      [header]="(selected()?.date | date: 'fullDate' : undefined : language.locale()) ?? ''"
      styleClass="w-full sm:w-[28rem]"
    >
      @if (selected(); as cell) {
        <div class="flex flex-col gap-5">
          <div class="grid grid-cols-2 gap-3">
            <div class="rounded-border border border-surface p-3">
              <div class="text-xs text-muted-color">{{ 'home.income' | translate }}</div>
              <div class="font-mono text-green-600 dark:text-green-400">
                +{{ cell.data?.income ?? 0 | money }}
              </div>
            </div>
            <div class="rounded-border border border-surface p-3">
              <div class="text-xs text-muted-color">{{ 'home.expense' | translate }}</div>
              <div class="font-mono text-red-600 dark:text-red-400">
                -{{ cell.data?.expense ?? 0 | money }}
              </div>
            </div>
          </div>

          <section>
            <h3 class="mt-0 mb-2 text-sm font-semibold">
              {{ 'home.calendar.applied' | translate }}
            </h3>
            @if (dayTransactions.value()?.content; as transactions) {
              @if (transactions.length) {
                <ul class="m-0 flex list-none flex-col gap-2 p-0">
                  @for (tx of transactions; track tx.id) {
                    <li class="flex items-center gap-2 text-sm">
                      <i [class]="tx.type | transactionTypeIcon" class="text-muted-color"></i>
                      <span class="flex-1 truncate">{{ tx.description }}</span>
                      <span class="font-mono">{{ tx.amount | money: tx.currency.iso }}</span>
                    </li>
                  }
                </ul>
                <a
                  class="mt-2 inline-block text-sm"
                  routerLink="/transactions"
                  [queryParams]="{ appliedFrom: cell.key, appliedTo: cell.key }"
                >
                  {{ 'transactions.viewAll' | translate }}
                  <i class="pi pi-arrow-right text-xs"></i>
                </a>
              } @else {
                <p class="m-0 text-sm text-muted-color">
                  {{ 'home.calendar.noTransactions' | translate }}
                </p>
              }
            }
          </section>

          @if (cell.data?.creditEvents?.length) {
            <section>
              <h3 class="mt-0 mb-2 text-sm font-semibold">
                {{ 'home.calendar.credit' | translate }}
              </h3>
              <ul class="m-0 flex list-none flex-col gap-2 p-0">
                @for (event of cell.data!.creditEvents; track event.accountId + event.kind) {
                  <li class="flex items-center gap-2 text-sm">
                    <i
                      [class]="
                        event.kind === 'CUT_OFF' ? 'pi pi-calendar-minus' : 'pi pi-credit-card'
                      "
                      [style.color]="event.color"
                    ></i>
                    <a class="flex-1 truncate" [routerLink]="['/accounts', event.accountId]"
                      >{{ 'home.calendar.' + event.kind | translate }} {{ event.accountName }}</a
                    >
                    @if (event.kind === 'PAYMENT_DUE') {
                      <span class="font-mono">{{ event.balance | money }}</span>
                    }
                  </li>
                }
              </ul>
            </section>
          }

          @if (cell.data?.scheduled?.length) {
            <section>
              <h3 class="mt-0 mb-2 text-sm font-semibold">
                {{ 'home.calendar.scheduled' | translate }}
              </h3>
              <ul class="m-0 flex list-none flex-col gap-2 p-0">
                @for (item of cell.data!.scheduled; track item.scheduleId + item.time) {
                  <li
                    class="flex items-center gap-2 rounded-border border border-dashed border-surface p-2 text-sm"
                  >
                    <i [class]="item.type | transactionTypeIcon" class="text-muted-color"></i>
                    <span class="flex-1 truncate">{{ item.description }}</span>
                    <span class="text-xs text-muted-color">{{ item.time }}</span>
                    <span class="font-mono">{{ item.amount | money }}</span>
                  </li>
                }
              </ul>
              <a class="mt-2 inline-block text-sm" routerLink="/schedules">
                {{ 'home.calendar.viewSchedules' | translate }}
                <i class="pi pi-arrow-right text-xs"></i>
              </a>
            </section>
          }
        </div>
      }
    </p-drawer>
  `,
})
export class CalendarTabComponent {
  private readonly api = inject(DashboardApiService);
  private readonly transactions = inject(TransactionApiService);
  protected readonly language = inject(LanguageService);

  protected readonly today = new Date();
  protected readonly month = signal(startOfMonth(this.today));
  protected readonly drawerVisible = signal(false);
  protected readonly selected = signal<Cell | null>(null);

  /** Visible range: whole weeks (Monday first) covering the month. */
  private readonly range = computed(() => ({
    from: startOfWeek(startOfMonth(this.month()), { weekStartsOn: 1 }),
    to: endOfWeek(endOfMonth(this.month()), { weekStartsOn: 1 }),
  }));

  protected readonly data = rxResource({
    params: () => ({
      from: format(this.range().from, ISO_DATE),
      to: format(this.range().to, ISO_DATE),
    }),
    stream: ({ params }) => this.api.calendar(params.from, params.to),
  });

  protected readonly dayTransactions = rxResource({
    params: () => (this.drawerVisible() ? this.selected()?.key : undefined),
    stream: ({ params: day }) =>
      day
        ? this.transactions.findAll(
            new HttpParams()
              .set('appliedFrom', day)
              .set('appliedTo', day)
              .set('size', 50)
              .set('sort', 'appliedAt,asc'),
          )
        : of(null),
  });

  protected readonly monthLabel = computed(() =>
    format(this.month(), 'MMMM yyyy', { locale: this.language.dateFnsLocale() }),
  );

  protected readonly weekDays = computed(() => {
    const monday = startOfWeek(this.today, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) =>
      format(addDays(monday, i), 'EEE', { locale: this.language.dateFnsLocale() }),
    );
  });

  protected readonly cells = computed<Cell[]>(() => {
    const byDate = new Map((this.data.value()?.days ?? []).map((day) => [day.date, day]));
    const { from, to } = this.range();
    return eachDayOfInterval({ start: from, end: to }).map((date) => {
      const key = format(date, ISO_DATE);
      return {
        date,
        key,
        inMonth: isSameMonth(date, this.month()),
        today: isToday(date),
        data: byDate.get(key),
      };
    });
  });

  protected move(months: number): void {
    this.month.set(addMonths(this.month(), months));
  }

  protected open(cell: Cell): void {
    this.selected.set(cell);
    this.drawerVisible.set(true);
  }
}
