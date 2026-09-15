import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/pg';

// Tables accessible via API
const ALLOWED_TABLES = new Set([
  'categories',
  'products',
  'customers',
  'suppliers',
  'transactions',
  'transaction_items',
  'users',
  'settings',
  'tables',
  'customer_orders',
  'customer_order_items',
  'tenants',
]);

// Tables with compound primary key ("tenantId", id)
const TENANT_TABLES = new Set([
  'categories',
  'products',
  'customers',
  'suppliers',
  'transactions',
  'transaction_items',
  'tables',
  'customer_orders',
  'customer_order_items',
  'settings',
]);

const DEFAULT_TENANT_ID = 'tenant_restoflow';

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ table: string }> }
) {
  const { table } = await context.params;

  if (!ALLOWED_TABLES.has(table)) {
    return NextResponse.json(
      { data: null, error: { message: `Table "${table}" is not accessible.` } },
      { status: 400 }
    );
  }

  try {
    const searchParams = req.nextUrl.searchParams;
    const whereClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    let orderColumn: string | null = null;
    let orderAsc = true;
    let limit: number | null = null;
    let isSingle = false;

    // Filter by tenantId if table belongs to a tenant and not explicitly overridden
    let hasTenantFilter = false;

    for (const [key, value] of searchParams.entries()) {
      if (key === '_order') {
        orderColumn = value;
      } else if (key === '_asc') {
        orderAsc = value !== 'false';
      } else if (key === '_limit') {
        limit = parseInt(value, 10);
      } else if (key === '_single') {
        isSingle = value === 'true';
      } else if (key.startsWith('_gt_')) {
        const col = key.replace('_gt_', '');
        whereClauses.push(`${quoteIdent(col)} > $${paramIndex++}`);
        values.push(value);
      } else if (key.startsWith('_gte_')) {
        const col = key.replace('_gte_', '');
        whereClauses.push(`${quoteIdent(col)} >= $${paramIndex++}`);
        values.push(value);
      } else if (key.startsWith('_lt_')) {
        const col = key.replace('_lt_', '');
        whereClauses.push(`${quoteIdent(col)} < $${paramIndex++}`);
        values.push(value);
      } else if (key.startsWith('_lte_')) {
        const col = key.replace('_lte_', '');
        whereClauses.push(`${quoteIdent(col)} <= $${paramIndex++}`);
        values.push(value);
      } else if (key.startsWith('_neq_')) {
        const col = key.replace('_neq_', '');
        whereClauses.push(`${quoteIdent(col)} != $${paramIndex++}`);
        values.push(value);
      } else if (key.startsWith('_in_')) {
        const col = key.replace('_in_', '');
        const inVals = value.split(',').map(v => v.trim());
        if (inVals.length > 0) {
          const placeholders = inVals.map(() => `$${paramIndex++}`).join(', ');
          whereClauses.push(`${quoteIdent(col)} IN (${placeholders})`);
          values.push(...inVals);
        }
      } else if (key === 'select') {
        // Handled in projection
      } else {
        if (key === 'tenantId') hasTenantFilter = true;

        // Standard equality filter
        let parsedVal: any = value;
        if (value === 'true') parsedVal = true;
        else if (value === 'false') parsedVal = false;
        else if (value === 'null') parsedVal = null;

        if (parsedVal === null) {
          whereClauses.push(`${quoteIdent(key)} IS NULL`);
        } else {
          whereClauses.push(`${quoteIdent(key)} = $${paramIndex++}`);
          values.push(parsedVal);
        }
      }
    }

    // If tenant table and tenantId filter was not supplied, filter by default tenant
    if (TENANT_TABLES.has(table) && !hasTenantFilter) {
      whereClauses.push(`${quoteIdent('tenantId')} = $${paramIndex++}`);
      values.push(DEFAULT_TENANT_ID);
    }

    let sql = `SELECT * FROM ${quoteIdent(table)}`;
    if (whereClauses.length > 0) {
      sql += ` WHERE ${whereClauses.join(' AND ')}`;
    }
    if (orderColumn) {
      sql += ` ORDER BY ${quoteIdent(orderColumn)} ${orderAsc ? 'ASC' : 'DESC'}`;
    }
    if (isSingle) {
      sql += ` LIMIT 1`;
    } else if (limit && limit > 0) {
      sql += ` LIMIT ${limit}`;
    }

    const res = await query(sql, values);
    const data = isSingle ? (res.rows[0] || null) : res.rows;

    return NextResponse.json({ data, error: null });
  } catch (err: any) {
    console.error(`[GET /api/db/${table}] Error:`, err);
    return NextResponse.json(
      { data: null, error: { message: err?.message || 'Database query error' } },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ table: string }> }
) {
  const { table } = await context.params;

  if (!ALLOWED_TABLES.has(table)) {
    return NextResponse.json(
      { data: null, error: { message: `Table "${table}" is not accessible.` } },
      { status: 400 }
    );
  }

  try {
    const body = await req.json();
    const { action, data, filters } = body;

    if (action === 'insert') {
      const items = Array.isArray(data) ? data : [data];
      if (items.length === 0) {
        return NextResponse.json({ data: [], error: null });
      }

      const insertedRows: any[] = [];
      for (const item of items) {
        // Automatically inject tenantId if missing on tenant-scoped table
        if (TENANT_TABLES.has(table) && !item.tenantId) {
          item.tenantId = DEFAULT_TENANT_ID;
        }

        const columns = Object.keys(item);
        if (columns.length === 0) continue;

        const colNames = columns.map(quoteIdent).join(', ');
        const placeholders = columns.map((_, idx) => `$${idx + 1}`).join(', ');
        const values = columns.map(c => {
          const val = item[c];
          if (typeof val === 'object' && val !== null && !(val instanceof Date)) {
            return JSON.stringify(val);
          }
          return val;
        });

        const sql = `INSERT INTO ${quoteIdent(table)} (${colNames}) VALUES (${placeholders}) RETURNING *`;
        const res = await query(sql, values);
        if (res.rows[0]) insertedRows.push(res.rows[0]);
      }

      const result = Array.isArray(data) ? insertedRows : (insertedRows[0] || null);
      return NextResponse.json({ data: result, error: null });
    }

    if (action === 'update') {
      const columns = Object.keys(data || {});
      if (columns.length === 0) {
        return NextResponse.json({ data: null, error: { message: 'No columns provided for update' } }, { status: 400 });
      }

      const setClauses: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      for (const col of columns) {
        setClauses.push(`${quoteIdent(col)} = $${paramIndex++}`);
        const val = data[col];
        if (typeof val === 'object' && val !== null && !(val instanceof Date)) {
          values.push(JSON.stringify(val));
        } else {
          values.push(val);
        }
      }

      const whereClauses: string[] = [];
      for (const [col, val] of Object.entries(filters || {})) {
        whereClauses.push(`${quoteIdent(col)} = $${paramIndex++}`);
        values.push(val);
      }

      // If tenant table and no tenant filter was provided in where, add default tenant
      if (TENANT_TABLES.has(table) && (!filters || !filters.tenantId)) {
        whereClauses.push(`${quoteIdent('tenantId')} = $${paramIndex++}`);
        values.push(DEFAULT_TENANT_ID);
      }

      let sql = `UPDATE ${quoteIdent(table)} SET ${setClauses.join(', ')}`;
      if (whereClauses.length > 0) {
        sql += ` WHERE ${whereClauses.join(' AND ')}`;
      }
      sql += ` RETURNING *`;

      const res = await query(sql, values);
      return NextResponse.json({ data: res.rows, error: null });
    }

    if (action === 'delete') {
      const whereClauses: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      for (const [col, val] of Object.entries(filters || {})) {
        whereClauses.push(`${quoteIdent(col)} = $${paramIndex++}`);
        values.push(val);
      }

      if (TENANT_TABLES.has(table) && (!filters || !filters.tenantId)) {
        whereClauses.push(`${quoteIdent('tenantId')} = $${paramIndex++}`);
        values.push(DEFAULT_TENANT_ID);
      }

      let sql = `DELETE FROM ${quoteIdent(table)}`;
      if (whereClauses.length > 0) {
        sql += ` WHERE ${whereClauses.join(' AND ')}`;
      }
      sql += ` RETURNING *`;

      const res = await query(sql, values);
      return NextResponse.json({ data: res.rows, error: null });
    }

    if (action === 'upsert') {
      const item = { ...data };
      if (TENANT_TABLES.has(table) && !item.tenantId) {
        item.tenantId = DEFAULT_TENANT_ID;
      }

      const columns = Object.keys(item);
      if (columns.length === 0) {
        return NextResponse.json({ data: null, error: { message: 'No columns for upsert' } }, { status: 400 });
      }

      const colNames = columns.map(quoteIdent).join(', ');
      const placeholders = columns.map((_, idx) => `$${idx + 1}`).join(', ');
      const values = columns.map(c => {
        const val = item[c];
        if (typeof val === 'object' && val !== null && !(val instanceof Date)) {
          return JSON.stringify(val);
        }
        return val;
      });

      const conflictTarget = TENANT_TABLES.has(table) 
        ? `(${quoteIdent('tenantId')}, ${quoteIdent('id')})`
        : `(${quoteIdent('id')})`;

      const updateClauses = columns
        .filter(c => c !== 'id' && c !== 'tenantId')
        .map(c => `${quoteIdent(c)} = EXCLUDED.${quoteIdent(c)}`)
        .join(', ');

      const sql = `
        INSERT INTO ${quoteIdent(table)} (${colNames}) 
        VALUES (${placeholders})
        ON CONFLICT ${conflictTarget} DO UPDATE SET ${updateClauses}
        RETURNING *
      `;

      const res = await query(sql, values);
      return NextResponse.json({ data: res.rows[0] || null, error: null });
    }

    return NextResponse.json(
      { data: null, error: { message: `Unknown action: ${action}` } },
      { status: 400 }
    );
  } catch (err: any) {
    console.error(`[POST /api/db/${table}] Error:`, err);
    return NextResponse.json(
      { data: null, error: { message: err?.message || 'Database mutation error' } },
      { status: 500 }
    );
  }
}
