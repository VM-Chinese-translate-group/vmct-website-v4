import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createHmac } from 'node:crypto'
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

test('D1 SQL preserves CMS camelCase aliases without rewriting strings or comments', () => {
  assert.equal(postgresSql('SELECT draft_body AS draftBody, client_ip as clientIp, expires_at AS expiresAt FROM content_pages WHERE id=?'),
    'SELECT draft_body AS "draftBody", client_ip as "clientIp", expires_at AS "expiresAt" FROM content_pages WHERE id=$1')
  const quoted = `SELECT 'AS draftBody ?' AS literal, draft_body AS "draftBody", CAST(? AS INTEGER) -- AS clientIp ?\n/* AS expiresAt ? */`
  assert.equal(postgresSql(quoted), quoted.replace('CAST(?', 'CAST($1'))
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
    const page = await db.prepare('SELECT draft_body AS draftBody, draft_frontmatter AS draftFrontmatter, draft_version AS draftVersion, published_at AS publishedAt FROM content_pages WHERE id=?').bind('a').first()
    assert.equal(page.draftBody, 'line1\nline2')
    assert.equal(typeof page.draftFrontmatter, 'string')
    assert.equal(typeof page.draftVersion, 'number')
    assert.equal(page.publishedAt, null)
    assert.equal(Object.hasOwn(page, 'draftbody'), false)
    await db.prepare('INSERT INTO cms_auth_challenges(id, challenge, client_ip, expires_at) VALUES(?,?,?,?)')
      .bind('alias-check', 'test-challenge', '127.0.0.1', '2099-01-01T00:00:00.000Z').run()
    const challenge = await db.prepare('SELECT challenge, client_ip AS clientIp, expires_at AS expiresAt FROM cms_auth_challenges WHERE id=?')
      .bind('alias-check').first()
    assert.equal(challenge.clientIp, '127.0.0.1')
    assert.equal(challenge.expiresAt, '2099-01-01T00:00:00.000Z')
    await db.prepare('UPDATE content_pages SET has_unpublished_changes=CASE WHEN ? IS NOT published_body THEN 1 ELSE 0 END WHERE id=?').bind(null, 'a').run()
    assert.equal((await db.prepare('SELECT has_unpublished_changes FROM content_pages').first()).has_unpublished_changes, 0)
    // Exercise the actual CMS handler, not only SQL rows: both authentication
    // and the editor depend on the D1 camelCase response contract.
    const { onRequest } = await import('./generated/content-api.mjs')
    const verifier = Buffer.alloc(32, 7).toString('base64url')
    const cmsEnv = { CONTENT_DB: db, CMS_ADMIN_VERIFIER: verifier,
      CMS_ADMIN_SALT: Buffer.alloc(16, 9).toString('base64url') }
    const cms = (route, { method = 'GET', body, cookie } = {}) => onRequest({
      env: cmsEnv, params: { path: route.split('/') }, waitUntil() {},
      request: new Request('https://cms.test/api/content/' + route, {
        method, headers: { 'CF-Connecting-IP': '127.0.0.1', Origin: 'https://cms.test',
          ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
      }),
    })
    const challengeResponse = await cms('admin/auth/challenge')
    assert.equal(challengeResponse.status, 200)
    const loginChallenge = await challengeResponse.json()
    const loginBody = { challengeId: loginChallenge.id,
      proof: createHmac('sha256', Buffer.from(verifier, 'base64url'))
        .update('vmct-content-admin-v1:' + loginChallenge.challenge).digest('base64url') }
    const login = await cms('admin/auth/login', { method: 'POST', body: loginBody })
    assert.equal(login.status, 200)
    const cookie = login.headers.get('set-cookie').split(';')[0]
    assert.equal((await cms('admin/auth/login', { method: 'POST', body: loginBody })).status, 401)
    const pagesResponse = await cms('admin/pages', { cookie })
    assert.equal(pagesResponse.status, 200)
    const pages = (await pagesResponse.json()).pages
    assert.equal(typeof pages[0].draftFrontmatter, 'string')
    assert.equal(typeof pages[0].draftVersion, 'number')
    const pageResponse = await cms('admin/pages/a', { cookie })
    assert.equal(pageResponse.status, 200)
    assert.equal((await pageResponse.json()).page.draftBody, 'line1\nline2')
    const draft = { path: 'regression-document', frontmatter: 'title: Regression document',
      body: '<DocLayout>\nRegression body\n</DocLayout>', expectedDraftVersion: pages[0].draftVersion }
    const saved = await cms('admin/pages/a', { method: 'PUT', body: draft, cookie })
    assert.equal(saved.status, 200)
    const savedPage = (await saved.json()).page
    assert.equal(savedPage.draftBody, draft.body)
    assert.equal(savedPage.draftVersion, draft.expectedDraftVersion + 1)
    const conflict = await cms('admin/pages/a', { method: 'PUT', body: draft, cookie })
    assert.equal(conflict.status, 409)
    assert.equal((await conflict.json()).page.draftBody, draft.body)
    const published = await cms('admin/pages/a/publish', { method: 'POST',
      body: { expectedDraftVersion: savedPage.draftVersion }, cookie })
    assert.equal(published.status, 200)
    const publishedPage = (await published.json()).page
    assert.equal(publishedPage.publishedBody, draft.body)
    assert.equal(publishedPage.publishedRevision, 1)
    const revisionsResponse = await cms('admin/pages/a/revisions', { cookie })
    assert.equal(revisionsResponse.status, 200)
    assert.equal(typeof (await revisionsResponse.json()).revisions[0].publishedAt, 'string')
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
