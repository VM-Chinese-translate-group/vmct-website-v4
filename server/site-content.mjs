import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { ConverterFactory } from 'opencc-js/core'
import { from, to } from 'opencc-js/preset/cn2t'
import { normalizePagePath, pageMetadata, contentExcerpt, renderContent } from './content-renderer.mjs'

const text = value => typeof value === 'string' ? value : ''
const isHidden = ({ path, meta }) => meta.noindex === true || /\/(?:secret|example)$/.test(path)
const byUpdate = (a, b) => b.date - a.date

function resourceItems(catalog, root) {
  return catalog
    .filter(entry => entry.path.startsWith(root) && !entry.path.startsWith('/modpacks/fc5-wiki') && !isHidden(entry))
    .map(({ path, meta }) => {
      const displayDate = text(meta.updateDate)
      const match = displayDate.match(/^(\d{4})(?:年|-)(\d{1,2})(?:月|-)(\d{1,2})日?$/)
      return {
        name: text(meta.title).replace('汉化下载', '').trim() || path.split('/').pop() || '',
        originalName: text(meta.originalName),
        icon: text(meta.icon),
        image: text(meta.image),
        author: text(meta.authors?.[0] || meta.author),
        description: text(meta.description),
        featured: [true, 'true', 'yes', 1, '1'].includes(meta.featured),
        link: path,
        displayDate,
        date: match ? new Date(+match[1], +match[2] - 1, +match[3]).getTime() : 0,
        status: meta.status?.type ? { type: text(meta.status.type) } : undefined,
        versions: {
          loader: text(meta.compatibility?.loader),
          mc: text(meta.compatibility?.minecraft),
          pack: text(meta.compatibility?.pack),
        },
      }
    })
    .sort(byUpdate)
}

function homeContent(modpacks, maps) {
  return {
    modpackCount: modpacks.length,
    mapCount: maps.length,
    hot: [...modpacks.filter(item => item.featured), ...modpacks.filter(item => !item.featured)].slice(0, 6),
    updated: modpacks.slice(0, 6),
    carousel: [...modpacks, ...maps].sort(byUpdate).slice(0, 6),
    maps: maps.slice(0, 4),
  }
}

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
  let convertToTW
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
        else snapshot.searchItems = current.searchItems
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

  async function forRoute(input) {
    const { catalog, ...state } = await forPath(input)
    if (state.path === '/') {
      return { ...state, home: homeContent(resourceItems(catalog, '/modpacks/'), resourceItems(catalog, '/map/')) }
    }
    if (state.path === '/modpacks' || state.path === '/map') {
      return { ...state, resources: resourceItems(catalog, state.path + '/') }
    }
    return state
  }

  async function searchIndex() {
    const snapshot = await load()
    if (!snapshot.searchItems) {
      // Reuse the converted index until a publication changes the catalog.
      convertToTW ??= ConverterFactory(from.cn, to.twp)
      snapshot.searchItems = snapshot.catalog
        .filter(entry => !isHidden(entry) && entry.meta.search !== false)
        .map(({ path, meta, title, excerpt }) => ({
          url: path,
          title: text(title),
          originalName: text(meta.originalName),
          titleTW: convertToTW(text(title)),
          text: excerpt,
          textTW: convertToTW(excerpt),
        }))
    }
    return { version: snapshot.version, items: snapshot.searchItems }
  }

  return { invalidate, load, forPath, forRoute, searchIndex }
}
