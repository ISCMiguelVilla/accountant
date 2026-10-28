import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { format, parseISO } from 'date-fns';
import { ButtonModule } from 'primeng/button';
import { ChipModule } from 'primeng/chip';
import { DatePickerModule } from 'primeng/datepicker';
import { MultiSelectModule } from 'primeng/multiselect';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { LanguageService } from '../../core/i18n/language.service';
import { TRANSACTION_TYPES } from '../../shared/enums/transaction-type.enum';
import { Transaction } from '../../shared/models/transaction.model';
import { MoneyPipe } from '../../shared/money/money.pipe';
import {
  OperationTypeSeverityPipe,
  TransactionTypeIconPipe,
} from '../../shared/pipes/transaction-type.pipes';
import { LazyTable } from '../../shared/table/lazy-table';
import { TableFilterBarComponent } from '../../shared/table/table-filter-bar.component';
import { PAGE_SIZES } from '../../shared/table/table-query';
import { TextFilterComponent } from '../../shared/table/text-filter.component';
import { ApplyTransactionService } from './apply-transaction.service';
import { TransactionApiService } from './transaction-api.service';

@Component({
  selector: 'app-transaction-list-page',
  imports: [
    DatePipe,
    FormsModule,
    RouterLink,
    TranslatePipe,
    ButtonModule,
    ChipModule,
    DatePickerModule,
    MultiSelectModule,
    SelectModule,
    TableModule,
    TagModule,
    TooltipModule,
    MoneyPipe,
    OperationTypeSeverityPipe,
    TableFilterBarComponent,
    TextFilterComponent,
    TransactionTypeIconPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h1 class="m-0 text-2xl font-semibold">{{ 'transactions.title' | translate }}</h1>
      <p-button
        icon="pi pi-plus"
        [label]="'transactions.batch.new' | translate"
        routerLink="/transactions/batch"
      />
    </div>

    <app-table-filter-bar (clear)="table.clearFilters()">
      <app-text-filter
        [value]="$any(table.filter('description'))"
        [placeholder]="'transactions.search' | translate"
        (changed)="table.setFilter('description', $event)"
      />
      <p-multiselect
        [options]="typeOptions"
        [ngModel]="table.filter('type') ?? []"
        (ngModelChange)="table.setFilter('type', $event)"
        [placeholder]="'transactions.type' | translate"
        [showToggleAll]="false"
        styleClass="min-w-44"
      >
        <ng-template #item let-option>{{
          'enums.transactionType.' + option | translate
        }}</ng-template>
        <ng-template #selecteditems let-values>
          {{ selectedLabel(values) | translate }}
        </ng-template>
      </p-multiselect>
      <p-select
        [options]="accounts.value() ?? []"
        optionLabel="name"
        optionValue="id"
        [filter]="true"
        [showClear]="true"
        [ngModel]="accountFilter()"
        (ngModelChange)="table.setFilter('accountId', $event === null ? null : String($event))"
        [placeholder]="'transactions.account' | translate"
        styleClass="min-w-48"
      />
      <p-select
        [options]="appliedOptions"
        optionLabel="label"
        optionValue="value"
        [showClear]="true"
        [ngModel]="table.filter('applied') ?? null"
        (ngModelChange)="table.setFilter('applied', $event)"
        [placeholder]="'transactions.appliedFilter' | translate"
        styleClass="min-w-40"
      >
        <ng-template #selectedItem let-option>{{ option.label | translate }}</ng-template>
        <ng-template #item let-option>{{ option.label | translate }}</ng-template>
      </p-select>
      <p-datepicker
        [ngModel]="dateFilter('dateFrom')"
        (ngModelChange)="setDate('dateFrom', $event)"
        [showClear]="true"
        [placeholder]="'transactions.dateFrom' | translate"
        [showIcon]="true"
      />
      <p-datepicker
        [ngModel]="dateFilter('dateTo')"
        (ngModelChange)="setDate('dateTo', $event)"
        [showClear]="true"
        [placeholder]="'transactions.dateTo' | translate"
        [showIcon]="true"
      />
      @if (table.filter('batchUuid'); as batch) {
        <p-chip
          icon="pi pi-box"
          [label]="'transactions.batchFilter' | translate"
          [removable]="true"
          (onRemove)="table.setFilter('batchUuid', null)"
          [pTooltip]="$any(batch)"
        />
      }
    </app-table-filter-bar>

    <p-table
      [value]="transactions()"
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
      [tableStyle]="{ 'min-width': '72rem' }"
    >
      <ng-template #header>
        <tr>
          <th pSortableColumn="operationDate">
            {{ 'transactions.operationDate' | translate }} <p-sortIcon field="operationDate" />
          </th>
          <th pSortableColumn="type">
            {{ 'transactions.type' | translate }} <p-sortIcon field="type" />
          </th>
          <th>{{ 'transactions.description' | translate }}</th>
          <th>{{ 'transactions.origin' | translate }}</th>
          <th>{{ 'transactions.destination' | translate }}</th>
          <th pSortableColumn="amount" class="text-right">
            {{ 'transactions.amount' | translate }} <p-sortIcon field="amount" />
          </th>
          <th class="text-right">{{ 'transactions.fee' | translate }}</th>
          <th>{{ 'transactions.operationType' | translate }}</th>
          <th pSortableColumn="appliedAt">
            {{ 'transactions.applied' | translate }} <p-sortIcon field="appliedAt" />
          </th>
        </tr>
      </ng-template>
      <ng-template #body let-tx>
        <tr>
          <td class="whitespace-nowrap">
            {{ tx.operationDate | date: 'short' : undefined : language.locale() }}
          </td>
          <td class="whitespace-nowrap">
            <i [class]="tx.type | transactionTypeIcon" class="mr-1"></i>
            {{ 'enums.transactionType.' + tx.type | translate }}
          </td>
          <td class="max-w-64 truncate" [pTooltip]="tx.description">{{ tx.description }}</td>
          <td>
            <a [routerLink]="['/accounts', tx.origin.id]">{{ tx.origin.name }}</a>
          </td>
          <td>
            @if (tx.destination; as destination) {
              <a [routerLink]="['/accounts', destination.id]">{{ destination.name }}</a>
            } @else {
              —
            }
          </td>
          <td class="text-right font-mono whitespace-nowrap">
            {{ tx.amount | money: tx.currency?.iso }}
          </td>
          <td class="text-right font-mono whitespace-nowrap">
            {{ tx.fee > 0 ? (tx.fee | money) : '—' }}
          </td>
          <td>
            <p-tag
              [value]="'enums.operationType.' + tx.operationType | translate"
              [severity]="tx.operationType | operationTypeSeverity"
            />
          </td>
          <td class="whitespace-nowrap">
            @if (tx.applied) {
              <span class="text-sm text-muted-color">{{
                tx.appliedAt | date: 'short' : undefined : language.locale()
              }}</span>
            } @else {
              <p-button
                icon="pi pi-check"
                size="small"
                severity="warn"
                [outlined]="true"
                [label]="'transactions.apply.action' | translate"
                (onClick)="apply(tx)"
              />
            }
          </td>
        </tr>
      </ng-template>
      <ng-template #emptymessage>
        <tr>
          <td colspan="9" class="text-center text-muted-color">{{ 'common.empty' | translate }}</td>
        </tr>
      </ng-template>
    </p-table>
  `,
})
export class TransactionListPage {
  private readonly api = inject(TransactionApiService);
  private readonly applyAction = inject(ApplyTransactionService);
  protected readonly language = inject(LanguageService);
  protected readonly String = String;

  protected readonly table = new LazyTable({
    defaultSort: [{ field: 'operationDate', order: -1 }],
    filters: {
      description: 'text',
      type: 'multi',
      accountId: 'single',
      applied: 'single',
      dateFrom: 'single',
      dateTo: 'single',
      appliedFrom: 'single',
      appliedTo: 'single',
      batchUuid: 'single',
    },
  });

  protected readonly data = rxResource({
    params: () => this.table.httpParams(),
    stream: ({ params }) => this.api.findAll(params),
  });

  protected readonly accounts = rxResource({ stream: () => this.api.accountOptions() });

  protected readonly transactions = computed(() => this.data.value()?.content ?? []);
  protected readonly total = computed(() => this.data.value()?.totalElements ?? 0);
  protected readonly accountFilter = computed(() => {
    const value = this.table.filter('accountId');
    return typeof value === 'string' ? Number(value) : null;
  });

  protected readonly pageSizes = PAGE_SIZES;
  protected readonly typeOptions = [...TRANSACTION_TYPES];
  protected readonly appliedOptions = [
    { label: 'transactions.appliedOnly', value: 'true' },
    { label: 'transactions.pendingOnly', value: 'false' },
  ];

  protected selectedLabel(values: string[] | null): string {
    return values?.length === 1
      ? `enums.transactionType.${values[0]}`
      : values?.length
        ? 'common.selectedMany'
        : '';
  }

  protected dateFilter(name: string): Date | null {
    const value = this.table.filter(name);
    return typeof value === 'string' ? parseISO(value) : null;
  }

  protected setDate(name: string, date: Date | null): void {
    this.table.setFilter(name, date ? format(date, 'yyyy-MM-dd') : null);
  }

  protected apply(transaction: Transaction): void {
    this.applyAction.confirmApply(transaction, () => this.data.reload());
  }
}
