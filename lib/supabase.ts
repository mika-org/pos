/* eslint-disable @typescript-eslint/no-explicit-any */

type FilterOperator = 'eq' | 'gte' | 'lte' | 'gt' | 'in';

interface QueryFilter {
  field: string;
  operator: FilterOperator;
  value: unknown;
}

interface QueryError {
  message: string;
  code?: string;
}

interface QueryResponse<T = any> {
  data: T | null;
  error: QueryError | null;
}

function currentTenantSlug() {
  if (typeof window === 'undefined') return process.env.NEXT_PUBLIC_DEFAULT_TENANT_SLUG || '';
  const queryTenant = new URLSearchParams(window.location.search).get('tenant');
  return queryTenant
    || window.localStorage.getItem('pos_tenant_slug')
    || process.env.NEXT_PUBLIC_DEFAULT_TENANT_SLUG
    || '';
}

class ApiQueryBuilder implements PromiseLike<QueryResponse> {
  private operation = 'select';
  private filters: QueryFilter[] = [];
  private columns = '*';
  private values: unknown;
  private orderBy?: { field: string; ascending: boolean };
  private take?: number;
  private wantsSingle = false;

  constructor(private readonly table: string) {}

  select(columns = '*') {
    this.columns = columns;
    return this;
  }

  insert(values: unknown) {
    this.operation = 'insert';
    this.values = values;
    return this;
  }

  update(values: unknown) {
    this.operation = 'update';
    this.values = values;
    return this;
  }

  upsert(values: unknown) {
    this.operation = 'upsert';
    this.values = values;
    return this;
  }

  delete() {
    this.operation = 'delete';
    return this;
  }

  eq(field: string, value: unknown) {
    this.filters.push({ field, operator: 'eq', value });
    return this;
  }

  gte(field: string, value: unknown) {
    this.filters.push({ field, operator: 'gte', value });
    return this;
  }

  lte(field: string, value: unknown) {
    this.filters.push({ field, operator: 'lte', value });
    return this;
  }

  gt(field: string, value: unknown) {
    this.filters.push({ field, operator: 'gt', value });
    return this;
  }

  in(field: string, value: unknown[]) {
    this.filters.push({ field, operator: 'in', value });
    return this;
  }

  order(field: string, options?: { ascending?: boolean }) {
    this.orderBy = { field, ascending: options?.ascending !== false };
    return this;
  }

  limit(value: number) {
    this.take = value;
    return this;
  }

  single() {
    this.wantsSingle = true;
    return this;
  }

  private async execute(): Promise<QueryResponse> {
    try {
      const response = await fetch('/api/data', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'content-type': 'application/json',
          'x-tenant-slug': currentTenantSlug(),
        },
        body: JSON.stringify({
          table: this.table,
          operation: this.operation,
          filters: this.filters,
          select: this.columns,
          values: this.values,
          order: this.orderBy,
          limit: this.take,
          single: this.wantsSingle,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        return {
          data: null,
          error: { message: payload.error || 'Permintaan database gagal', code: payload.code },
        };
      }
      return { data: payload.data ?? null, error: payload.error ?? null };
    } catch (error) {
      return {
        data: null,
        error: { message: error instanceof Error ? error.message : 'Jaringan tidak tersedia' },
      };
    }
  }

  then<TResult1 = QueryResponse, TResult2 = never>(
    onfulfilled?: ((value: QueryResponse) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

type ChangeCallback = (payload: { eventType: string; new: any; old: any }) => void;

class ApiChannel {
  private handlers: Array<{ event: string; table: string; callback: ChangeCallback }> = [];
  private timer?: ReturnType<typeof setInterval>;
  private snapshots = new Map<string, Map<string, any>>();

  on(_type: string, config: { event: string; table: string; schema?: string }, callback: ChangeCallback) {
    this.handlers.push({ event: config.event, table: config.table, callback });
    return this;
  }

  subscribe() {
    void this.poll(true);
    this.timer = setInterval(() => void this.poll(false), 4000);
    return this;
  }

  unsubscribe() {
    if (this.timer) clearInterval(this.timer);
  }

  private async poll(initial: boolean) {
    const tables = [...new Set(this.handlers.map((handler) => handler.table))];
    for (const table of tables) {
      const result = await new ApiQueryBuilder(table).select('*').limit(500);
      if (result.error || !Array.isArray(result.data)) continue;

      const next = new Map(result.data.map((row: any) => [String(row.id), row]));
      const previous = this.snapshots.get(table) || new Map<string, any>();
      this.snapshots.set(table, next);
      if (initial) continue;

      for (const [id, row] of next) {
        const old = previous.get(id);
        if (!old) this.emit(table, 'INSERT', row, {});
        else if (JSON.stringify(old) !== JSON.stringify(row)) this.emit(table, 'UPDATE', row, old);
      }
      for (const [id, old] of previous) {
        if (!next.has(id)) this.emit(table, 'DELETE', {}, old);
      }
    }
  }

  private emit(table: string, eventType: string, next: any, old: any) {
    for (const handler of this.handlers) {
      if (handler.table === table && (handler.event === '*' || handler.event === eventType)) {
        handler.callback({ eventType, new: next, old });
      }
    }
  }
}

// Nama export dipertahankan sebagai facade kompatibilitas untuk UI lama.
// Semua operasi di bawah ini menuju Route Handler lokal /api/data dan Prisma/PostgreSQL.
export const supabase = {
  from(table: string) {
    return new ApiQueryBuilder(table);
  },
  channel(_name: string) {
    void _name;
    return new ApiChannel();
  },
  removeChannel(channel: ApiChannel) {
    channel.unsubscribe();
  },
};
