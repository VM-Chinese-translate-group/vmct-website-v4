import test from 'node:test'
import assert from 'node:assert/strict'
import { SQLiteD1 } from './db.mjs'
import { createSiteContent } from './site-content.mjs'
import { render } from '../dist/server/entry-server.js'

test('production SSR shares content templates, emits portal hydration anchors, and isolates request state', async t => {
  const db = new SQLiteD1(':memory:', 'database/content-cms.sql')
  t.after(() => db.close())
  const content = createSiteContent({ db, pagesDirectory: 'src/pages' })
  const page = await content.forPath('/modpacks/sb4')
  const rendered = await render('/modpacks/sb4', page)
  assert.equal(rendered.status, 200)
  assert.match(rendered.appHtml, /FTB石头世界4汉化下载/)
  assert.match(rendered.head, /<title>FTB石头世界4/)
  assert.match(rendered.teleports, /teleport.*anchor/)
  assert.ok(rendered.modules.includes('src/content/ContentPage.vue'))
  const missing = await render('/not-published', await content.forPath('/not-published'))
  assert.equal(missing.status, 404)
  assert.doesNotMatch(missing.appHtml, /世界引擎/)
  const community = await render('/community', await content.forPath('/community'))
  assert.equal(community.status, 200)
  assert.match(community.appHtml, /立即申请/)
  assert.doesNotMatch(community.head, /<title>FTB/)
})
