import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { SQLiteD1 } from './db.mjs'
import { createSiteContent } from './site-content.mjs'
import { createSiteHandler } from './site-handler.mjs'
import { renderContent, normalizePagePath, pageMetadata } from './content-renderer.mjs'
import { onRequest } from './generated/content-api.mjs'

async function fixture(t, extra = {}) {
  const db = new SQLiteD1(':memory:', 'database/content-cms.sql')
  t.after(() => db.close())
  const content = createSiteContent({ db, maxAge: 60000, pagesDirectory: 'src/pages' })
  const token = 'test-admin-session'
  await db.prepare("INSERT INTO cms_sessions(token_hash, expires_at) VALUES(?, '2099-01-01')").bind(createHash('sha256').update(token).digest('base64url')).run()
  const env = { CONTENT_DB: db, CONTENT_CHANGED: content.invalidate, CONTENT_SITE_DATA: content.forPath,
    async VALIDATE_CONTENT(page) { pageMetadata(page.frontmatter); await renderContent(page) }, ...extra }
  const request = (path, method = 'GET', body, session = token, origin = 'https://site.test') => onRequest({ env,
    params: { path: path.split('?')[0].split('/') }, request: new Request('https://site.test/api/content/' + path, {
      method, headers: { Origin: origin, ...(session ? { Cookie: 'cms_content_session=' + session } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    }),
  })
  return { db, env, content, request, token }
}

test('publish, edit, rename and archive change pages and catalog without any build hook', async t => {
  const { content, request, db } = await fixture(t, { SITE_REBUILD_HOOK_URL: 'https://must-never-be-called.invalid/' })
  const created = await request('admin/pages', 'POST', { path: 'docs/new-page', frontmatter: 'title: Before', body: '<DocLayout>\n\n## Public before\n\n</DocLayout>' })
  assert.equal(created.status, 201)
  let { page } = await created.json()
  assert.equal((await content.forPath('/docs/new-page')).page, null)
  let published = await request(`admin/pages/${page.id}/publish`, 'POST', { expectedDraftVersion: page.draftVersion })
  assert.equal(published.status, 200)
  let result = await published.json()
  assert.deepEqual(result.deployment, { requested: true, mode: 'dynamic' })
  page = result.page
  assert.equal((await content.forPath('/docs/new-page')).page.meta.title, 'Before')
  const draft = await request(`admin/pages/${page.id}`, 'PUT', { path: 'docs/renamed', frontmatter: 'title: After', body: '<DocLayout>\n\n## New published body\n\n</DocLayout>', expectedDraftVersion: page.draftVersion })
  assert.equal(draft.status, 200)
  page = (await draft.json()).page
  assert.equal((await content.forPath('/docs/new-page')).page.meta.title, 'Before')
  assert.equal((await content.forPath('/docs/renamed')).page, null)
  published = await request(`admin/pages/${page.id}/publish`, 'POST', { expectedDraftVersion: page.draftVersion })
  assert.equal(published.status, 200)
  page = (await published.json()).page
  assert.equal((await content.forPath('/docs/new-page')).page, null)
  const live = await content.forPath('/docs/renamed')
  assert.equal(live.page.meta.title, 'After')
  assert.ok(live.catalog.some(item => item.title === 'After' && item.excerpt.includes('New published body')))
  const raw = await (await request('internal/export')).json()
  assert.equal(raw.pages[0].path, 'docs/renamed')
  assert.equal(raw.pages[0].frontmatter, 'title: After')
  const view = await (await request('internal/export?view=site&path=/docs/renamed')).json()
  assert.deepEqual(view.page, live.page)
  assert.equal((await request(`admin/pages/${page.id}/archive`, 'POST', { expectedDraftVersion: page.draftVersion })).status, 200)
  assert.equal((await content.forPath('/docs/renamed')).page, null)
  assert.equal((await content.forPath('/community')).page, null, 'archiving final page must not resurrect repository content')
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM content_revisions').first()).n, 2)
})

test('invalid component expressions are rejected before publication; anonymous and cross-origin writes fail', async t => {
  const { request, content } = await fixture(t)
  const created = await request('admin/pages', 'POST', { path: 'bad-page', frontmatter: 'title: Invalid', body: '<DocLayout>\n\n<JoinGroupCard :requirements="globalThis.run()" />\n\n</DocLayout>' })
  const { page } = await created.json()
  const endpoint = `admin/pages/${page.id}/publish`
  assert.equal((await request(endpoint, 'POST', { expectedDraftVersion: page.draftVersion }, '')).status, 401)
  assert.equal((await request(endpoint, 'POST', { expectedDraftVersion: page.draftVersion }, 'test-admin-session', 'https://evil.test')).status, 403)
  assert.equal((await request(endpoint, 'POST', { expectedDraftVersion: page.draftVersion })).status, 400)
  assert.equal((await content.forPath('/bad-page')).page, null)
})

test('saving the first draft does not remove repository pages from an uninitialised CMS', async t => {
  const { request, content } = await fixture(t)
  assert.ok((await content.forPath('/community')).page)
  const result = await request('admin/pages', 'POST', { path: 'new-draft', frontmatter: 'title: Draft', body: '<DocLayout>\n\nDraft only\n\n</DocLayout>' })
  assert.equal(result.status, 201)
  content.invalidate()
  assert.ok((await content.forPath('/community')).page)
  assert.equal((await content.forPath('/new-draft')).page, null)
})

test('legacy components, cards, containers, image sizes and inert code survive runtime parsing', async () => {
  const nodes = await renderContent({ body: '<DocLayout :meta="frontmatter">\n\n## Heading\n\n::: warning Read this\nHello\n:::\n\n<JoinGroupCard title="Test" :responsibilities="[\'First\']" />\n\n<DownloadLinks :methods="[{ id: \'qq\', link: \'https://example.test/\' }]" />\n\n![image =200x](https://example.test/image.png)\n\n```card\ntitle: Friend\nlink: https://example.test\n```\n\n```json\n{"key": true}\n```\n\n</DocLayout>' })
  const json = JSON.stringify(nodes)
  for (const marker of ['Heading', 'custom-block warning', 'JoinGroupCard', 'DownloadLinks', 'Card', 'shiki', 'data-md-image-preview', '200']) assert.ok(json.includes(marker), marker)
  const unsafe = JSON.stringify(await renderContent({ body: '<img src="javascript:alert(1)" onerror="alert(2)" />\n\n<a href="java&#x73;cript:alert(1)">test</a>' }))
  assert.doesNotMatch(unsafe, /onerror|javascript:/)
  assert.equal(normalizePagePath('/modpacks/test/index/'), '/modpacks/test')
  assert.equal(normalizePagePath('/x/%2e%2e/y'), null)
})

test('multiline component tags never place block components inside paragraphs during SSR', async () => {
  const nodes = await renderContent({ body: '<DocLayout>\n\n<DownloadLinks :methods="[\n { id: \'qq\', link: \'https://example.test\' }\n]" />\n\n<div>\n<JoinGroupCard\n title="Group"\n :responsibilities="[\'Translate\']"\n />\n\n<JoinGroupCard title="Second" :responsibilities="[\'Edit\']" />\n</div>\n\n</DocLayout>' })
  const components = []
  const walk = (children, parents = []) => {
    for (const node of children) if (typeof node !== 'string') {
      if (/^[A-Z]/.test(node.tag)) { assert.ok(!parents.includes('p'), node.tag); components.push(node.tag) }
      walk(node.children || [], [...parents, node.tag])
    }
  }
  walk(nodes)
  assert.deepEqual(components, ['DownloadLinks', 'JoinGroupCard', 'JoinGroupCard'])
})

test('HTML and sitemap caches follow content versions, missing pages return 404 and state cannot break out of JSON', async t => {
  const { content, db } = await fixture(t)
  await db.prepare("INSERT INTO content_pages(id,path,published_path,published_frontmatter,published_body,state,published_at) VALUES('one','hello','hello',?,?,'published','2026-10-31')").bind('title: Hello </script><script>bad()</script>', '<DocLayout>\n\nHello\n\n</DocLayout>').run()
  content.invalidate()
  let renders = 0
  const site = createSiteHandler({ content, frameOrigin: 'https://vmpm.site.test', template: async () => '<html lang="zh-CN"><head><!--seo-head--></head><body><!--app-html--></body></html>',
    renderer: async () => async (path, state) => ({ appHtml: '<main>rendered</main>', head: '<title>Hello</title>', htmlAttrs: 'lang="zh-CN"', modules: [], status: state.page || path === '/admin' ? 200 : 404, count: ++renders }),
  })
  const get = path => site.handle(new Request('https://site.test' + path))
  const html = await (await get('/hello')).text()
  assert.ok(html.includes('vmct-content'))
  assert.ok(!html.includes('</script><script>bad'))
  await get('/hello'); assert.equal(renders, 1)
  assert.equal((await get('/missing')).status, 404)
  assert.match(await (await get('/sitemap.xml')).text(), /https:\/\/www.vmct.top\/hello/)
  const admin = await get('/admin?embedded=1')
  assert.equal(admin.headers.get('content-security-policy'), "frame-ancestors 'self' https://vmpm.site.test")
  assert.match(await admin.text(), /"embedded":true/)
  await db.prepare("UPDATE content_pages SET state='archived'").run(); site.invalidate()
  assert.equal((await get('/hello')).status, 404)
  assert.doesNotMatch(await (await get('/sitemap.xml')).text(), /\/hello/)
})

test('VMPM mode exchanges one-use tickets, rejects legacy passwords and rechecks grants after logout or role removal', async t => {
  let active = true, used = false, checks = 0
  const { request, db } = await fixture(t, { VMPM_SSO_ORIGIN: 'https://vmpm.site.test', async VMPM_AUTH(action, credential) {
    if (action === 'redeem' && !used && credential === 't'.repeat(43)) { used = true; return { grant: 'g'.repeat(43) } }
    if (action === 'session' && active && credential === 'g'.repeat(43)) { checks++; return { userId: 1, displayName: 'Admin' } }
    throw Object.assign(new Error('denied'), { status: 401 })
  } })
  assert.equal((await (await request('admin/auth/status')).json()).authMode, 'vmpm')
  assert.equal((await request('admin/auth/challenge')).status, 401)
  assert.equal((await request('admin/auth/setup', 'POST', {})).status, 403)
  assert.equal((await request('admin/pages')).status, 401, 'old CMS sessions must not bypass unified authentication')
  const login = await request('admin/auth/login', 'POST', { ticket: 't'.repeat(43) }, '')
  assert.equal(login.status, 200)
  const cookie = login.headers.get('set-cookie')
  assert.match(cookie, /HttpOnly; Secure; SameSite=Strict/)
  const token = cookie.match(/cms_content_session=([^;]+)/)[1]
  assert.equal((await request('admin/pages', 'GET', undefined, token)).status, 200)
  assert.equal(checks, 1)
  assert.equal((await request('admin/auth/login', 'POST', { ticket: 't'.repeat(43) }, '')).status, 401)
  active = false
  assert.equal((await request('admin/pages', 'GET', undefined, token)).status, 401)
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM cms_external_sessions').first()).n, 0)
})
