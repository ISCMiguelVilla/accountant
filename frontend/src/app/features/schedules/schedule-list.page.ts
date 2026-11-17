import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ConfirmationService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { MultiSelectModule } from 'primeng/multiselect';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { ErrorNotifier } from '../../core/http/error-notifier.service';
import { LanguageService } from '../../core/i18n/language.service';
import { EDITABLE_SCHEDULE_STATUSES } from '../../shared/enums/schedule-status.enum';
import { TRANSACTION_TYPES } from '../../shared/enums/transaction-type.enum';
import { Schedule } from '../../shared/models/schedule.model';
import { MoneyPipe } from '../../shared/money/money.pipe';
import { StatusSeverityPipe } from '../../shared/pipes/status-severity.pipe';
import { TransactionTypeIconPipe } from '../../shared/pipes/transaction-type.pipes';
import { LazyTable } from '../../shared/table/lazy-table';
import { TableFilterBarComponent } from '../../shared/table/table-filter-bar.component';
import { PAGE_SIZES } from '../../shared/table/table-query';
import { TextFilterComponent } from '../../shared/table/text-filter.component';
import { TransactionApiService } from '../transactions/transaction-api.service';
import { ScheduleApiService } from './schedule-api.service';

@Component({
  selector: 'app-schedule-list-page',
  imports: [
    DatePipe,
    FormsModule,
    RouterLink,
    TranslatePipe,
    ButtonModule,
    MultiSelectModule,
    SelectModule,
    TableModule,
    TagModule,
    TooltipModule,
    MoneyPipe,
    StatusSeverityPipe,
    TableFilterBarComponent,
    TextFilterComponent,
    TransactionTypeIconPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h1 class="m-0 text-2xl font-semibold">{{ 'schedules.title' | translate }}</h1>
      <p-button
        size="small"
        icon="pi pi-plus"
        [label]="'schedules.new' | translate"
        routerLink="/schedules/new"
      />
    </div>

    <app-table-filter-bar (clear)="table.clearFilters()">
      <app-text-filter
        [value]="$any(table.filter('description'))"
        [placeholder]="'transactions.search' | translate"
        (changed)="table.setFilter('description', $event)"
      />
      <p-multiselect
        size="small"
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
          {{ selectedLabel(values, 'enums.transactionType.') | translate }}
        </ng-template>
      </p-multiselect>
      <p-multiselect
        size="small"
        [options]="statusOptions"
        [ngModel]="table.filter('status') ?? []"
        (ngModelChange)="table.setFilter('status', $event)"
        [placeholder]="'common.status' | translate"
        [showToggleAll]="false"
        styleClass="min-w-40"
      >
        <ng-template #item let-option>{{
          'enums.scheduleStatus.' + option | translate
        }}</ng-template>
        <ng-template #selecteditems let-values>
          {{ selectedLabel(values, 'enums.scheduleStatus.') | translate }}
        </ng-template>
      </p-multiselect>
      <p-select
        size="small"
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
    </app-table-filter-bar>

    <p-table
      size="small"
      [value]="schedules()"
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
      [tableStyle]="{ 'min-width': '68rem' }"
    >
      <ng-template #header>
        <tr>
          <th pSortableColumn="description">
            {{ 'transactions.description' | translate }} <p-sortIcon field="description" />
          </th>
          <th>{{ 'transactions.type' | translate }}</th>
          <th>{{ 'schedules.accounts' | translate }}</th>
          <th pSortableColumn="amount" class="text-right">
            {{ 'transactions.amount' | translate }} <p-sortIcon field="amount" />
          </th>
          <th>{{ 'schedules.cron' | translate }}</th>
          <th pSortableColumn="nextExecution">
            {{ 'schedules.nextExecution' | translate }} <p-sortIcon field="nextExecution" />
          </th>
          <th>{{ 'common.status' | translate }}</th>
          <th class="w-44"></th>
        </tr>
      </ng-template>
      <ng-template #body let-schedule>
        <tr>
          <td class="max-w-64 truncate" [pTooltip]="schedule.description">
            {{ schedule.description }}
          </td>
          <td class="whitespace-nowrap">
            <i [class]="schedule.type | transactionTypeIcon" class="mr-1"></i>
            {{ 'enums.transactionType.' + schedule.type | translate }}
          </td>
          <td>
            {{ schedule.origin.name }}
            @if (schedule.destination; as destination) {
              <i class="pi pi-arrow-right mx-1 text-xs"></i>{{ destination.name }}
            }
          </td>
          <td class="text-right font-mono whitespace-nowrap">
            {{ schedule.amount | money: schedule.currency.iso }}
            @if (schedule.fee > 0) {
              <div class="text-xs text-muted-color">
                {{ 'transactions.fee' | translate }} {{ schedule.fee | money }}
              </div>
            }
          </td>
          <td class="font-mono text-sm">{{ schedule.cronExpression }}</td>
          <td class="whitespace-nowrap">
            {{ schedule.nextExecution | date: 'mediumDate' : undefined : language.locale() }}
            @if (schedule.lastExecution) {
              <div class="text-xs text-muted-color">
                {{ 'schedules.lastExecution' | translate }}:
                {{ schedule.lastExecution | date: 'mediumDate' : undefined : language.locale() }}
              </div>
            }
          </td>
          <td>
            <p-tag
              [value]="'enums.scheduleStatus.' + schedule.status | translate"
              [severity]="schedule.status | statusSeverity"
            />
          </td>
          <td class="whitespace-nowrap text-right">
            <p-button
              size="small"
              icon="pi pi-pencil"
              [text]="true"
              [rounded]="true"
              severity="secondary"
              [ariaLabel]="'common.edit' | translate"
              [pTooltip]="'common.edit' | translate"
              [routerLink]="['/schedules', schedule.id, 'edit']"
            />
            <p-button
              size="small"
              icon="pi pi-step-forward"
              [text]="true"
              [rounded]="true"
              severity="secondary"
              [ariaLabel]="'schedules.skip' | translate"
              [pTooltip]="'schedules.skip' | translate"
              (onClick)="confirmSkip(schedule)"
            />
            <p-button
              size="small"
              [icon]="schedule.status === 'ACTIVE' ? 'pi pi-pause' : 'pi pi-play'"
              [text]="true"
              [rounded]="true"
              severity="secondary"
              [ariaLabel]="
                (schedule.status === 'ACTIVE' ? 'schedules.disable' : 'schedules.enable')
                  | translate
              "
              [pTooltip]="
                (schedule.status === 'ACTIVE' ? 'schedules.disable' : 'schedules.enable')
                  | translate
              "
              (onClick)="toggle(schedule)"
            />
            <p-button
              size="small"
              icon="pi pi-trash"
              [text]="true"
              [rounded]="true"
              severity="danger"
              [ariaLabel]="'common.delete' | translate"
              [pTooltip]="'common.delete' | translate"
              (onClick)="confirmDelete(schedule)"
            />
          </td>
        </tr>
      </ng-template>
      <ng-template #emptymessage>
        <tr>
          <td colspan="8" class="text-center text-muted-color">{{ 'common.empty' | translate }}</td>
        </tr>
      </ng-template>
    </p-table>
  `,
})
export class ScheduleListPage {
  private readonly api = inject(ScheduleApiService);
  private readonly transactions = inject(TransactionApiService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly translate = inject(TranslateService);
  private readonly notifier = inject(ErrorNotifier);
  protected readonly language = inject(LanguageService);
  protected readonly String = String;

  protected readonly table = new LazyTable({
    defaultSort: [{ field: 'nextExecution', order: 1 }],
    filters: { description: 'text', type: 'multi', status: 'multi', accountId: 'single' },
  });

  protected readonly data = rxResource({
    params: () => this.table.httpParams(),
    stream: ({ params }) => this.api.findAll(params),
  });

  protected readonly accounts = rxResource({ stream: () => this.transactions.accountOptions() });

  protected readonly schedules = computed(() => this.data.value()?.content ?? []);
  protected readonly total = computed(() => this.data.value()?.totalElements ?? 0);
  protected readonly accountFilter = computed(() => {
    const value = this.table.filter('accountId');
    return typeof value === 'string' ? Number(value) : null;
  });

  protected readonly pageSizes = PAGE_SIZES;
  protected readonly typeOptions = [...TRANSACTION_TYPES];
  protected readonly statusOptions = [...EDITABLE_SCHEDULE_STATUSES];

  protected selectedLabel(values: string[] | null, prefix: string): string {
    return values?.length === 1 ? prefix + values[0] : values?.length ? 'common.selectedMany' : '';
  }

  protected toggle(schedule: Schedule): void {
    const status = schedule.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
    this.api.changeStatus(schedule.id, status).subscribe(() => {
      this.notifier.success(status === 'ACTIVE' ? 'schedules.enabled' : 'schedules.disabled');
      this.data.reload();
    });
  }

  protected confirmSkip(schedule: Schedule): void {
    this.confirmation.confirm({
      header: this.translate.instant('schedules.skip'),
      message: this.translate.instant('schedules.skipConfirm', {
        description: schedule.description,
      }),
      icon: 'pi pi-step-forward',
      acceptButtonProps: { size: 'small', label: this.translate.instant('schedules.skip') },
      rejectButtonProps: {
        size: 'small',
        label: this.translate.instant('common.cancel'),
        severity: 'secondary',
        text: true,
      },
      accept: () =>
        this.api.skip(schedule.id).subscribe(() => {
          this.notifier.success('schedules.skipped');
          this.data.reload();
        }),
    });
  }

  protected confirmDelete(schedule: Schedule): void {
    this.confirmation.confirm({
      header: this.translate.instant('schedules.deleteTitle'),
      message: this.translate.instant('schedules.deleteConfirm', {
        description: schedule.description,
      }),
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
        this.api.delete(schedule.id).subscribe(() => {
          this.notifier.success('schedules.deleted');
          this.data.reload();
        }),
    });
  }
}
