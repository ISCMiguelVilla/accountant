import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { ProgressBarModule } from 'primeng/progressbar';
import { TagModule } from 'primeng/tag';
import { LanguageService } from '../../../core/i18n/language.service';
import { AccountAvatarComponent } from '../../../shared/components/account-avatar.component';
import { fromCents, toCents } from '../../../shared/money/money';
import { MoneyPipe } from '../../../shared/money/money.pipe';
import { AccountTypeSeverityPipe } from '../../../shared/pipes/account-type.pipes';
import { AccountApiService } from '../../accounts/account-api.service';

/** Cards of the accounts in use (docs/documentacion-tecnica.md §8.4 / §10), with the totals on top. */
@Component({
  selector: 'app-account-cards',
  imports: [
    DatePipe,
    DecimalPipe,
    RouterLink,
    TranslatePipe,
    ProgressBarModule,
    TagModule,
    AccountAvatarComponent,
    AccountTypeSeverityPipe,
    MoneyPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section>
      <div class="mb-3 flex flex-wrap items-baseline justify-between gap-3">
        <h2 class="m-0 text-lg font-semibold">{{ 'home.cards.title' | translate }}</h2>
        <div class="flex flex-wrap gap-4 text-sm">
          <span
            >{{ 'home.cards.available' | translate }}:
            <span class="font-mono font-semibold">{{ totals().assets | money }}</span></span
          >
          @if (totals().debt) {
            <span
              >{{ 'home.cards.debt' | translate }}:
              <span class="font-mono font-semibold">{{ totals().debt | money }}</span></span
            >
          }
        </div>
      </div>
      <div class="grid grid-cols-1 gap-2 sm:grid-cols-2 2xl:grid-cols-3">
        @for (account of accounts.value() ?? []; track account.id) {
          <a
            [routerLink]="['/accounts', account.id]"
            class="flex flex-col gap-1.5 rounded-border border border-surface bg-surface-0 px-3 py-2 text-sm text-color no-underline transition-colors hover:border-primary dark:bg-surface-900"
          >
            <div class="flex items-center gap-2">
              <app-account-avatar
                [icon]="account.icon"
                [color]="account.color"
                [type]="account.type"
              />
              <div class="flex min-w-0 flex-1 flex-col">
                <span class="truncate font-medium">{{ account.name }}</span>
                <p-tag
                  class="self-start"
                  [value]="'enums.accountType.' + account.type | translate"
                  [severity]="account.type | accountTypeSeverity"
                />
              </div>
            </div>
            <span class="font-mono text-base font-semibold">{{
              account.balance | money: account.currency.iso
            }}</span>
            @if (account.credit; as credit) {
              <div class="flex flex-col gap-1 text-xs text-muted-color">
                <p-progressbar
                  [value]="credit.usagePercentage"
                  [showValue]="false"
                  styleClass="h-1.5"
                />
                <span
                  >{{ 'accounts.credit.available' | translate }}:
                  {{ credit.availableCredit | money }} ·
                  {{ credit.usagePercentage | number: '1.0-0' : language.locale() }} %</span
                >
                <span
                  >{{ 'home.cards.cutOff' | translate }}
                  {{ credit.cutOffDay | date: 'd MMM' : undefined : language.locale() }} ·
                  {{ 'home.cards.paymentDue' | translate }}
                  {{ credit.paymentDueDay | date: 'd MMM' : undefined : language.locale() }}</span
                >
              </div>
            }
          </a>
        }
        <a
          routerLink="/accounts/new"
          class="flex min-h-20 flex-col items-center justify-center gap-1 rounded-border border border-dashed border-surface px-3 py-2 text-sm text-muted-color no-underline transition-colors hover:border-primary hover:text-color"
        >
          <i class="pi pi-plus"></i>
          <span>{{ 'accounts.new' | translate }}</span>
        </a>
      </div>
    </section>
  `,
})
export class AccountCardsComponent {
  private readonly api = inject(AccountApiService);
  protected readonly language = inject(LanguageService);

  protected readonly accounts = rxResource({ stream: () => this.api.inUse() });

  /** Money held vs debts (DEBTOR), summed in cents. */
  protected readonly totals = computed(() => {
    let assets = 0;
    let debt = 0;
    for (const account of this.accounts.value() ?? []) {
      if (account.type === 'DEBTOR') {
        debt += toCents(account.balance);
      } else {
        assets += toCents(account.balance);
      }
    }
    return { assets: fromCents(assets), debt: fromCents(debt) };
  });
}
