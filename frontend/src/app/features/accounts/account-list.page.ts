import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { MultiSelectModule } from 'primeng/multiselect';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { AccountAvatarComponent } from '../../shared/components/account-avatar.component';
import { EDITABLE_ACCOUNT_STATUSES } from '../../shared/enums/account-status.enum';
import { ACCOUNT_TYPES } from '../../shared/enums/account-type.enum';
import { Account } from '../../shared/models/account.model';
import { MoneyPipe } from '../../shared/money/money.pipe';
import { AccountTypeSeverityPipe } from '../../shared/pipes/account-type.pipes';
import { StatusSeverityPipe } from '../../shared/pipes/status-severity.pipe';
import { LazyTable } from '../../shared/table/lazy-table';
import { TableFilterBarComponent } from '../../shared/table/table-filter-bar.component';
import { PAGE_SIZES } from '../../shared/table/table-query';
import { TextFilterComponent } from '../../shared/table/text-filter.component';
import { AccountApiService } from './account-api.service';

@Component({
  selector: 'app-account-list-page',
  imports: [
    FormsModule,
    RouterLink,
    TranslatePipe,
    ButtonModule,
    MultiSelectModule,
    TableModule,
    TagModule,
    TooltipModule,
    AccountAvatarComponent,
    AccountTypeSeverityPipe,
    MoneyPipe,
    StatusSeverityPipe,
    TableFilterBarComponent,
    TextFilterComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h1 class="m-0 text-2xl font-semibold">{{ 'accounts.title' | translate }}</h1>
      <p-button icon="pi pi-plus" [label]="'accounts.new' | translate" routerLink="/accounts/new" />
    </div>

    <app-table-filter-bar (clear)="table.clearFilters()">
      <app-text-filter
        [value]="$any(table.filter('name'))"
        [placeholder]="'accounts.search' | translate"
        (changed)="table.setFilter('name', $event)"
      />
      <p-multiselect
        [options]="typeOptions"
        [ngModel]="table.filter('type') ?? []"
        (ngModelChange)="table.setFilter('type', $event)"
        [placeholder]="'accounts.type' | translate"
        [showToggleAll]="false"
        styleClass="min-w-48"
      >
        <ng-template #item let-option>{{ 'enums.accountType.' + option | translate }}</ng-template>
        <ng-template #selecteditems let-values>
          {{ selectedLabel(values, 'enums.accountType.') | translate }}
        </ng-template>
      </p-multiselect>
      <p-multiselect
        [options]="statusOptions"
        [ngModel]="table.filter('status') ?? []"
        (ngModelChange)="table.setFilter('status', $event)"
        [placeholder]="'common.status' | translate"
        [showToggleAll]="false"
        styleClass="min-w-48"
      >
        <ng-template #item let-option>{{
          'enums.accountStatus.' + option | translate
        }}</ng-template>
        <ng-template #selecteditems let-values>
          {{ selectedLabel(values, 'enums.accountStatus.') | translate }}
        </ng-template>
      </p-multiselect>
    </app-table-filter-bar>

    <p-table
      [value]="accounts()"
      [lazy]="true"
      [loading]="data.isLoading()"
      [paginator]="true"
      [rows]="table.query().size"
      [first]="table.first()"
      [totalRecords]="total()"
      [rowsPerPageOptions]="pageSizes"
      sortMode="multiple"
      [multiSortMeta]="table.sortMeta()"
      (onLazyLoad)="table.onLazyLoad($event)"
      [showCurrentPageReport]="true"
      [currentPageReportTemplate]="'common.pageReport' | translate"
      dataKey="id"
      [rowHover]="true"
      [tableStyle]="{ 'min-width': '56rem' }"
    >
      <ng-template #header>
        <tr>
          <th class="w-12">
            <span class="sr-only">{{ 'accounts.icon' | translate }}</span>
          </th>
          <th pSortableColumn="name">
            {{ 'common.name' | translate }} <p-sortIcon field="name" />
          </th>
          <th pSortableColumn="type">
            {{ 'accounts.type' | translate }} <p-sortIcon field="type" />
          </th>
          <th>{{ 'accounts.parent' | translate }}</th>
          <th pSortableColumn="balance" class="text-right">
            {{ 'accounts.balance' | translate }} <p-sortIcon field="balance" />
          </th>
          <th>{{ 'common.status' | translate }}</th>
        </tr>
      </ng-template>
      <ng-template #body let-account>
        <tr class="cursor-pointer" (click)="open(account)">
          <td>
            <app-account-avatar
              [icon]="account.icon"
              [color]="account.color"
              [type]="account.type"
            />
          </td>
          <td>
            <a [routerLink]="['/accounts', account.id]" class="font-medium text-color no-underline">
              {{ account.name }}
            </a>
            @if (account.temporary) {
              <i
                class="pi pi-hourglass ml-2 text-muted-color"
                [pTooltip]="'accounts.temporary' | translate"
              ></i>
            }
          </td>
          <td>
            <p-tag
              [value]="'enums.accountType.' + account.type | translate"
              [severity]="account.type | accountTypeSeverity"
            />
          </td>
          <td>{{ account.parent?.name ?? '—' }}</td>
          <td class="text-right font-mono whitespace-nowrap">
            {{ account.balance === null ? '—' : (account.balance | money: account.currency.iso) }}
          </td>
          <td>
            <p-tag
              [value]="'enums.accountStatus.' + account.status | translate"
              [severity]="account.status | statusSeverity"
            />
          </td>
        </tr>
      </ng-template>
      <ng-template #emptymessage>
        <tr>
          <td colspan="6" class="text-center text-muted-color">{{ 'common.empty' | translate }}</td>
        </tr>
      </ng-template>
    </p-table>
  `,
})
export class AccountListPage {
  private readonly api = inject(AccountApiService);
  private readonly router = inject(Router);

  protected readonly table = new LazyTable({
    defaultSort: [{ field: 'name', order: 1 }],
    filters: { name: 'text', type: 'multi', status: 'multi' },
  });

  protected readonly data = rxResource({
    params: () => this.table.httpParams(),
    stream: ({ params }) => this.api.findAll(params),
  });

  protected readonly accounts = computed(() => this.data.value()?.content ?? []);
  protected readonly total = computed(() => this.data.value()?.totalElements ?? 0);

  protected readonly pageSizes = PAGE_SIZES;
  protected readonly typeOptions = [...ACCOUNT_TYPES];
  protected readonly statusOptions = [...EDITABLE_ACCOUNT_STATUSES];

  protected selectedLabel(values: string[] | null, prefix: string): string {
    return values?.length === 1 ? prefix + values[0] : values?.length ? 'common.selectedMany' : '';
  }

  protected open(account: Account): void {
    void this.router.navigate(['/accounts', account.id]);
  }
}
