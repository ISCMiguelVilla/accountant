import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';
import { TabsModule } from 'primeng/tabs';
import { MoneyPipe } from '../../shared/money/money.pipe';
import { CalendarTabComponent } from './calendar/calendar-tab.component';
import { DashboardApiService } from './dashboard-api.service';
import { AccountCardsComponent } from './summary/account-cards.component';
import { AccountTreeCardComponent } from './summary/account-tree-card.component';
import { ExpensesCardComponent } from './summary/expenses-card.component';
import { GoalProgressCardComponent } from './summary/goal-progress-card.component';
import { IncomeStatementCardComponent } from './summary/income-statement-card.component';

@Component({
  selector: 'app-home-page',
  imports: [
    TranslatePipe,
    TabsModule,
    MoneyPipe,
    AccountCardsComponent,
    AccountTreeCardComponent,
    CalendarTabComponent,
    ExpensesCardComponent,
    GoalProgressCardComponent,
    IncomeStatementCardComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-tabs value="summary">
      <p-tablist>
        <p-tab value="summary">
          <i class="pi pi-chart-bar mr-2"></i>
          <span>{{ 'home.tabs.summary' | translate }}</span>
        </p-tab>
        <p-tab value="calendar">
          <i class="pi pi-calendar mr-2"></i>
          <span>{{ 'home.tabs.calendar' | translate }}</span>
        </p-tab>
        <!-- Available balance (same figure as "Disponible" in the accounts summary), PrimeNG green. -->
        @if (summary.value(); as summary) {
          <span
            class="ml-auto self-center px-4 font-mono text-lg font-semibold whitespace-nowrap text-(--p-green-600) dark:text-(--p-green-400)"
            [attr.aria-label]="'home.tree.assets' | translate"
            >$ {{ summary.assets | money: 'MXN' }}</span
          >
        }
      </p-tablist>
      <p-tabpanels>
        <p-tabpanel value="summary">
          <!--
            | Estado de resultados | Gastos por concepto |
            | Cuentas en uso       | Resumen de cuentas  |
          -->
          <div class="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
            <app-income-statement-card />
            <app-expenses-card />
            <app-account-cards />
            <app-account-tree-card />
          </div>
        </p-tabpanel>
        <p-tabpanel value="calendar">
          <!-- Calendar and yearly goal side by side on wide screens, stacked below that. -->
          <div class="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
            <app-calendar-tab />
            <app-goal-progress-card />
          </div>
        </p-tabpanel>
      </p-tabpanels>
    </p-tabs>
  `,
})
export class HomePage {
  private readonly api = inject(DashboardApiService);

  protected readonly summary = rxResource({ stream: () => this.api.summary() });
}
