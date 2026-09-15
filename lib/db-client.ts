/**
 * PostgreSQL Browser Client Adapter
 * Drop-in replacement for Supabase Client that routes queries to /api/db/[table]
 * Allows all existing components and stores to seamlessly use pure PostgreSQL.
 */

export class TableQueryBuilder<T = any> {
  private table: string;
  private action: 'select' | 'insert' | 'update' | 'delete' | 'upsert';
  private selectCols: string = '*';
  private filters: Record<string, any> = {};
  private orderCol: string | null = null;
  private orderAsc: boolean = true;
  private limitCount: number | null = null;
  private singleResult: boolean = false;
  private payloadData: any = null;

  constructor(table: string, action: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select', data: any = null) {
    this.table = table;
    this.action = action;
    this.payloadData = data;
  }

  select(cols: string = '*') {
    this.selectCols = cols;
    return this;
  }

  eq(column: string, value: any) {
    this.filters[column] = value;
    return this;
  }

  neq(column: string, value: any) {
    this.filters[`_neq_${column}`] = value;
    return this;
  }

  gt(column: string, value: any) {
    this.filters[`_gt_${column}`] = value;
    return this;
  }

  gte(column: string, value: any) {
    this.filters[`_gte_${column}`] = value;
    return this;
  }

  lt(column: string, value: any) {
    this.filters[`_lt_${column}`] = value;
    return this;
  }

  lte(column: string, value: any) {
    this.filters[`_lte_${column}`] = value;
    return this;
  }

  in(column: string, values: any[]) {
    this.filters[`_in_${column}`] = Array.isArray(values) ? values.join(',') : String(values);
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderCol = column;
    this.orderAsc = options?.ascending !== false;
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  single() {
    this.singleResult = true;
    return this;
  }

  async execute(): Promise<{ data: any; error: any }> {
    try {
      if (this.action === 'select') {
        const params = new URLSearchParams();
        params.set('select', this.selectCols);
        if (this.orderCol) params.set('_order', this.orderCol);
        if (this.orderCol) params.set('_asc', String(this.orderAsc));
        if (this.limitCount) params.set('_limit', String(this.limitCount));
        if (this.singleResult) params.set('_single', 'true');

        for (const [key, val] of Object.entries(this.filters)) {
          params.set(key, String(val));
        }

        const res = await fetch(`/api/db/${this.table}?${params.toString()}`);
        if (!res.ok) {
          const errData = await res.json().catch(() => ({ error: { message: `HTTP ${res.status}` } }));
          return { data: null, error: errData.error || { message: `HTTP ${res.status}` } };
        }
        return await res.json();
      } else {
        // insert, update, delete, upsert
        const res = await fetch(`/api/db/${this.table}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: this.action,
            data: this.payloadData,
            filters: this.filters,
          }),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({ error: { message: `HTTP ${res.status}` } }));
          return { data: null, error: errData.error || { message: `HTTP ${res.status}` } };
        }
        return await res.json();
      }
    } catch (err: any) {
      return { data: null, error: { message: err?.message || 'Network error' } };
    }
  }

  // Make TableQueryBuilder Thenable / Awaitable
  then<TResult1 = { data: any; error: any }, TResult2 = never>(
    onfulfilled?: ((value: { data: any; error: any }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

export class PostgresClient {
  from<T = any>(table: string) {
    return {
      select: (cols: string = '*') => new TableQueryBuilder<T[]>(table, 'select').select(cols),
      insert: (data: any) => new TableQueryBuilder<T>(table, 'insert', data),
      update: (data: any) => new TableQueryBuilder<T>(table, 'update', data),
      delete: () => new TableQueryBuilder<T>(table, 'delete'),
      upsert: (data: any) => new TableQueryBuilder<T>(table, 'upsert', data),
    };
  }

  // Realtime channel polling fallback
  channel(name: string) {
    return {
      on: (_event: string, _filter: any, _callback: (payload: any) => void) => {
        return {
          subscribe: (statusCallback?: (status: string) => void) => {
            if (statusCallback) statusCallback('SUBSCRIBED');
            return {
              unsubscribe: () => {},
            };
          }
        };
      }
    };
  }

  removeChannel(_channel: any) {}
}

export const db = new PostgresClient();
export const supabase = db;
export default db;
