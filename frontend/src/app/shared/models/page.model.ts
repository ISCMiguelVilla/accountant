export type SortDirection = 'ASC' | 'DESC';

export interface SortOrder {
  field: string;
  direction: SortDirection;
}

/** Standard paged response returned by every listing endpoint. */
export interface Page<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  sort: SortOrder[];
}
