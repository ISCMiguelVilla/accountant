import { HttpParams } from '@angular/common/http';
import { computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { TableLazyLoadEvent } from 'primeng/table';
import { map } from 'rxjs';
import {
  FilterValue,
  TableQuery,
  TableQueryConfig,
  applyFilter,
  applyLazyEvent,
  parseTableQuery,
  sameQuery,
  tableQueryToHttpParams,
  tableQueryToParams,
} from './table-query';

/**
 * State of a lazy `p-table` kept in the URL query params, so reloading, sharing the link or going
 * back restores the same page, sort and filters. Create it in a component field initializer:
 *
 * ```ts
 * protected readonly table = new LazyTable({ defaultSort: [{ field: 'name', order: 1 }] });
 * ```
 */
export class LazyTable {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  /** Current state, derived from the URL. */
  readonly query;
  /** Params for the API call; feed them to a resource/loader. */
  readonly httpParams;
  /** `[first]` binding of p-table. */
  readonly first;
  /** `[multiSortMeta]` binding of p-table (sortMode="multiple"). */
  readonly sortMeta;

  constructor(private readonly config: TableQueryConfig = {}) {
    this.query = toSignal(
      this.route.queryParams.pipe(map((params) => parseTableQuery(params, this.config))),
      { initialValue: parseTableQuery(this.route.snapshot.queryParams, this.config) },
    );
    this.httpParams = computed<HttpParams>(() => tableQueryToHttpParams(this.query()));
    this.first = computed(() => this.query().page * this.query().size);
    this.sortMeta = computed(() => this.query().sort);
  }

  filter(name: string): FilterValue | undefined {
    return this.query().filters[name];
  }

  onLazyLoad(event: TableLazyLoadEvent): void {
    this.navigate(applyLazyEvent(this.query(), event));
  }

  setFilter(name: string, value: FilterValue | null): void {
    this.navigate(applyFilter(this.query(), name, value));
  }

  clearFilters(): void {
    this.navigate({ ...this.query(), page: 0, filters: {} });
  }

  private navigate(next: TableQuery): void {
    if (sameQuery(next, this.query())) {
      return;
    }
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: tableQueryToParams(next),
    });
  }
}
