import { HttpParams } from '@angular/common/http';
import { Params } from '@angular/router';
import { SortMeta } from 'primeng/api';
import { TableLazyLoadEvent } from 'primeng/table';

/** How a filter is stored in the URL / sent to the API. */
export type FilterKind = 'text' | 'multi' | 'single';

export interface TableQueryConfig {
  /** Default page size (the API default is 20, max 100). */
  size?: number;
  /** Sort applied when the URL has none; also the API default. */
  defaultSort?: SortMeta[];
  filters?: Record<string, FilterKind>;
}

export type FilterValue = string | string[];

/** Paging, sorting and filtering state of a listing, mirrored in the URL query params. */
export interface TableQuery {
  page: number;
  size: number;
  sort: SortMeta[];
  filters: Record<string, FilterValue>;
}

export const PAGE_SIZES = [10, 20, 50, 100];
const DEFAULT_SIZE = 20;
const MAX_SIZE = 100;

/** Reads the table state from the route query params, ignoring anything invalid. */
export function parseTableQuery(params: Params, config: TableQueryConfig): TableQuery {
  const page = toInt(params['page'], 0);
  const size = toInt(params['size'], config.size ?? DEFAULT_SIZE);
  const sortValues = asArray(params['sort']);
  const sort = sortValues.length
    ? sortValues.map(parseSort).filter((meta): meta is SortMeta => meta !== null)
    : (config.defaultSort ?? []);

  const filters: Record<string, FilterValue> = {};
  for (const [name, kind] of Object.entries(config.filters ?? {})) {
    const values = asArray(params[name]).filter((value) => value !== '');
    if (!values.length) {
      continue;
    }
    filters[name] = kind === 'multi' ? values : values[0];
  }

  return {
    page: Math.max(page, 0),
    size: Math.min(Math.max(size, 1), MAX_SIZE),
    sort,
    filters,
  };
}

/** Query params for the URL; also the exact params the API expects. */
export function tableQueryToParams(query: TableQuery): Params {
  const params: Params = {
    page: query.page,
    size: query.size,
  };
  if (query.sort.length) {
    params['sort'] = query.sort.map(formatSort);
  }
  for (const [name, value] of Object.entries(query.filters)) {
    if (isEmpty(value)) {
      continue;
    }
    params[name] = value;
  }
  return params;
}

export function tableQueryToHttpParams(query: TableQuery): HttpParams {
  let httpParams = new HttpParams();
  for (const [name, value] of Object.entries(tableQueryToParams(query))) {
    for (const item of asArray(value)) {
      httpParams = httpParams.append(name, item);
    }
  }
  return httpParams;
}

/** Applies a PrimeNG lazy-load event (paging / sorting) to the current query. */
export function applyLazyEvent(query: TableQuery, event: TableLazyLoadEvent): TableQuery {
  const size = event.rows ?? query.size;
  const page = Math.floor((event.first ?? 0) / size);
  let sort = query.sort;
  if (event.multiSortMeta) {
    sort = event.multiSortMeta.map((meta) => ({ field: meta.field, order: meta.order }));
  } else if (typeof event.sortField === 'string' && event.sortField) {
    sort = [{ field: event.sortField, order: event.sortOrder ?? 1 }];
  }
  return { ...query, page, size, sort };
}

/** Changing a filter always goes back to the first page. */
export function applyFilter(
  query: TableQuery,
  name: string,
  value: FilterValue | null,
): TableQuery {
  const filters = { ...query.filters };
  if (value === null || isEmpty(value)) {
    delete filters[name];
  } else {
    filters[name] = value;
  }
  return { ...query, page: 0, filters };
}

export function sameQuery(a: TableQuery, b: TableQuery): boolean {
  return JSON.stringify(tableQueryToParams(a)) === JSON.stringify(tableQueryToParams(b));
}

function parseSort(value: string): SortMeta | null {
  const [field, direction] = value.split(',');
  if (!field) {
    return null;
  }
  return { field, order: direction?.toLowerCase() === 'desc' ? -1 : 1 };
}

function formatSort(meta: SortMeta): string {
  return `${meta.field},${meta.order === -1 ? 'desc' : 'asc'}`;
}

function asArray(value: unknown): string[] {
  if (value === undefined || value === null) {
    return [];
  }
  return (Array.isArray(value) ? value : [value]).map(String);
}

function toInt(value: unknown, fallback: number): number {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isEmpty(value: FilterValue): boolean {
  return Array.isArray(value) ? value.length === 0 : value.trim() === '';
}
