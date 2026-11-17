import { DatePipe, DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  numberAttribute,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { HttpParams } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ConfirmationService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ProgressBarModule } from 'primeng/progressbar';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { of } from 'rxjs';
import { ErrorNotifier } from '../../core/http/error-notifier.service';
import { LanguageService } from '../../core/i18n/language.service';
import { AccountAvatarComponent } from '../../shared/components/account-avatar.component';
import { AccountType } from '../../shared/enums/account-type.enum';
import { MoneyPipe } from '../../shared/money/money.pipe';
import { AccountTypeSeverityPipe } from '../../shared/pipes/account-type.pipes';
import { StatusSeverityPipe } from '../../shared/pipes/status-severity.pipe';
import { AccountTransactionsComponent } from '../transactions/account-transactions.component';
import { AccountApiService } from './account-api.service';

@Component({
  selector: 'app-account-detail-page',
  imports: [
    DatePipe,
    DecimalPipe,
    RouterLink,
    TranslatePipe,
    ButtonModule,
    CardModule,
    ProgressBarModule,
    TableModule,
    TagModule,
    AccountAvatarComponent,
    AccountTransactionsComponent,
    AccountTypeSeverityPipe,
    MoneyPipe,
    StatusSeverityPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (account.value(); as account) {
      <div class="mb-6 flex flex-wrap items-center gap-4">
        <app-account-avatar
          size="lg"
          [icon]="account.icon"
          [color]="account.color"
          [type]="account.type"
        />
        <div class="flex min-w-0 flex-1 flex-col gap-1">
          <h1 class="m-0 truncate text-2xl font-semibold">{{ account.name }}</h1>
          <div class="flex flex-wrap items-center gap-2">
            <p-tag
              [value]="'enums.accountType.' + account.type | translate"
              [severity]="account.type | accountTypeSeverity"
            />
            <p-tag
              [value]="'enums.accountStatus.' + account.status | translate"
              [severity]="account.status | statusSeverity"
            />
            @if (account.temporary) {
              <p-tag
                icon="pi pi-hourglass"
                severity="info"
                [value]="'accounts.temporary' | translate"
              />
            }
          </div>
        </div>
        <div class="flex flex-wrap gap-2">
          @if (account.parent; as parent) {
            <p-button
              size="small"
              icon="pi pi-arrow-up"
              severity="secondary"
              [outlined]="true"
              [label]="'accounts.goToParent' | translate: { name: parent.name }"
              [routerLink]="['/accounts', parent.id]"
            />
          }
          <p-button
            size="small"
            icon="pi pi-pencil"
            [label]="'common.edit' | translate"
            severity="secondary"
            [routerLink]="['/accounts', account.id, 'edit']"
          />
          <p-button
            size="small"
            icon="pi pi-trash"
            [label]="'common.delete' | translate"
            severity="danger"
            [outlined]="true"
            (onClick)="confirmDelete()"
          />
        </div>
      </div>

      <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <!-- Without a credit line the data card takes the whole row. -->
        <p-card [styleClass]="account.credit ? 'lg:col-span-1' : 'lg:col-span-3'">
          <dl class="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-3">
            @if (account.balance !== null) {
              <dt class="text-muted-color">{{ 'accounts.balance' | translate }}</dt>
              <dd class="m-0 font-mono text-lg font-semibold">
                {{ account.balance | money: account.currency.iso }}
              </dd>
            }
            <dt class="text-muted-color">{{ 'accounts.currency' | translate }}</dt>
            <dd class="m-0">{{ account.currency.iso }} · {{ account.currency.name }}</dd>
            <dt class="text-muted-color">{{ 'accounts.parent' | translate }}</dt>
            <dd class="m-0">
              @if (account.parent; as parent) {
                <a [routerLink]="['/accounts', parent.id]">{{ parent.name }}</a>
              } @else {
                —
              }
            </dd>
            <dt class="text-muted-color">{{ 'accounts.includeInBalance' | translate }}</dt>
            <dd class="m-0">
              {{ (account.includeInBalance ? 'common.yes' : 'common.no') | translate }}
            </dd>
            <dt class="text-muted-color">{{ 'common.createdAt' | translate }}</dt>
            <dd class="m-0">
              {{ account.createdAt | date: 'medium' : undefined : language.locale() }}
            </dd>
          </dl>
        </p-card>

        @if (account.credit; as credit) {
          <p-card [header]="'accounts.credit.title' | translate" styleClass="lg:col-span-2">
            <div class="flex flex-col gap-4">
              <div>
                <div class="mb-2 flex justify-between text-sm">
                  <span>{{ 'accounts.credit.used' | translate }}</span>
                  <span>{{ credit.usagePercentage | number: '1.0-2' : language.locale() }} %</span>
                </div>
                <p-progressbar [value]="credit.usagePercentage" [showValue]="false" />
              </div>
              <dl class="m-0 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                <div>
                  <dt class="text-muted-color">{{ 'accounts.credit.limit' | translate }}</dt>
                  <dd class="m-0 font-mono">
                    {{ credit.creditLimit | money: account.currency.iso }}
                  </dd>
                </div>
                <div>
                  <dt class="text-muted-color">{{ 'accounts.credit.available' | translate }}</dt>
                  <dd class="m-0 font-mono">
                    {{ credit.availableCredit | money: account.currency.iso }}
                  </dd>
                </div>
                <div>
                  <dt class="text-muted-color">{{ 'accounts.credit.cutOffDay' | translate }}</dt>
                  <dd class="m-0">
                    {{ credit.cutOffDay | date: 'fullDate' : undefined : language.locale() }}
                  </dd>
                </div>
                <div>
                  <dt class="text-muted-color">
                    {{ 'accounts.credit.paymentDueDay' | translate }}
                  </dt>
                  <dd class="m-0">
                    {{ credit.paymentDueDay | date: 'fullDate' : undefined : language.locale() }}
                  </dd>
                </div>
              </dl>
            </div>
          </p-card>
        }

        <p-card styleClass="lg:col-span-3">
          <ng-template #title>
            <div class="flex flex-wrap items-center justify-between gap-2">
              <span>{{ 'accounts.subAccounts' | translate }}</span>
              <p-button
                size="small"
                icon="pi pi-plus"
                [outlined]="true"
                [label]="'accounts.addSubAccount' | translate"
                [routerLink]="['/accounts/new']"
                [queryParams]="{ parentId: account.id }"
              />
            </div>
          </ng-template>
          @if (sortedChildren(); as children) {
            @if (children.length) {
              <p-table
                size="small"
                [value]="children"
                dataKey="id"
                [rowHover]="true"
                [tableStyle]="{ 'min-width': '32rem' }"
              >
                <ng-template #body let-child>
                  <!-- No PrimeNG row-severity property exists: a disabled row gets a light red background utility. -->
                  <tr
                    class="cursor-pointer"
                    [class.bg-red-500/10]="child.status === 'DISABLED'"
                    tabindex="0"
                    (click)="open(child.id)"
                    (keydown.enter)="open(child.id)"
                  >
                    <td class="w-12">
                      <app-account-avatar
                        [icon]="child.icon"
                        [color]="child.color"
                        [type]="child.type"
                      />
                    </td>
                    <td class="font-medium">{{ child.name }}</td>
                    <td>
                      <div class="flex flex-wrap gap-1">
                        <p-tag
                          [value]="'enums.accountType.' + child.type | translate"
                          [severity]="child.type | accountTypeSeverity"
                        />
                        @if (child.status === 'DISABLED') {
                          <p-tag
                            severity="danger"
                            [value]="'enums.accountStatus.DISABLED' | translate"
                          />
                        }
                      </div>
                    </td>
                    <td class="text-right font-mono">
                      {{
                        child.balance === null ? '—' : (child.balance | money: child.currency.iso)
                      }}
                    </td>
                  </tr>
                </ng-template>
              </p-table>
            } @else {
              <p class="m-0 text-muted-color">{{ 'accounts.noSubAccounts' | translate }}</p>
            }
          }
        </p-card>

        <p-card [header]="'accounts.lastTransactions' | translate" styleClass="lg:col-span-3">
          <app-account-transactions [accountId]="account.id" (changed)="reload()" />
        </p-card>
      </div>
    } @else if (account.error()) {
      <p class="text-muted-color">{{ 'errors.RESOURCE_NOT_FOUND' | translate }}</p>
      <a routerLink="/accounts">{{ 'accounts.backToList' | translate }}</a>
    }
  `,
})
export class AccountDetailPage {
  private readonly api = inject(AccountApiService);
  private readonly router = inject(Router);
  private readonly confirmation = inject(ConfirmationService);
  private readonly translate = inject(TranslateService);
  private readonly notifier = inject(ErrorNotifier);
  protected readonly language = inject(LanguageService);

  readonly id = input.required({ transform: numberAttribute });

  protected readonly account = rxResource({
    params: () => this.id(),
    stream: ({ params: id }) => this.api.findById(id),
  });

  protected readonly children = rxResource({
    params: () => this.id(),
    stream: ({ params: id }) =>
      id
        ? this.api.findAll(
            new HttpParams().set('parentId', id).set('size', 100).set('sort', 'name,asc'),
          )
        : of(null),
  });

  /** Debts first (Por pagar), then receivables (Por cobrar), then the rest; by name inside each group. */
  protected readonly sortedChildren = computed(() => {
    const children = this.children.value()?.content;
    if (!children) {
      return null;
    }
    const rank = (type: AccountType) => (type === 'DEBTOR' ? 0 : type === 'CREDITOR' ? 1 : 2);
    return [...children].sort((a, b) => rank(a.type) - rank(b.type));
  });

  protected open(id: number): void {
    void this.router.navigate(['/accounts', id]);
  }

  protected reload(): void {
    this.account.reload();
    this.children.reload();
  }

  protected confirmDelete(): void {
    const account = this.account.value();
    if (!account) {
      return;
    }
    this.confirmation.confirm({
      header: this.translate.instant('accounts.deleteTitle'),
      message: this.translate.instant('accounts.deleteConfirm', { name: account.name }),
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
      accept: () =>
        this.api.delete(account.id).subscribe(() => {
          this.notifier.success('accounts.deleted');
          // Back to the parent when there is one, otherwise to the list.
          void this.router.navigate(
            account.parent ? ['/accounts', account.parent.id] : ['/accounts'],
          );
        }),
    });
  }
}
