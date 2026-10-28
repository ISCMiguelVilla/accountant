import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { TabsModule } from 'primeng/tabs';
import { CalendarTabComponent } from './calendar/calendar-tab.component';
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
    AccountCardsComponent,
    AccountTreeCardComponent,
    CalendarTabComponent,
    ExpensesCardComponent,
    GoalProgressCardComponent,
    IncomeStatementCardComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="mb-4 text-2xl font-semibold">{{ 'home.title' | translate }}</h1>
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
      </p-tablist>
      <p-tabpanels>
        <p-tabpanel value="summary">
          <div class="flex flex-col gap-4">
            <app-account-cards />
            <div class="grid grid-cols-1 gap-4 xl:grid-cols-3">
              <app-income-statement-card class="xl:col-span-2" />
              <app-expenses-card />
            </div>
            <div class="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <app-account-tree-card />
              <app-goal-progress-card />
            </div>
          </div>
        </p-tabpanel>
        <p-tabpanel value="calendar">
          <app-calendar-tab />
        </p-tabpanel>
      </p-tabpanels>
    </p-tabs>
  `,
})
export class HomePage {}
