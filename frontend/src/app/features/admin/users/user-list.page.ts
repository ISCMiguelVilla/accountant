import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { MultiSelectModule } from 'primeng/multiselect';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { LanguageService } from '../../../core/i18n/language.service';
import { ROLES } from '../../../shared/enums/role.enum';
import { USER_STATUSES } from '../../../shared/enums/user-status.enum';
import { User } from '../../../shared/models/user.model';
import { StatusSeverityPipe } from '../../../shared/pipes/status-severity.pipe';
import { LazyTable } from '../../../shared/table/lazy-table';
import { TableFilterBarComponent } from '../../../shared/table/table-filter-bar.component';
import { PAGE_SIZES } from '../../../shared/table/table-query';
import { TextFilterComponent } from '../../../shared/table/text-filter.component';
import { UserAdminApiService } from './user-admin-api.service';
import { UserEditDialogComponent } from './user-edit-dialog.component';

@Component({
  selector: 'app-user-list-page',
  imports: [
    DatePipe,
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
    UserEditDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="mb-4 text-2xl font-semibold">{{ 'admin.users.title' | translate }}</h1>

    <app-table-filter-bar (clear)="table.clearFilters()">
      <app-text-filter
        [value]="$any(table.filter('name'))"
        [placeholder]="'admin.users.search' | translate"
        (changed)="table.setFilter('name', $event)"
      />
      <p-multiselect
        size="small"
        [options]="statusOptions"
        [ngModel]="table.filter('status') ?? []"
        (ngModelChange)="table.setFilter('status', $event)"
        [placeholder]="'common.status' | translate"
        [showToggleAll]="false"
        styleClass="min-w-48"
      >
        <ng-template #item let-option>{{ 'enums.userStatus.' + option | translate }}</ng-template>
        <ng-template #selecteditems let-values>
          {{ selectedLabel(values, 'enums.userStatus.') | translate }}
        </ng-template>
      </p-multiselect>
      <p-multiselect
        size="small"
        [options]="roleOptions"
        [ngModel]="table.filter('role') ?? []"
        (ngModelChange)="table.setFilter('role', $event)"
        [placeholder]="'admin.users.role' | translate"
        [showToggleAll]="false"
        styleClass="min-w-48"
      >
        <ng-template #item let-option>{{ 'enums.role.' + option | translate }}</ng-template>
        <ng-template #selecteditems let-values>
          {{ selectedLabel(values, 'enums.role.') | translate }}
        </ng-template>
      </p-multiselect>
    </app-table-filter-bar>

    <p-table
      size="small"
      [value]="users()"
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
      [tableStyle]="{ 'min-width': '48rem' }"
    >
      <ng-template #header>
        <tr>
          <th pSortableColumn="name">
            {{ 'common.name' | translate }} <p-sortIcon field="name" />
          </th>
          <th pSortableColumn="username">
            {{ 'auth.username' | translate }} <p-sortIcon field="username" />
          </th>
          <th>{{ 'admin.users.role' | translate }}</th>
          <th>{{ 'common.status' | translate }}</th>
          <th pSortableColumn="createdAt">
            {{ 'common.createdAt' | translate }} <p-sortIcon field="createdAt" />
          </th>
          <th class="w-20">
            <span class="sr-only">{{ 'common.actions' | translate }}</span>
          </th>
        </tr>
      </ng-template>
      <ng-template #body let-user>
        <tr>
          <td>{{ user.name }}</td>
          <td>{{ user.username }}</td>
          <td>
            <p-tag
              [value]="'enums.role.' + user.role | translate"
              [severity]="user.role | statusSeverity"
            />
          </td>
          <td>
            <p-tag
              [value]="'enums.userStatus.' + user.status | translate"
              [severity]="user.status | statusSeverity"
            />
          </td>
          <td>{{ user.createdAt | date: 'medium' : undefined : language.locale() }}</td>
          <td>
            <p-button
              size="small"
              icon="pi pi-pencil"
              [text]="true"
              [rounded]="true"
              severity="secondary"
              [pTooltip]="'common.edit' | translate"
              [ariaLabel]="'common.edit' | translate"
              (onClick)="editing.set(user)"
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

    <app-user-edit-dialog [user]="editing()" (closed)="editing.set(null)" (saved)="onSaved()" />
  `,
})
export class UserListPage {
  private readonly api = inject(UserAdminApiService);
  protected readonly language = inject(LanguageService);

  protected readonly table = new LazyTable({
    defaultSort: [{ field: 'name', order: 1 }],
    filters: { name: 'text', status: 'multi', role: 'multi' },
  });

  protected readonly data = rxResource({
    params: () => this.table.httpParams(),
    stream: ({ params }) => this.api.findAll(params),
  });

  protected readonly users = computed(() => this.data.value()?.content ?? []);
  protected readonly total = computed(() => this.data.value()?.totalElements ?? 0);
  protected readonly editing = signal<User | null>(null);

  protected readonly pageSizes = PAGE_SIZES;
  protected readonly statusOptions = [...USER_STATUSES];
  protected readonly roleOptions = [...ROLES];

  protected selectedLabel(values: string[] | null, prefix: string): string {
    return values?.length === 1 ? prefix + values[0] : values?.length ? 'common.selectedMany' : '';
  }

  protected onSaved(): void {
    this.editing.set(null);
    this.data.reload();
  }
}
