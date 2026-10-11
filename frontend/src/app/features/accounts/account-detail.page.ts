import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input, numberAttribute } from '@angular/core';
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
import { MoneyPipe } from '../../shared/money/money.pipe';
import { AccountTypeSeverityPipe } from '../../shared/pipes/account-type.pipes';
import { StatusSeverityPipe } from '../../shared/pipes/status-severity.pipe';
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
        <div class="flex gap-2">
          <p-button
            icon="pi pi-pencil"
            [label]="'common.edit' | translate"
            severity="secondary"
            [routerLink]="['/accounts', account.id, 'edit']"
          />
          <p-button
            icon="pi pi-trash"
            [label]="'common.delete' | translate"
            severity="danger"
            [outlined]="true"
            (onClick)="confirmDelete()"
          />
        </div>
      </div>

      <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <p-card styleClass="lg:col-span-1">
          <dl class="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-3">
            @if (account.balance !== null) {
              <dt class="text-muted-color">{{ 'accounts.balance' | translate }}</dt>
              <dd class="m-0 font-mono text-lg font-semibold">
                {{ account.balance | money: account.currency.iso }}
              </dd>
            }
            @if (account.pendingExpense !== null) {
              <dt class="text-muted-color">{{ 'accounts.pendingExpense' | translate }}</dt>
              <dd class="m-0 font-mono">
                {{ account.pendingExpense | money: account.currency.iso }}
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

        <p-card [header]="'accounts.subAccounts' | translate" styleClass="lg:col-span-3">
          @if (children.value()?.content; as children) {
            @if (children.length) {
              <p-table [value]="children" dataKey="id" [tableStyle]="{ 'min-width': '32rem' }">
                <ng-template #body let-child>
                  <tr>
                    <td class="w-12">
                      <app-account-avatar
                        [icon]="child.icon"
                        [color]="child.color"
                        [type]="child.type"
                      />
                    </td>
                    <td>
                      <a [routerLink]="['/accounts', child.id]">{{ child.name }}</a>
                    </td>
                    <td>
                      <p-tag
                        [value]="'enums.accountType.' + child.type | translate"
                        [severity]="child.type | accountTypeSeverity"
                      />
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
          <p class="m-0 text-muted-color">{{ 'accounts.noTransactionsYet' | translate }}</p>
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

  protected confirmDelete(): void {
    const account = this.account.value();
    if (!account) {
      return;
    }
    this.confirmation.confirm({
      header: this.translate.instant('accounts.deleteTitle'),
      message: this.translate.instant('accounts.deleteConfirm', { name: account.name }),
      icon: 'pi pi-exclamation-triangle',
      acceptButtonProps: { label: this.translate.instant('common.delete'), severity: 'danger' },
      rejectButtonProps: {
        label: this.translate.instant('common.cancel'),
        severity: 'secondary',
        text: true,
      },
      accept: () =>
        this.api.delete(account.id).subscribe(() => {
          this.notifier.success('accounts.deleted');
          void this.router.navigate(['/accounts']);
        }),
    });
  }
}
