import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { DatabaseSync } from 'node:sqlite'
import { createPostgresPool, PostgresD1, postgresSql } from './postgres.mjs'
import { PostgresDictionary, postgresSearchPlan } from './postgres-dictionary.mjs'
import { importDatabase } from '../scripts/migrate-postgres.mjs'

test('D1 SQL preserves literal question marks and null-safe comparisons', () => {
  assert.equal(postgresSql("SELECT '?' AS literal, ? AS value -- ?\n, ? AS another"), "SELECT '?' AS literal, $1 AS value -- ?\n, $2 AS another")
  assert.equal(postgresSql('SELECT ? IS NOT published_body, ? IS NOT NULL'), 'SELECT $1 IS DISTINCT FROM published_body, $2 IS NOT NULL')
  assert.throws(() => postgresSearchPlan('-door', 'origin_name'))
})

test('PostgreSQL migration, CMS writes, atomic batches, feedback and bilingual dictionary searches', { skip: !process.env.VMCT_DATABASE_URL }, async () => {
  const pool = createPostgresPool(process.env.VMCT_DATABASE_URL)
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'vmct-pg-test-'))
  const suffix = process.pid + '_' + Date.now()
  const contentSchema = 'content_test_' + suffix, dictionarySchema = 'dictionary_test_' + suffix
  try {
    const contentFile = path.join(temp, 'content.sqlite'), dictFile = path.join(temp, 'dict.sqlite')
    const content = new DatabaseSync(contentFile)
    content.exec(fs.readFileSync(new URL('../database/content-cms.sql', import.meta.url), 'utf8'))
    content.exec("INSERT INTO content_pages(id,path,draft_body) VALUES('a','/中文/','line1' || char(10) || 'line2');")
    content.close()
    const dictionary = new DatabaseSync(dictFile)
    dictionary.exec('CREATE TABLE dict (ID INTEGER PRIMARY KEY AUTOINCREMENT, ORIGIN_NAME TEXT NOT NULL, TRANS_NAME TEXT NOT NULL, MODID TEXT NOT NULL, KEY TEXT NOT NULL, VERSION TEXT NOT NULL, CURSEFORGE TEXT NOT NULL)')
    const insert = dictionary.prepare('INSERT INTO dict(origin_name,trans_name,modid,key,version,curseforge) VALUES(?,?,?,?,?,?)')
    insert.run('Door', '门', 'mod', 'door', '1.0', 'mod')
    insert.run('Door', '门', 'mod', 'door', '2.0', 'mod')
    insert.run('Doorway', '门道', 'mod', 'doorway', '1.0', 'mod')
    insert.run('Oak Door', '橡木门', 'mod', 'oak_door', '1.0', 'mod')
    dictionary.close()
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query('CREATE EXTENSION IF NOT EXISTS pg_trgm')
      await importDatabase(client, contentFile, contentSchema)
      await importDatabase(client, dictFile, dictionarySchema)
      await client.query('COMMIT')
    } catch (error) { await client.query('ROLLBACK'); throw error }
    finally { client.release() }
    const db = new PostgresD1(pool, contentSchema)
    assert.ok((await db.prepare('PRAGMA table_info(content_pages)').all()).results.some(c => c.name === 'draft_version'))
    assert.equal((await db.prepare('SELECT draft_body FROM content_pages WHERE id=?').bind('a').first()).draft_body, 'line1\nline2')
    await db.prepare('UPDATE content_pages SET has_unpublished_changes=CASE WHEN ? IS NOT published_body THEN 1 ELSE 0 END WHERE id=?').bind(null, 'a').run()
    assert.equal((await db.prepare('SELECT has_unpublished_changes FROM content_pages').first()).has_unpublished_changes, 0)
    await assert.rejects(db.batch([
      db.prepare('INSERT INTO cms_settings(setting_key,setting_value) VALUES(?,?)').bind('rollback', 'value'),
      db.prepare('INSERT INTO cms_settings(setting_key,setting_value) VALUES(?,?)').bind('rollback', 'duplicate'),
    ]))
    assert.equal(await db.prepare("SELECT * FROM cms_settings WHERE setting_key='rollback'").first(), null)
    await db.prepare('INSERT OR IGNORE INTO cms_settings(setting_key,setting_value) VALUES(?,?)').bind('ignore','original').run()
    await db.prepare('INSERT OR IGNORE INTO cms_settings(setting_key,setting_value) VALUES(?,?)').bind('ignore','changed').run()
    assert.equal((await db.prepare('SELECT setting_value FROM cms_settings WHERE setting_key=?').bind('ignore').first()).setting_value, 'original')
    const dict = new PostgresDictionary(pool, dictionarySchema)
    const search = async (q, column='origin_name') => (await dict.searchDictionary({ normalizedQuery:q, searchColumn:column, itemsPerPage:50, offset:0, cachedTotal:null }))[0].results
    assert.equal((await search('door')).length, 2)
    assert.equal((await search('door+'))[0].origin_name, 'Doorway')
    assert.equal((await search('door* -oak')).length, 2)
    assert.equal((await search('"oak door"'))[0].trans_name, '橡木门')
    assert.equal((await search('门', 'trans_name')).length, 3)
    assert.equal((await search('Door'))[0].all_mods, 'mod (1.0/2.0)')
    assert.equal((await search("door' OR 1=1 --")).length, 0)
  } finally {
    await pool.query(`DROP SCHEMA IF EXISTS "${contentSchema}" CASCADE; DROP SCHEMA IF EXISTS "${dictionarySchema}" CASCADE`)
    await pool.end()
    fs.rmSync(temp, { recursive:true, force:true })
  }
})
