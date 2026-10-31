import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { normalizePagePath, pageMetadata, contentExcerpt, renderContent } from './content-renderer.mjs'

async function repositoryPages(directory, prefix = '') {
  const pages = []
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue
    const relative = prefix + entry.name
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) pages.push(...await repositoryPages(file, relative + '/'))
    else if (entry.isFile() && entry.name.endsWith('.md')) {
      const source = (await fs.readFile(file, 'utf8')).replace(/\r\n/g, '\n')
      const match = source.match(/^---\n([\s\S]*?)\n---(?:\n|$)/)
      pages.push({ path: relative.slice(0, -3), frontmatter: match?.[1] || '', body: match ? source.slice(match[0].length) : source })
    }
  }
  return pages
}

export function createSiteContent({ db, pagesDirectory, maxAge = 5000, now = Date.now }) {
  let current, pending, generation = 0
  const documents = new Map()
  function invalidate() { generation++; current = undefined; pending = undefined; documents.clear() }

  async function load() {
    if (current && current.expires > now()) return current
    if (pending) return pending
    const started = generation
    const task = (async () => {
      const rows = await db.prepare("SELECT COALESCE(published_path, path) AS path, published_frontmatter AS frontmatter, published_body AS body, published_revision AS revision, published_at AS publishedAt FROM content_pages WHERE state = 'published' AND published_at IS NOT NULL ORDER BY COALESCE(published_path, path)").all()
      let pages = rows.results || []
      if (!pages.length && pagesDirectory) {
        const count = await db.prepare('SELECT COUNT(*) AS count FROM content_pages WHERE published_at IS NOT NULL').first()
        // Saving the first draft must not change the public fallback. Once
        // the CMS has publication history, archiving its last live page must
        // never resurrect old repository files.
        if (Number(count?.count) === 0) pages = await repositoryPages(pagesDirectory)
      }
      const version = createHash('sha256').update(JSON.stringify(pages)).digest('hex')
      const byPath = new Map()
      for (const page of pages) {
        const route = normalizePagePath(page.path)
        if (!route || /^\/(?:api|admin)(?:\/|$)/.test(route)) continue
        const meta = pageMetadata(page.frontmatter)
        byPath.set(route, { ...page, path: route, meta })
      }
      const catalog = [...byPath.values()].map(page => ({ path: page.path, meta: page.meta,
        title: page.meta.title || page.body.match(/^#\s+(.+)$/m)?.[1] || '',
        excerpt: contentExcerpt(page.body), publishedAt: page.publishedAt || null }))
      const snapshot = { version, catalog, byPath, expires: now() + maxAge }
      if (started === generation) {
        if (current?.version !== version) documents.clear()
        current = snapshot
      }
      return snapshot
    })()
    pending = task
    try { return await task } finally { if (pending === task) pending = undefined }
  }

  async function forPath(input) {
    const route = normalizePagePath(input)
    const snapshot = await load()
    const source = route && snapshot.byPath.get(route)
    let page = null
    if (source) {
      const key = snapshot.version + ':' + route
      let document = documents.get(key)
      if (!document) {
        document = renderContent(source)
        documents.set(key, document)
        document.catch(() => { if (documents.get(key) === document) documents.delete(key) })
        if (documents.size > 200) documents.delete(documents.keys().next().value)
      }
      page = { path: source.path, meta: source.meta, document: await document }
    }
    return { version: snapshot.version, path: route || String(input), catalog: snapshot.catalog, page }
  }

  return { invalidate, load, forPath }
}
