import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import feedback from '../cf-code/vm-chinese-translation-feedback/index.js'
import { SQLiteD1 } from './db.mjs'
import { createPostgresPool, PostgresD1 } from './postgres.mjs'
import { importDatabase } from '../scripts/migrate-postgres.mjs'

const schemaFile = new URL('../database/translation-feedback.sql', import.meta.url)
async function exercise(db, { parallel = false, rejectCount } = {}) {
  for (const id of ['public-item', 'rollback-item']) {
    await db.prepare(`INSERT INTO feedback_items
      (id,category,subtype,subtypes,canonical_key,display_name,normalized_name,status,created_at,updated_at)
      VALUES (?,'map','other','other',?,?,?,'candidate','2026-10-16','2026-10-16')`)
      .bind(id,id,id,id).run()
  }
  const vote = async (visitor, action, itemId = 'public-item', expectedStatus = 200) => {
    const response = await feedback.fetch(new Request('https://feedback.test/api/translation-feedback/votes', {
      method: 'POST', headers: { Origin: 'https://feedback.test', 'Content-Type': 'application/json', Cookie: `feedback_vid=${visitor}` },
      body: JSON.stringify({ itemId, action }),
    }), { FEEDBACK_DB: db, CORS_ORIGINS: 'https://feedback.test', ID_HASH_SECRET: 'isolated-test' })
    const body = await response.json()
    assert.equal(response.status, expectedStatus, JSON.stringify(body))
    return body.item
  }
  assert.equal((await vote('alice', 'like')).voteCount, 1)
  assert.equal((await vote('alice', 'like')).votedByCurrentVisitor, true)
  assert.equal((await vote('alice', 'unlike')).voteCount, 0)
  assert.equal((await vote('alice', 'unlike')).voteCount, 0)
  assert.equal((await vote('bob', 'unlike')).voteCount, 0)
  assert.equal((await vote('bob', 'like')).voteCount, 1)
  // Repeating a request heals the partial-write counts left by the old handler.
  await db.prepare('UPDATE feedback_items SET vote_count = 99 WHERE id = ?').bind('public-item').run()
  assert.equal((await vote('bob', 'like')).voteCount, 1)
  await vote('alice', 'invalid', 'public-item', 400)
  await vote('alice', 'like', 'missing-item', 400)
  if (parallel) {
    await Promise.all(Array.from({ length: 12 }, (_, n) => vote(`parallel-${n}`, 'like')))
    await Promise.all(Array.from({ length: 8 }, () => vote('alice', 'like')))
    assert.equal((await vote('alice', 'like')).voteCount, 14)
    await Promise.all(Array.from({ length: 8 }, () => vote('alice', 'unlike')))
    assert.equal((await vote('alice', 'unlike')).voteCount, 13)
  }
  await rejectCount()
  await vote('alice', 'like', 'rollback-item', 400)
  assert.equal(await db.prepare('SELECT * FROM feedback_votes WHERE item_id = ?').bind('rollback-item').first(), null)
  assert.equal((await db.prepare('SELECT vote_count FROM feedback_items WHERE id = ?').bind('rollback-item').first()).vote_count, 0)
}

test('SQLite feedback votes are idempotent and roll back together with the counter', async () => {
  const db = new SQLiteD1(':memory:', schemaFile)
  try {
    await exercise(db, { rejectCount: async () => db.database.exec(`CREATE TRIGGER reject_counter
      BEFORE UPDATE OF vote_count ON feedback_items WHEN NEW.id = 'rollback-item' AND NEW.vote_count > 0
      BEGIN SELECT RAISE(ABORT, 'simulated counter failure'); END;`) })
  } finally { db.close() }
})

test('PostgreSQL feedback votes support concurrent visitors, retries and atomic failure', { skip: !process.env.VMCT_DATABASE_URL }, async () => {
  const pool = createPostgresPool(process.env.VMCT_DATABASE_URL)
  const schema = 'feedback_votes_test_' + process.pid + '_' + Date.now()
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'feedback-votes-'))
  const file = path.join(dir, 'feedback.sqlite')
  const source = new SQLiteD1(file, schemaFile); source.close()
  try {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await importDatabase(client, file, schema)
      await client.query('COMMIT')
    } catch (error) { await client.query('ROLLBACK'); throw error }
    finally { client.release() }
    const db = new PostgresD1(pool, schema)
    await exercise(db, { parallel: true, rejectCount: () => db.prepare(
      `ALTER TABLE feedback_items ADD CONSTRAINT reject_counter CHECK (id != 'rollback-item' OR vote_count = 0)`,
    ).run() })
  } finally {
    await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`)
    await pool.end()
    fs.rmSync(dir, { recursive: true, force: true })
  }
})
