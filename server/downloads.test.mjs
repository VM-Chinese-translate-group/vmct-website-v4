import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createHash } from 'node:crypto'
import { SQLiteD1 } from './db.mjs'
import { onRequest } from './generated/content-api.mjs'

test('download migration preserves all project links; public reads, authorization and edit conflicts', async () => {
  const db = new SQLiteD1(':memory:', 'database/content-cms.sql')
  const seeds = JSON.parse(fs.readFileSync('database/download-seeds.json', 'utf8'))
  for (const [path, methods] of Object.entries(seeds)) {
    const body = '<DownloadLinks :methods="[' + methods.map(method => '{' + Object.entries(method).map(([key, value]) => `${key}: '${value}'`).join(', ') + '}').join(',\n') + ']" />'
    await db.prepare("INSERT INTO content_pages(id,path,published_path,draft_body,published_body,state,published_at) VALUES(?,?,?,?,?,'published','2026-10-13')").bind(path,path,path,body,body).run()
  }
  const cms = (path, { method = 'GET', body, token, origin = 'https://site.test' } = {}) => onRequest({
    env: { CONTENT_DB: db }, params: { path: path.split('?')[0].split('/') },
    request: new Request('https://site.test/api/content/' + path, { method,
      headers: { Origin: origin, ...(token ? { Cookie: 'cms_content_session=' + token } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}) }),
  })
  try {
    for (const [path, methods] of Object.entries(seeds)) {
      const response = await cms('downloads?path=' + encodeURIComponent(path.replace(/\/index$/, '')))
      assert.equal(response.status, 200, path)
      assert.deepEqual((await response.json()).methods, methods, path)
      const page = await db.prepare('SELECT draft_body, published_body FROM content_pages WHERE id=?').bind(path).first()
      assert.equal(page.draft_body, '<DownloadLinks/>')
      assert.equal(page.published_body, '<DownloadLinks/>')
    }
    const token = 'test-session'
    await db.prepare('INSERT INTO cms_sessions(token_hash,expires_at) VALUES(?,?)').bind(createHash('sha256').update(token).digest('base64url'), '2099-01-01T00:00:00Z').run()
    const id = 'test-page'
    await db.prepare("INSERT INTO content_pages(id,path,state) VALUES(?,?,'draft')").bind(id,'modpacks/draft').run()
    const edit = 'admin/pages/' + id + '/downloads'
    assert.equal((await cms(edit)).status, 401)
    assert.equal((await cms('downloads?path=modpacks/draft')).status, 404)
    const data = { version: 0, methods: [{ id: 'lazy', link: 'https://example.test/file.zip' }] }
    assert.equal((await cms(edit, { method: 'PUT', body: data, token, origin: 'https://evil.test' })).status, 403)
    assert.equal((await cms(edit, { method: 'PUT', body: data, token })).status, 200)
    assert.equal((await cms(edit, { method: 'PUT', body: data, token })).status, 409)
    assert.equal((await cms(edit, { method: 'PUT', body: { version: 1, methods: [{ id: 'lazy', link: 'javascript:alert(1)' }] }, token })).status, 400)
    assert.deepEqual((await (await cms(edit, { token })).json()).methods, data.methods)
  } finally { db.close() }
})
