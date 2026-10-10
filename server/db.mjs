import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'

export class SQLiteD1 {
  constructor(file, schemaFile) {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    this.database = new DatabaseSync(file)
    this.database.exec('PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL;')
    if (schemaFile && fs.existsSync(schemaFile)) this.database.exec(fs.readFileSync(schemaFile, 'utf8'))
  }

  prepare(sql) {
    return new SQLiteStatement(this.database, sql)
  }

  async batch(statements) {
    this.database.exec('BEGIN')
    try {
      const results = []
      for (const statement of statements) results.push(await statement.execute())
      this.database.exec('COMMIT')
      return results
    } catch (error) {
      try { this.database.exec('ROLLBACK') } catch {}
      throw error
    }
  }

  close() {
    this.database.close()
  }
}

class SQLiteStatement {
  constructor(database, sql) {
    this.database = database
    this.sql = sql
    this.params = []
  }

  bind(...params) {
    this.params = params
    return this
  }

  async first() {
    return this.database.prepare(this.sql).get(...this.params) ?? null
  }

  async all() {
    return { success: true, results: this.database.prepare(this.sql).all(...this.params) }
  }

  async execute() {
    // SQLite's run() discards rows. Inspect the prepared statement so SELECT,
    // WITH and RETURNING queries retain their results in a D1 batch.
    return this.database.prepare(this.sql).columns().length > 0 ? this.all() : this.run()
  }

  async run() {
    const result = this.database.prepare(this.sql).run(...this.params)
    return {
      success: true,
      meta: {
        changes: Number(result.changes ?? 0),
        last_row_id: Number(result.lastInsertRowid ?? 0),
      },
    }
  }
}

export function createCacheStorage() {
  const entries = new Map()
  const keyFor = (request) => `${request.method || 'GET'} ${new URL(request.url).toString()}`
  return {
    default: {
      async match(request) {
        const key = keyFor(request)
        const entry = entries.get(key)
        if (!entry) return undefined
        if (entry.expiresAt <= Date.now()) {
          entries.delete(key)
          return undefined
        }
        return entry.response.clone()
      },
      async put(request, response, options = {}) {
        const cacheControl = response.headers.get('Cache-Control') || ''
        const maxAge = cacheControl.match(/(?:^|,)\s*s-maxage\s*=\s*(\d+)/i)
          || cacheControl.match(/(?:^|,)\s*max-age\s*=\s*(\d+)/i)
        const ttl = Number(options.expirationTtl ?? maxAge?.[1] ?? 0)
        const now = Date.now()
        for (const [key, entry] of entries) {
          if (entry.expiresAt <= now) entries.delete(key)
        }
        const key = keyFor(request)
        if (/(?:^|,)\s*(?:no-store|private)\b/i.test(cacheControl) || !Number.isFinite(ttl) || ttl <= 0) {
          entries.delete(key)
          return
        }
        entries.set(key, { response: response.clone(), expiresAt: now + ttl * 1000 })
      },
      async delete(request) {
        return entries.delete(keyFor(request))
      },
    },
  }
}
