import pg from 'pg'

const ISO_NOW = `to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`

// Only the ECS adapter translates the small D1 SQL dialect. Cloudflare keeps
// its own databases and SQL unchanged. Placeholders inside quoted text/comments
// must never be interpreted as bind parameters.
export function postgresSql(sql) {
  const pragma = sql.match(/^\s*PRAGMA table_info\((\w+)\)\s*;?\s*$/i)
  if (pragma) return `SELECT column_name AS name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = '${pragma[1].toLowerCase()}'`
  const ignore = /^\s*INSERT OR IGNORE\b/i.test(sql)
  sql = sql.replace(/INSERT OR IGNORE\b/i, 'INSERT')
    .replace(/strftime\('%Y-%m-%dT%H:%M:%fZ',\s*'now'\)/g, ISO_NOW)
    .replace(/\bIS NOT\s+(?!NULL\b)/gi, 'IS DISTINCT FROM ')
  if (ignore) sql = sql.replace(/;?\s*$/, ' ON CONFLICT DO NOTHING')
  let result = '', position = 0, mode = ''
  for (let i = 0; i < sql.length; i++) {
    const char = sql[i], next = sql[i + 1]
    if (mode === 'line') { result += char; if (char === '\n') mode = ''; continue }
    if (mode === 'block') { result += char; if (char === '*' && next === '/') { result += next; i++; mode = '' }; continue }
    if (mode) {
      result += char
      if (char === mode) { if (next === mode) { result += next; i++ } else mode = '' }
      continue
    }
    // SQLite preserves unquoted result aliases; PostgreSQL folds them to lower
    // case. Keep the D1 response keys used by CMS pages and login challenges.
    if (i === 0 || !/[\w$]/.test(sql[i - 1])) {
      const alias = sql.slice(i).match(/^AS\s+([a-zA-Z_]\w*)\b/i)
      if (alias && /[a-z]/.test(alias[1]) && /[A-Z]/.test(alias[1])) {
        result += alias[0].slice(0, -alias[1].length) + `"${alias[1]}"`
        i += alias[0].length - 1
        continue
      }
    }
    if (char === '-' && next === '-') mode = 'line'
    else if (char === '/' && next === '*') mode = 'block'
    else if (char === "'" || char === '"') mode = char
    result += char === '?' && !mode ? `$${++position}` : char
  }
  return result
}

function normalize(rows) {
  // D1 returns numeric counts, while pg deliberately returns bigint as text.
  return rows.map(row => Object.fromEntries(Object.entries(row).map(([key, value]) =>
    [key, ['total', 'frequency'].includes(key) && typeof value === 'string' ? Number(value) : value])))
}

export class PostgresD1 {
  constructor(pool, schema) {
    if (!/^[a-z][a-z0-9_]*$/.test(schema)) throw new Error('Invalid database schema')
    this.pool = pool
    this.schema = schema
  }
  prepare(sql) { return new PostgresStatement(this, sql) }
  async withClient(work) {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(`SET LOCAL search_path TO "${this.schema}", public`)
      const result = await work(client)
      await client.query('COMMIT')
      return result
    } catch (error) { await client.query('ROLLBACK'); throw error }
    finally { client.release() }
  }
  async batch(statements) {
    return this.withClient(async client => {
      const results = []
      for (const statement of statements) {
        if (statement.db !== this) throw new Error('Batch statements belong to different databases')
        results.push(await statement.execute(client))
      }
      return results
    })
  }
  async close() { /* Shared pool is closed by the server. */ }
}

class PostgresStatement {
  constructor(db, sql) { this.db = db; this.sql = postgresSql(sql); this.params = [] }
  bind(...params) { this.params = params; return this }
  async execute(client) {
    if (!client) return this.db.withClient(c => this.execute(c))
    const result = await client.query(this.sql, this.params)
    return { success: true, results: normalize(result.rows), meta: { changes: result.rowCount ?? 0 } }
  }
  async all() { return this.execute() }
  async first() { return (await this.execute()).results[0] ?? null }
  async run() { return this.execute() }
}

export function createPostgresPool(connectionString) {
  if (!connectionString) throw new Error('VMCT_DATABASE_URL is required for PostgreSQL')
  const pool = new pg.Pool({ connectionString, max: 6, connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000, statement_timeout: 30000, application_name: 'vmct-website' })
  pool.on('error', () => console.error('PostgreSQL connection failed'))
  return pool
}
