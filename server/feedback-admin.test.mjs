import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import test from 'node:test'
import feedback from '../cf-code/vm-chinese-translation-feedback/index.js'
import { SQLiteD1 } from './db.mjs'
import { createFeedbackAdmin } from './feedback-admin.mjs'
import { onRequest } from './generated/content-api.mjs'

const origin = 'https://site.test'
const session = 'feedback-test-session'

async function fixture(t) {
  const content = new SQLiteD1(':memory:', 'database/content-cms.sql')
  const db = new SQLiteD1(':memory:', 'database/translation-feedback.sql')
  t.after(() => { content.close(); db.close() })
  await content.prepare('INSERT INTO cms_sessions (token_hash, expires_at) VALUES (?, ?)')
    .bind(createHash('sha256').update(session).digest('base64url'), '2099-01-01').run()
  const env = {
    CONTENT_DB: content, FEEDBACK_DB: db, FEEDBACK_ADMIN: createFeedbackAdmin(db),
    CORS_ORIGINS: origin, ID_HASH_SECRET: 'feedback-test',
  }
  const admin = async (suffix, method = 'GET', body, { token = session, requestOrigin = origin } = {}) => {
    const path = 'admin/feedback' + suffix
    const request = new Request(origin + '/api/content/' + path, {
      method,
      headers: { Origin: requestOrigin, Cookie: 'cms_content_session=' + token },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const response = await onRequest({ env, request, params: { path: path.split('?')[0].split('/') } })
    assert.equal(response.headers.get('cache-control'), 'no-store')
    return { status: response.status, data: await response.json() }
  }
  const publicApi = (path, body) => feedback.fetch(new Request(origin + '/api/translation-feedback/' + path, {
    method: body ? 'POST' : 'GET',
    headers: { Origin: origin, Cookie: 'feedback_vid=fixture-visitor' },
    body: body ? JSON.stringify(body) : undefined,
  }), env)
  return { admin, publicApi, db }
}

const project = {
  display_name: 'Example project', category: 'map', subtypes: 'adventure,parkour',
  status: 'planned', cover_url: 'https://example.test/cover.png', cover_platform: 'Modrinth',
}

test('feedback admin gates all tables behind CMS sessions and checks write origins', async t => {
  const { admin } = await fixture(t)
  assert.equal((await admin('', 'GET', undefined, { token: '' })).status, 401)
  assert.equal((await admin('/unknown/votes', 'GET', undefined, { token: '' })).status, 401)
  assert.equal((await admin('', 'POST', project, { token: '' })).status, 401)
  assert.equal((await admin('', 'POST', project, { requestOrigin: 'https://other.test' })).status, 403)
  assert.equal((await admin('', 'POST', { ...project, subtypes: 'technology' })).status, 400)
  assert.equal((await admin('', 'POST', { ...project, cover_url: 'javascript:alert(1)' })).status, 400)
  assert.deepEqual((await admin('')).data, { rows: [], hasMore: false })
})

test('feedback admin edits all collections, keeps derived data current and cascades project deletion', async t => {
  const { admin, publicApi, db } = await fixture(t)
  const created = await admin('', 'POST', project)
  assert.equal(created.status, 201)
  const id = created.data.id
  const item = '/' + id
  const sources = item + '/sources'
  const aliases = item + '/aliases'
  const submissions = item + '/submissions'
  const votes = item + '/votes'
  const oldUrl = 'https://modrinth.com/datapack/first'
  const newUrl = 'https://modrinth.com/datapack/next'
  const secondaryUrl = 'https://modrinth.com/datapack/secondary'
  assert.equal((await admin(sources, 'POST', { url: oldUrl + '?utm_source=test', is_primary: 1 })).status, 201)
  assert.equal((await admin(sources, 'PUT', { key: oldUrl, url: newUrl, is_primary: 1 })).status, 200)
  assert.equal((await admin(sources, 'POST', { url: secondaryUrl, is_primary: 1 })).status, 201)
  const { rows: sourceRows } = (await admin(sources)).data
  assert.deepEqual(sourceRows.map(row => [row.url, row.is_primary]), [[secondaryUrl, 1], [newUrl, 0]])
  assert.equal((await admin(sources, 'POST', { url: newUrl, is_primary: 1 })).status, 409)
  assert.equal((await admin(sources)).data.rows[0].is_primary, 1)
  assert.equal((await admin(item)).data.item.canonical_key, 'modrinth:secondary')

  assert.equal((await admin(aliases, 'POST', { alias: 'Old name' })).status, 201)
  assert.equal((await admin(aliases, 'PUT', { key: 'old name', alias: 'New alternate name' })).status, 200)
  assert.equal((await admin('?q=new+alternate+name')).data.rows[0].id, id)
  const hash = createHash('sha256').update('feedback-test:fixture-visitor').digest('hex')
  const entry = { category: 'map', subtypes: 'adventure', original_name: 'Original', voter_hash: hash,
    result: 'merged', note: 'Original note' }
  assert.equal((await admin(submissions, 'POST', entry)).status, 201)
  const submissionId = (await admin(submissions)).data.rows[0].id
  assert.equal((await admin(submissions, 'PUT', { ...entry, key: submissionId, note: 'Edited note' })).status, 200)
  assert.equal((await admin(submissions)).data.rows[0].note, 'Edited note')

  assert.equal((await admin(votes, 'POST', { voter_hash: hash, active: 1 })).status, 201)
  assert.equal((await admin(votes, 'POST', { voter_hash: hash, active: 1 })).status, 409)
  const getPublicItem = async () => (await (await publicApi('items?category=map')).json()).items[0]
  assert.equal((await getPublicItem()).voteCount, 1)
  assert.equal((await getPublicItem()).votedByCurrentVisitor, true)
  assert.equal((await admin(votes, 'PUT', { key: hash, active: 0 })).status, 200)
  assert.equal((await getPublicItem()).voteCount, 0)
  const like = await publicApi('votes', { itemId: id, action: 'like' })
  assert.equal((await like.json()).item.voteCount, 1)
  assert.equal((await admin(votes, 'DELETE', { key: hash })).status, 200)
  assert.equal((await getPublicItem()).voteCount, 0)
  assert.equal('voter_hash' in (await getPublicItem()), false)

  const mismatchedCategory = await publicApi('submissions', { category: 'modpack', subtypes: ['technology'],
    originalName: 'Different category', urls: [newUrl] })
  assert.equal(mismatchedCategory.status, 201)
  assert.deepEqual((await mismatchedCategory.json()).item.subtypes, ['adventure', 'parkour'])

  assert.equal((await admin(item, 'PUT', { ...project, display_name: 'Renamed', status: 'hidden' })).status, 200)
  assert.equal(await getPublicItem(), undefined)
  assert.equal((await admin('?status=hidden')).data.rows[0].normalized_name, 'renamed')
  const hiddenSubmission = await publicApi('submissions', { category: 'modpack', subtypes: ['technology'],
    originalName: 'Duplicate', urls: [newUrl] })
  assert.equal(hiddenSubmission.status, 400)
  assert.equal((await admin(sources, 'DELETE', { key: secondaryUrl })).status, 200)
  assert.equal((await admin(item)).data.item.canonical_key, 'modrinth:next')
  assert.equal((await admin(item, 'DELETE')).status, 200)
  assert.equal((await admin(item)).status, 404)
  for (const table of ['items', 'sources', 'aliases', 'submissions', 'votes']) {
    assert.equal((await db.prepare(`SELECT COUNT(*) AS total FROM feedback_${table}`).first()).total, 0)
  }
})
