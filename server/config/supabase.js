const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  '';

const isConfigured = Boolean(
  supabaseUrl &&
  supabaseKey &&
  supabaseUrl.startsWith('http') &&
  !supabaseUrl.includes('your-project-id') &&
  !supabaseKey.includes('your-supabase-key')
);

let supabase = null;
let liveIsReachable = false;

if (isConfigured) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
  } catch (err) {
    console.warn('[Supabase] Failed to initialize live client:', err.message);
  }
}

/**
 * In-memory fallback mock for offline local development and automated testing
 * when live Supabase credentials have not been configured yet or network is unavailable.
 */
class InMemoryDatabase {
  constructor() {
    this.tables = {
      users: new Map(),
      tasks: new Map()
    };
  }

  from(tableName) {
    if (!this.tables[tableName]) {
      this.tables[tableName] = new Map();
    }
    return new MockQueryBuilder(this.tables[tableName], tableName);
  }
}

class MockQueryBuilder {
  constructor(table, tableName) {
    this.table = table;
    this.tableName = tableName;
    this.conditions = [];
    this.selectFields = '*';
    this.countMode = null;
    this.isHeadOnly = false;
    this.orderConfig = null;
    this.rangeLimit = null;
    this.limitVal = null;
    this.pendingAction = null;
    this.isSingle = false;
    this.isMaybeSingle = false;
  }

  select(fields = '*', options = {}) {
    this.selectFields = fields;
    if (options.count) {
      this.countMode = options.count;
    }
    if (options.head) {
      this.isHeadOnly = options.head;
    }
    return this;
  }

  insert(records) {
    this.pendingAction = {
      type: 'insert',
      payload: Array.isArray(records) ? records : [records]
    };
    return this;
  }

  update(updates) {
    this.pendingAction = {
      type: 'update',
      payload: updates
    };
    return this;
  }

  delete() {
    this.pendingAction = {
      type: 'delete'
    };
    return this;
  }

  eq(column, value) {
    this.conditions.push((row) => row[column] === value);
    return this;
  }

  neq(column, value) {
    this.conditions.push((row) => row[column] !== value);
    return this;
  }

  in(column, values) {
    const set = new Set(values);
    this.conditions.push((row) => set.has(row[column]));
    return this;
  }

  lt(column, value) {
    this.conditions.push((row) => {
      const val = row[column];
      if (val === null || val === undefined) return false;
      return new Date(val).getTime() < new Date(value).getTime();
    });
    return this;
  }

  lte(column, value) {
    this.conditions.push((row) => {
      const val = row[column];
      if (val === null || val === undefined) return false;
      return new Date(val).getTime() <= new Date(value).getTime();
    });
    return this;
  }

  gte(column, value) {
    this.conditions.push((row) => {
      const val = row[column];
      if (val === null || val === undefined) return false;
      return new Date(val).getTime() >= new Date(value).getTime();
    });
    return this;
  }

  or(filterStr) {
    const parts = filterStr.split(',').map((p) => p.trim());
    this.conditions.push((row) => {
      return parts.some((part) => {
        const [col, op, pattern] = part.split('.');
        const cleanPattern = (pattern || '').replace(/%/g, '').toLowerCase();
        const rowVal = row[col];
        if (rowVal === null || rowVal === undefined) return false;
        if (Array.isArray(rowVal)) {
          return rowVal.some((item) => String(item).toLowerCase().includes(cleanPattern));
        }
        return String(rowVal).toLowerCase().includes(cleanPattern);
      });
    });
    return this;
  }

  contains(column, arrayVal) {
    this.conditions.push((row) => {
      const rowArr = row[column];
      if (!Array.isArray(rowArr)) return false;
      return arrayVal.every((val) => rowArr.includes(val));
    });
    return this;
  }

  order(column, { ascending = true } = {}) {
    this.orderConfig = { column, ascending };
    return this;
  }

  range(from, to) {
    this.rangeLimit = { from, to };
    return this;
  }

