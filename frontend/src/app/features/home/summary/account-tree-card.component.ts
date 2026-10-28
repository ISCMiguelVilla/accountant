import { DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { CardModule } from 'primeng/card';
import { LanguageService } from '../../../core/i18n/language.service';
import { AccountAvatarComponent } from '../../../shared/components/account-avatar.component';
import { MoneyPipe } from '../../../shared/money/money.pipe';
import { DashboardApiService } from '../dashboard-api.service';

/** Accounts and sub-accounts grouped (PROMPT 6.1.4), computed by `/dashboard/summary`. */
@Component({
  selector: 'app-account-tree-card',
  imports: [
    DecimalPipe,
    NgTemplateOutlet,
    RouterLink,
    TranslatePipe,
    CardModule,
    AccountAvatarComponent,
    MoneyPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card styleClass="h-full">
      <h2 class="mt-0 mb-4 text-lg font-semibold">{{ 'home.tree.title' | translate }}</h2>
      @if (summary.value(); as summary) {
        <dl class="m-0 mb-4 grid grid-cols-3 gap-2 text-sm">
          <div>
            <dt class="text-muted-color">{{ 'home.tree.assets' | translate }}</dt>
            <dd class="m-0 font-mono font-semibold">{{ summary.assets | money }}</dd>
          </div>
          <div>
            <dt class="text-muted-color">{{ 'home.tree.debt' | translate }}</dt>
            <dd class="m-0 font-mono font-semibold">{{ summary.debt | money }}</dd>
          </div>
          <div>
            <dt class="text-muted-color">{{ 'home.tree.net' | translate }}</dt>
            <dd class="m-0 font-mono font-semibold">{{ summary.net | money }}</dd>
          </div>
        </dl>
        @if (summary.nodes.length) {
          <ul class="m-0 flex list-none flex-col gap-3 p-0">
            @for (node of summary.nodes; track node.id) {
              <ng-container *ngTemplateOutlet="item; context: { $implicit: node, depth: 0 }" />
            }
          </ul>
        } @else {
          <p class="m-0 text-muted-color">{{ 'home.tree.empty' | translate }}</p>
        }
      }
    </p-card>

    <ng-template #item let-node let-depth="depth">
      <li class="flex flex-col gap-1" [style.padding-left.rem]="depth * 1.25">
        <div class="flex items-center gap-2 text-sm">
          <app-account-avatar [icon]="node.icon" [color]="node.color" [type]="node.type" />
          <a class="flex-1 truncate text-color" [routerLink]="['/accounts', node.id]">{{
            node.name
          }}</a>
          <span class="text-muted-color"
            >{{ node.percentage | number: '1.0-1' : language.locale() }} %</span
          >
          <span class="w-28 text-right font-mono">{{ node.total | money }}</span>
        </div>
        <div class="ml-10 h-1.5 overflow-hidden rounded-full bg-surface-200 dark:bg-surface-700">
          <div
            class="h-full rounded-full"
            [style.width.%]="node.percentage"
            [style.background-color]="node.color || 'var(--p-primary-color)'"
          ></div>
        </div>
        @if (node.children.length) {
          <ul class="m-0 mt-2 flex list-none flex-col gap-3 p-0">
            @for (child of node.children; track child.id) {
              <ng-container
                *ngTemplateOutlet="item; context: { $implicit: child, depth: depth + 1 }"
              />
            }
          </ul>
        }
      </li>
    </ng-template>
  `,
})
export class AccountTreeCardComponent {
  private readonly api = inject(DashboardApiService);
  protected readonly language = inject(LanguageService);

  protected readonly summary = rxResource({ stream: () => this.api.summary() });
}
