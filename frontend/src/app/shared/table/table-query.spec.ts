import {
  TableQuery,
  TableQueryConfig,
  applyFilter,
  applyLazyEvent,
  parseTableQuery,
  sameQuery,
  tableQueryToHttpParams,
  tableQueryToParams,
} from './table-query';

const config: TableQueryConfig = {
  defaultSort: [{ field: 'name', order: 1 }],
  filters: { name: 'text', status: 'multi' },
};

describe('table query', () => {
  it('uses defaults when the URL has no state', () => {
    expect(parseTableQuery({}, config)).toEqual({
      page: 0,
      size: 20,
      sort: [{ field: 'name', order: 1 }],
      filters: {},
    });
  });

  it('parses paging, repeatable sorts and declared filters only', () => {
    const query = parseTableQuery(
      {
        page: '2',
        size: '50',
        sort: ['createdAt,desc', 'name,asc'],
        status: 'ACTIVE',
        name: 'ana',
        unknown: 'x',
      },
      config,
    );

    expect(query).toEqual({
      page: 2,
      size: 50,
      sort: [
        { field: 'createdAt', order: -1 },
        { field: 'name', order: 1 },
      ],
      filters: { status: ['ACTIVE'], name: 'ana' },
    });
  });

  it('clamps invalid paging values', () => {
    const query = parseTableQuery({ page: '-3', size: '1000' }, config);
    expect(query.page).toBe(0);
    expect(query.size).toBe(100);
  });

  it('round-trips through URL params', () => {
    const query: TableQuery = {
      page: 1,
      size: 10,
      sort: [{ field: 'iso', order: -1 }],
      filters: { status: ['ACTIVE', 'DISABLED'], name: 'pe' },
    };

    expect(tableQueryToParams(query)).toEqual({
      page: 1,
      size: 10,
      sort: ['iso,desc'],
      status: ['ACTIVE', 'DISABLED'],
      name: 'pe',
    });
    expect(parseTableQuery(tableQueryToParams(query), config)).toEqual(query);
  });

  it('builds API params with repeated keys', () => {
    const params = tableQueryToHttpParams({
      page: 0,
      size: 20,
      sort: [
        { field: 'name', order: 1 },
        { field: 'createdAt', order: -1 },
      ],
      filters: { status: ['ACTIVE', 'DISABLED'] },
    });

    expect(params.getAll('sort')).toEqual(['name,asc', 'createdAt,desc']);
    expect(params.getAll('status')).toEqual(['ACTIVE', 'DISABLED']);
    expect(params.get('page')).toBe('0');
  });

  it('maps p-table lazy events to page and sort', () => {
    const query = parseTableQuery({}, config);

    const next = applyLazyEvent(query, {
      first: 40,
      rows: 20,
      multiSortMeta: [{ field: 'username', order: -1 }],
    });

    expect(next.page).toBe(2);
    expect(next.sort).toEqual([{ field: 'username', order: -1 }]);
  });

  it('resets to the first page when a filter changes and drops empty filters', () => {
    const query: TableQuery = { ...parseTableQuery({}, config), page: 3, filters: { name: 'x' } };

    expect(applyFilter(query, 'status', ['ACTIVE'])).toMatchObject({
      page: 0,
      filters: { name: 'x', status: ['ACTIVE'] },
    });
    expect(applyFilter(query, 'name', '  ').filters).toEqual({});
    expect(applyFilter(query, 'name', null).filters).toEqual({});
  });

  it('detects unchanged queries to avoid redundant navigations', () => {
    const query = parseTableQuery({}, config);
    expect(sameQuery(query, applyLazyEvent(query, { first: 0, rows: 20 }))).toBe(true);
    expect(sameQuery(query, applyLazyEvent(query, { first: 20, rows: 20 }))).toBe(false);
  });
});
