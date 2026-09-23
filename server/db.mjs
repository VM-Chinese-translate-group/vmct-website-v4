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
      for (const statement of statements) results.push(await statement.run())
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
    return { results: this.database.prepare(this.sql).all(...this.params) }
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
        const response = entries.get(keyFor(request))
        return response ? response.clone() : undefined
      },
      async put(request, response) {
        entries.set(keyFor(request), response.clone())
      },
      async delete(request) {
        return entries.delete(keyFor(request))
      },
    },
  }
}
