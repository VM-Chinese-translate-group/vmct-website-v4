import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { configuredDatabaseBackend, ensureEcsSettings } from './ensure-ecs-settings.mjs'

const hook = 'http://127.0.0.1:8787/internal/rebuild'
const schemaSql = `CREATE TABLE cms_settings (
  setting_key TEXT PRIMARY KEY, setting_value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT 'old'
)`
const digest = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'vmct-ecs-settings-'))
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
  const databasePath = path.join(directory, 'content.sqlite')
  const db = new DatabaseSync(databasePath)
  db.exec(schemaSql)
  db.prepare('INSERT INTO cms_settings(setting_key,setting_value) VALUES (?,?)').run('admin_password_hash', 'keep-existing')
  db.close()
  return { directory, databasePath }
}

test('legacy SQLite fallback upserts the local hook without changing other CMS settings', async t => {
  const { databasePath } = fixture(t)
  assert.equal(await ensureEcsSettings({ databasePath, env: {} }), 'sqlite')
  await ensureEcsSettings({ databasePath, rebuildHook: 'http://localhost:8787/internal/rebuild', env: {} })
  const db = new DatabaseSync(databasePath)
  try {
    assert.equal(db.prepare("SELECT setting_value FROM cms_settings WHERE setting_key='deployment_hook_url'").get().setting_value,
      'http://localhost:8787/internal/rebuild')
    assert.equal(db.prepare("SELECT setting_value FROM cms_settings WHERE setting_key='admin_password_hash'").get().setting_value,
      'keep-existing')
    assert.equal(db.prepare("SELECT COUNT(*) AS total FROM cms_settings WHERE setting_key='deployment_hook_url'").get().total, 1)
  } finally { db.close() }
})

test('invalid hooks, unknown backends and missing PG credentials never change the legacy SQLite file', async t => {
  const { databasePath } = fixture(t)
  const before = digest(databasePath)
  await assert.rejects(ensureEcsSettings({ databasePath, rebuildHook: 'https://old.pages.dev/hook', env: {} }), /本机 HTTP/)
  await assert.rejects(ensureEcsSettings({ databasePath, env: { VMCT_DATABASE_BACKEND: 'invalid' } }), /VMCT_DATABASE_BACKEND/)
  await assert.rejects(ensureEcsSettings({ databasePath, env: { VMCT_DATABASE_BACKEND: 'postgres' } }), /VMCT_DATABASE_URL/)
  assert.equal(digest(databasePath), before)
})

test('CLI loads a private env file without leaking its values or silently opening SQLite in PG mode', t => {
  const { databasePath, directory } = fixture(t)
  const envFile = path.join(directory, 'private.env')
  const secret = 'fixture-secret-must-not-be-logged'
  fs.writeFileSync(envFile, `VMCT_DATABASE_BACKEND=postgres\nSITE_REBUILD_SECRET=${secret}\n`, { mode: 0o600 })
  const before = digest(databasePath)
  const childEnv = { ...process.env }
  delete childEnv.VMCT_DATABASE_BACKEND
  delete childEnv.VMCT_DATABASE_URL
  const result = spawnSync(process.execPath, ['--env-file=' + envFile, '--experimental-sqlite',
    fileURLToPath(new URL('./ensure-ecs-settings.mjs', import.meta.url)), databasePath, hook],
  { env: childEnv, encoding: 'utf8' })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /VMCT_DATABASE_URL/)
  assert.ok(!(result.stdout + result.stderr).includes(secret))
  assert.equal(digest(databasePath), before)
})

test('backend detection emits only a validated enum and does not connect to PG or reveal private values', t => {
  const { directory } = fixture(t)
  const envFile = path.join(directory, 'private.env')
  const secret = 'fixture-secret-must-not-be-logged'
  fs.writeFileSync(envFile, `VMCT_DATABASE_BACKEND=postgres\nVMCT_DATABASE_URL=${secret}\nSITE_REBUILD_SECRET=${secret}\n`, { mode: 0o600 })
  const childEnv = { ...process.env }
  delete childEnv.VMCT_DATABASE_BACKEND
  delete childEnv.VMCT_DATABASE_URL
  const result = spawnSync(process.execPath, ['--env-file=' + envFile,
    fileURLToPath(new URL('./ensure-ecs-settings.mjs', import.meta.url)), '--print-backend'],
  { env: childEnv, encoding: 'utf8' })
  assert.equal(result.status, 0)
  assert.equal(result.stdout.trim(), 'postgres')
  assert.ok(!(result.stdout + result.stderr).includes(secret))
  assert.equal(configuredDatabaseBackend({}), 'sqlite')
  assert.throws(() => configuredDatabaseBackend({ VMCT_DATABASE_BACKEND: secret }), /VMCT_DATABASE_BACKEND/)
})

test('PostgreSQL updates only an isolated schema and leaves the legacy SQLite backup untouched',
  { skip: !process.env.VMCT_TEST_DATABASE_URL }, async t => {
    const { createPostgresPool } = await import('../server/postgres.mjs')
    const pool = createPostgresPool(process.env.VMCT_TEST_DATABASE_URL)
    const schema = 'ecs_settings_test_' + process.pid + '_' + Date.now()
    const { databasePath } = fixture(t)
    const before = digest(databasePath)
    let created = false
    try {
      await pool.query(`CREATE SCHEMA "${schema}"`)
      created = true
      await pool.query(`CREATE TABLE "${schema}".cms_settings (
        setting_key TEXT PRIMARY KEY, setting_value TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT 'old')`)
      await pool.query(`INSERT INTO "${schema}".cms_settings(setting_key,setting_value)
        VALUES ('deployment_hook_url','https://old.pages.dev/hook'), ('admin_password_hash','keep-existing')`)
      const env = { VMCT_DATABASE_BACKEND: 'postgres', VMCT_DATABASE_URL: process.env.VMCT_TEST_DATABASE_URL }
      assert.equal(await ensureEcsSettings({ databasePath, env, postgresSchema: schema }), 'postgres')
      const rows = (await pool.query(`SELECT * FROM "${schema}".cms_settings ORDER BY setting_key`)).rows
      assert.equal(rows.length, 2)
      assert.equal(rows[0].setting_value, 'keep-existing')
      assert.equal(rows[0].updated_at, 'old')
      assert.equal(rows[1].setting_value, hook)
      assert.match(rows[1].updated_at, /^\d{4}-\d{2}-\d{2}T.*Z$/)
      assert.equal(digest(databasePath), before)

      // A PostgreSQL failure must fail deployment rather than edit the backup.
      await pool.query(`DROP TABLE "${schema}".cms_settings`)
      await assert.rejects(ensureEcsSettings({ databasePath, env, postgresSchema: schema }))
      assert.equal(digest(databasePath), before)
      await assert.rejects(ensureEcsSettings({ databasePath, env, postgresSchema: schema + ';DROP' }), /schema/)
    } finally {
      try { if (created) await pool.query(`DROP SCHEMA "${schema}" CASCADE`) }
      finally { await pool.end() }
    }
  })
