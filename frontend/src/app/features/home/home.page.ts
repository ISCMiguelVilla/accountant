import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { TabsModule } from 'primeng/tabs';

@Component({
  selector: 'app-home-page',
  imports: [TranslatePipe, TabsModule],
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
          <p class="text-muted-color">{{ 'common.comingSoon' | translate }}</p>
        </p-tabpanel>
        <p-tabpanel value="calendar">
          <p class="text-muted-color">{{ 'common.comingSoon' | translate }}</p>
        </p-tabpanel>
      </p-tabpanels>
    </p-tabs>
  `,
})
export class HomePage {}
