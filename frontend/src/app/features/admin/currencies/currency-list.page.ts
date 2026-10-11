import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { MultiSelectModule } from 'primeng/multiselect';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { CURRENCY_STATUSES } from '../../../shared/enums/currency-status.enum';
import { Currency } from '../../../shared/models/currency.model';
import { StatusSeverityPipe } from '../../../shared/pipes/status-severity.pipe';
import { LazyTable } from '../../../shared/table/lazy-table';
import { TableFilterBarComponent } from '../../../shared/table/table-filter-bar.component';
import { PAGE_SIZES } from '../../../shared/table/table-query';
import { TextFilterComponent } from '../../../shared/table/text-filter.component';
import { CurrencyApiService } from './currency-api.service';
import { CurrencyFormDialogComponent } from './currency-form-dialog.component';

@Component({
  selector: 'app-currency-list-page',
  imports: [
    FormsModule,
    TranslatePipe,
    ButtonModule,
    MultiSelectModule,
    TableModule,
    TagModule,
    TooltipModule,
    StatusSeverityPipe,
    TableFilterBarComponent,
    TextFilterComponent,
    CurrencyFormDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h1 class="m-0 text-2xl font-semibold">{{ 'admin.currencies.title' | translate }}</h1>
      <p-button
        icon="pi pi-plus"
        [label]="'admin.currencies.new' | translate"
        (onClick)="editing.set('new')"
      />
    </div>
    <p class="mt-0 mb-4 text-muted-color">{{ 'admin.currencies.illustrative' | translate }}</p>

    <app-table-filter-bar (clear)="table.clearFilters()">
      <app-text-filter
        [value]="$any(table.filter('name'))"
        [placeholder]="'admin.currencies.search' | translate"
        (changed)="table.setFilter('name', $event)"
      />
      <p-multiselect
        [options]="statusOptions"
        [ngModel]="table.filter('status') ?? []"
        (ngModelChange)="table.setFilter('status', $event)"
        [placeholder]="'common.status' | translate"
        [showToggleAll]="false"
        styleClass="min-w-48"
      >
        <ng-template #item let-option>{{
          'enums.currencyStatus.' + option | translate
        }}</ng-template>
      </p-multiselect>
    </app-table-filter-bar>

    <p-table
      [value]="currencies()"
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
      [tableStyle]="{ 'min-width': '36rem' }"
    >
      <ng-template #header>
        <tr>
          <th pSortableColumn="name">
            {{ 'common.name' | translate }} <p-sortIcon field="name" />
          </th>
          <th pSortableColumn="iso">
            {{ 'admin.currencies.iso' | translate }} <p-sortIcon field="iso" />
          </th>
          <th>{{ 'admin.currencies.symbol' | translate }}</th>
          <th>{{ 'common.status' | translate }}</th>
          <th class="w-20">
            <span class="sr-only">{{ 'common.actions' | translate }}</span>
          </th>
        </tr>
      </ng-template>
      <ng-template #body let-currency>
        <tr>
          <td>{{ currency.name }}</td>
          <td class="font-mono">{{ currency.iso }}</td>
          <td>{{ currency.symbol }}</td>
          <td>
            <p-tag
              [value]="'enums.currencyStatus.' + currency.status | translate"
              [severity]="currency.status | statusSeverity"
            />
          </td>
          <td>
            <p-button
              icon="pi pi-pencil"
              [text]="true"
              [rounded]="true"
              severity="secondary"
              [pTooltip]="'common.edit' | translate"
              [ariaLabel]="'common.edit' | translate"
              (onClick)="editing.set(currency)"
            />
          </td>
        </tr>
      </ng-template>
      <ng-template #emptymessage>
        <tr>
          <td colspan="5" class="text-center text-muted-color">{{ 'common.empty' | translate }}</td>
        </tr>
      </ng-template>
    </p-table>

    <app-currency-form-dialog
      [currency]="editing()"
      (closed)="editing.set(null)"
      (saved)="onSaved()"
    />
  `,
})
export class CurrencyListPage {
  private readonly api = inject(CurrencyApiService);

  protected readonly table = new LazyTable({
    defaultSort: [{ field: 'name', order: 1 }],
    filters: { name: 'text', status: 'multi' },
  });

  protected readonly data = rxResource({
    params: () => this.table.httpParams(),
    stream: ({ params }) => this.api.findAll(params),
  });

  protected readonly currencies = computed(() => this.data.value()?.content ?? []);
  protected readonly total = computed(() => this.data.value()?.totalElements ?? 0);
  /** `'new'` opens the dialog to create; a currency opens it to edit. */
  protected readonly editing = signal<Currency | 'new' | null>(null);

  protected readonly pageSizes = PAGE_SIZES;
  protected readonly statusOptions = [...CURRENCY_STATUSES];

  protected onSaved(): void {
    this.editing.set(null);
    this.data.reload();
  }
}
