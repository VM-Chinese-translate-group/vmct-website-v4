import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DEFAULT_HOOK = 'http://127.0.0.1:8787/internal/rebuild'
const UPSERT_HOOK = "INSERT INTO cms_settings (setting_key, setting_value, updated_at) VALUES ('deployment_hook_url', ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value, updated_at = excluded.updated_at"

class SettingsInputError extends Error {
  constructor(message, exitCode = 2) { super(message); this.exitCode = exitCode }
}

export function configuredDatabaseBackend(env = process.env) {
  const backend = env.VMCT_DATABASE_BACKEND || 'sqlite'
  if (!['sqlite', 'postgres'].includes(backend))
    throw new SettingsInputError('VMCT_DATABASE_BACKEND 必须为 sqlite 或 postgres')
  return backend
}

// postgresSchema is an internal test seam. The CLI always updates the same
// content schema used by the ECS API; it never takes a schema from the shell.
export async function ensureEcsSettings({ databasePath, rebuildHook = DEFAULT_HOOK,
  env = process.env, postgresSchema = 'content' } = {}) {
  const backend = configuredDatabaseBackend(env)
  if (!/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?(?:\/|$)/.test(rebuildHook))
    throw new SettingsInputError('ECS 重建地址必须是本机 HTTP 地址')

  if (backend === 'postgres') {
    if (!env.VMCT_DATABASE_URL)
      throw new SettingsInputError('PostgreSQL 模式需要 VMCT_DATABASE_URL', 1)
    if (typeof postgresSchema !== 'string' || !/^[a-z][a-z0-9_]*$/.test(postgresSchema))
      throw new SettingsInputError('PostgreSQL schema 无效')
    const { createPostgresPool, PostgresD1 } = await import('../server/postgres.mjs')
    const pool = createPostgresPool(env.VMCT_DATABASE_URL)
    try {
      const database = new PostgresD1(pool, postgresSchema)
      const sql = UPSERT_HOOK.replace('INTO cms_settings', `INTO "${postgresSchema}".cms_settings`)
      await database.prepare(sql).bind(rebuildHook).run()
    } finally {
      await pool.end()
    }
    // Never open the legacy SQLite database or fall back to it on a PG error.
    return backend
  }

  if (!databasePath)
    throw new SettingsInputError('用法：node --experimental-sqlite scripts/ensure-ecs-settings.mjs <content.sqlite> [hook]')
  if (!fs.existsSync(databasePath))
    throw new SettingsInputError(`找不到内容数据库：${databasePath}`, 1)
  const { DatabaseSync } = await import('node:sqlite')
  const database = new DatabaseSync(databasePath)
  try {
    database.exec('PRAGMA busy_timeout = 5000')
    database.exec('BEGIN IMMEDIATE')
    database.prepare(UPSERT_HOOK).run(rebuildHook)
    database.exec('COMMIT')
  } catch (error) {
    try { database.exec('ROLLBACK') } catch { /* Preserve the database error. */ }
    throw error
  } finally {
    database.close()
  }
  return backend
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv[2] === '--print-backend') {
      // The deployer needs only this non-secret enum, never the database URL.
      console.log(configuredDatabaseBackend())
    } else {
      await ensureEcsSettings({ databasePath: process.argv[2], rebuildHook: process.argv[3] || DEFAULT_HOOK })
      console.log('已更新 deployment_hook_url 为 ECS 本机重建地址')
    }
  } catch (error) {
    // A database driver's error may contain connection details. Keep them out
    // of deployment logs; credentials are loaded from the private env file.
    console.error(error instanceof SettingsInputError ? error.message : '更新 ECS 重建设置失败，请检查数据库配置与权限')
    process.exitCode = error instanceof SettingsInputError ? error.exitCode : 1
  }
}
