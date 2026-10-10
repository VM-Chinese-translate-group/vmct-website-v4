import assert from 'node:assert/strict'
import { mock, test } from 'node:test'
import { SQLiteD1, createCacheStorage } from './db.mjs'
import dictionary from '../cf-code/d1-tutorial/index.js'

test('D1 batches return query rows, preserve writes and roll back failures', async () => {
  const db = new SQLiteD1(':memory:')
  try {
    db.database.exec('CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT UNIQUE)')
    const [write, read, returning] = await db.batch([
      db.prepare('INSERT INTO items (name) VALUES (?)').bind('door'),
      db.prepare('WITH selected AS (SELECT name FROM items) SELECT * FROM selected'),
      db.prepare('INSERT INTO items (name) VALUES (?) RETURNING name').bind('window'),
    ])
    assert.equal(write.success, true)
    assert.equal(write.meta.changes, 1)
    assert.equal(read.results[0].name, 'door')
    assert.equal(returning.results[0].name, 'window')
    await assert.rejects(db.batch([
      db.prepare('INSERT INTO items (name) VALUES (?)').bind('rollback'),
      db.prepare('INSERT INTO items (name) VALUES (?)').bind('door'),
    ]))
    assert.equal((await db.prepare('SELECT COUNT(*) AS total FROM items').first()).total, 2)
  } finally {
    db.close()
  }
})

test('dictionary cold searches, pagination and different v values agree', async () => {
  const db = new SQLiteD1(':memory:')
  const previousCaches = globalThis.caches
  globalThis.caches = createCacheStorage()
  try {
    // Exercise the legacy schema fallback used by the production database.
    db.database.exec(`
      CREATE TABLE dict (trans_name TEXT, origin_name TEXT, modid TEXT, version TEXT, key TEXT, curseforge TEXT);
      CREATE VIRTUAL TABLE dict_fts USING fts5(origin_name, trans_name, content='dict');
    `)
    for (let i = 0; i < 55; i += 1) {
      await db.prepare('INSERT INTO dict VALUES (?, ?, ?, ?, ?, ?)')
        .bind(`door translation ${i}`, `Regression Door ${i}`, 'testmod', '1.0', `door.${i}`, 'testmod').run()
    }
    db.database.exec("INSERT INTO dict_fts(dict_fts) VALUES('rebuild')")
    const search = async (v, page = 1) => {
      const pending = []
      const response = await dictionary.fetch(new Request(
        `https://dict.test/search?q=regression&page=${page}&mode=en2zh&source=extended&v=${v}`,
      ), { DB: db }, { waitUntil(promise) { pending.push(promise) } })
      assert.equal(response.status, 200)
      const data = await response.json()
      await Promise.all(pending)
      return data
    }
    const cold = await search('0')
    assert.equal(cold.results.length, 50)
    assert.equal(cold.total, 55)
    for (const v of ['1', '2', '999', '0']) assert.deepEqual(await search(v), cold)
    const secondPage = await search('0', 2)
    assert.equal(secondPage.results.length, 5)
    assert.equal(secondPage.total, 55)
  } finally {
    globalThis.caches = previousCaches
    db.close()
  }
})

test('cache expires using explicit TTL or Cache-Control and returns independent bodies', async () => {
  const cache = createCacheStorage().default
  const key = new Request('https://dict.test/search?v=0')
  mock.timers.enable({ apis: ['Date'], now: 1000 })
  try {
    await cache.put(key, new Response('dictionary', { headers: { 'Cache-Control': 'public, max-age=0' } }), { expirationTtl: 2 })
    assert.equal(await (await cache.match(key)).text(), 'dictionary')
    assert.equal(await (await cache.match(key)).text(), 'dictionary')
    mock.timers.tick(2000)
    assert.equal(await cache.match(key), undefined)
    await cache.put(key, new Response('avatar', { headers: { 'Cache-Control': 'public, max-age=1, s-maxage=3' } }))
    mock.timers.tick(1000)
    assert.equal(await (await cache.match(key)).text(), 'avatar')
    mock.timers.tick(2000)
    assert.equal(await cache.match(key), undefined)
    for (const headers of [{}, { 'Cache-Control': 'no-store' }, { 'Cache-Control': 'private, max-age=60' }]) {
      await cache.put(key, new Response('uncacheable', { headers }))
      assert.equal(await cache.match(key), undefined)
    }
  } finally {
    mock.timers.reset()
  }
})