  limit(count) {
    this.limitVal = count;
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  maybeSingle() {
    this.isMaybeSingle = true;
    return this;
  }

  async execute() {
    if (this.pendingAction && this.pendingAction.type === 'insert') {
      const inserted = [];
      for (const record of this.pendingAction.payload) {
        if (this.tableName === 'users' && record.email) {
          for (const existing of this.table.values()) {
            if (existing.email && existing.email.toLowerCase() === record.email.toLowerCase()) {
              const err = new Error('duplicate key value violates unique constraint "users_email_key"');
              err.code = '23505';
              return { data: null, error: err };
            }
          }
        }

        const id = record.id || crypto.randomUUID();
        const now = new Date().toISOString();
        const newRow = {
          id,
          created_at: record.created_at || now,
          updated_at: record.updated_at || now,
          ...record
        };
        this.table.set(id, newRow);
        inserted.push(newRow);
      }

      const result = this.isSingle || this.isMaybeSingle ? inserted[0] : (inserted.length === 1 ? inserted[0] : inserted);
      return { data: result, error: null };
    }

    let rows = Array.from(this.table.values());
    for (const condition of this.conditions) {
      rows = rows.filter(condition);
    }

    if (this.pendingAction && this.pendingAction.type === 'update') {
      const updatedRows = [];
      const now = new Date().toISOString();
      for (const row of rows) {
        const updated = {
          ...row,
          ...this.pendingAction.payload,
          updated_at: now
        };
        this.table.set(row.id, updated);
        updatedRows.push(updated);
      }
      const result = this.isSingle || this.isMaybeSingle ? (updatedRows[0] || null) : updatedRows;
      return { data: result, error: null };
    }

    if (this.pendingAction && this.pendingAction.type === 'delete') {
      for (const row of rows) {
        this.table.delete(row.id);
      }
      const result = this.isSingle || this.isMaybeSingle ? (rows[0] || null) : rows;
      return { data: result, error: null };
    }

    const totalCount = rows.length;

    if (this.orderConfig) {
      const { column, ascending } = this.orderConfig;
      rows.sort((a, b) => {
        let valA = a[column];
        let valB = b[column];

        if (valA === null || valA === undefined) return 1;
        if (valB === null || valB === undefined) return -1;

        if (column === 'created_at' || column === 'due_date' || column === 'updated_at') {
          valA = new Date(valA).getTime();
          valB = new Date(valB).getTime();
        }

        if (valA < valB) return ascending ? -1 : 1;
        if (valA > valB) return ascending ? 1 : -1;
        return 0;
      });
    }

    if (this.rangeLimit) {
      rows = rows.slice(this.rangeLimit.from, this.rangeLimit.to + 1);
    } else if (this.limitVal) {
      rows = rows.slice(0, this.limitVal);
    }

    if (this.isHeadOnly) {
      return { data: null, count: totalCount, error: null };
    }

    if (this.isSingle) {
      if (rows.length === 0) {
        return { data: null, error: { message: 'Row not found', code: 'PGRST116' } };
      }
      return { data: rows[0], error: null };
    }

    if (this.isMaybeSingle) {
      return { data: rows.length > 0 ? rows[0] : null, error: null };
    }

    return {
      data: rows,
      count: this.countMode ? totalCount : null,
      error: null
    };
  }

  then(resolve, reject) {
    return this.execute().then(resolve, reject);
  }
}

const fallbackDb = new InMemoryDatabase();

/**
 * Returns the active Supabase client (live or fallback if unreachable/not configured)
 */
const getSupabaseClient = () => {
  if (isConfigured && supabase && liveIsReachable) {
    return supabase;
  }
  return fallbackDb;
};

/**
 * Test or verify database connection
 */
const connectDB = async () => {
  if (isConfigured && supabase) {
    console.log(`[Supabase] Connecting to PostgreSQL at ${supabaseUrl}...`);
    try {
      // Probe with a 3-second timeout so slow DNS/network never blocks server startup
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Connection probe timed out after 3s')), 3000)
      );
      const probePromise = supabase.from('users').select('id').limit(1);

      const { error } = await Promise.race([probePromise, timeoutPromise]);
      if (error && error.code !== 'PGRST116' && error.code !== '42P01') {
        console.warn(`[Supabase] Warning from probe: ${error.message}`);
      }
      liveIsReachable = true;
      console.log(`[Supabase] ✅ Live Supabase PostgreSQL connected successfully.`);
    } catch (err) {
      liveIsReachable = false;
      console.warn(`[Supabase] ⚠️  Could not reach ${supabaseUrl}: ${err.message}`);
      console.log(`[Supabase] Falling back to in-memory storage until Supabase project is reachable.`);
    }
  } else {
    console.log('[Supabase] Running with local in-memory storage. Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY to use live PostgreSQL.');
  }
};

const closeDB = async () => {
  return Promise.resolve();
};

module.exports = {
  supabase: getSupabaseClient(),
  getSupabaseClient,
  connectDB,
  closeDB,
  isConfigured
};
