import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { SQLiteD1, createCacheStorage } from './db.mjs'
import { createPostgresPool, PostgresD1 } from './postgres.mjs'
import { PostgresDictionary } from './postgres-dictionary.mjs'
import { createSiteContent } from './site-content.mjs'
import { createSiteHandler } from './site-handler.mjs'
import { pageMetadata, renderContent } from './content-renderer.mjs'
import { createVmpmAuth } from './vmpm-auth.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dataDir = path.resolve(process.env.VMCT_DATA_DIR || path.join(root, 'data'))
const databaseBackend = process.env.VMCT_DATABASE_BACKEND || 'sqlite'
if (!['sqlite', 'postgres'].includes(databaseBackend)) throw new Error('Invalid VMCT_DATABASE_BACKEND')
const pool = databaseBackend === 'postgres' ? createPostgresPool(process.env.VMCT_DATABASE_URL) : null
const contentDb = pool ? new PostgresD1(pool, 'content') : new SQLiteD1(
  path.join(dataDir, 'content.sqlite'),
  path.join(root, 'database', 'content-cms.sql'),
)
const feedbackDb = pool ? new PostgresD1(pool, 'feedback') : new SQLiteD1(
  path.join(dataDir, 'translation-feedback.sqlite'),
  path.join(root, 'database', 'translation-feedback.sql'),
)
const dictionaryDb = pool ? new PostgresDictionary(pool, 'dictionary') : new SQLiteD1(
  process.env.DICT_DB_PATH || path.join(dataDir, 'dictionary.sqlite'),
)

const cacheStorage = createCacheStorage()
globalThis.caches = cacheStorage

const generatedContentModule = path.join(root, 'server', 'generated', 'content-api.mjs')
const sourceContentModule = path.join(root, 'functions', 'api', 'content', '[[path]].ts')
const contentModule = await import(
  pathToFileURL(fs.existsSync(generatedContentModule) ? generatedContentModule : sourceContentModule).href,
)
const feedbackModule = await import(pathToFileURL(path.join(root, 'cf-code', 'vm-chinese-translation-feedback', 'index.js')).href)
const aifadianModule = await import(pathToFileURL(path.join(root, 'cf-code', 'aifadian', 'worker.js')).href)
const dictionaryModule = await import(pathToFileURL(path.join(root, 'cf-code', 'd1-tutorial', 'index.js')).href)

const development = process.env.VMCT_VITE_DEV === '1'
const vmpmOrigin = process.env.VMPM_SSO_ORIGIN ?? (development ? '' : 'https://vmpm.vmct.top')
const vite = development ? await import('vite').then(({ createServer }) => createServer({
  server: { middlewareMode: true }, appType: 'custom',
})) : null
const dist = path.resolve(process.env.SITE_DIST_DIR || path.join(root, 'dist'))
const productionTemplate = development ? null : fs.readFileSync(path.join(dist, 'index.html'), 'utf8')
const manifest = development ? {} : JSON.parse(fs.readFileSync(path.join(dist, '.vite', 'ssr-manifest.json'), 'utf8'))
const productionRenderer = development ? null : (await import(pathToFileURL(path.join(dist, 'server', 'entry-server.js')).href)).render
const siteContent = createSiteContent({ db: contentDb, pagesDirectory: path.join(root, 'src', 'pages') })
const site = createSiteHandler({ content: siteContent, development, manifest,
  frameOrigin: vmpmOrigin,
  renderer: async () => vite ? (await vite.ssrLoadModule('/src/entry-server.ts')).render : productionRenderer,
  template: async url => vite ? vite.transformIndexHtml(url, fs.readFileSync(path.join(root, 'index.html'), 'utf8')) : productionTemplate,
})

const env = {
  CONTENT_DB: contentDb,
  DOWNLOAD_SEEDS: JSON.parse(fs.readFileSync(path.join(root, 'database', 'download-seeds.json'), 'utf8')),
  FEEDBACK_DB: feedbackDb,
  DB: dictionaryDb,
  CORS_ORIGINS: process.env.CORS_ORIGINS || 'https://www.vmct.top,http://localhost:5173',
  ID_HASH_SECRET: process.env.ID_HASH_SECRET || 'change-me-before-production',
  CMS_ADMIN_VERIFIER: process.env.CMS_ADMIN_VERIFIER,
  CMS_ADMIN_SALT: process.env.CMS_ADMIN_SALT,
  AFDIAN_USER_ID: process.env.AFDIAN_USER_ID,
  AFDIAN_TOKEN: process.env.AFDIAN_TOKEN,
  BILIBILI_WORKER_ORIGIN: process.env.BILIBILI_WORKER_ORIGIN || 'http://127.0.0.1:8787',
  SITE_REBUILD_HOOK_URL: process.env.SITE_REBUILD_HOOK_URL,
  SITE_REBUILD_SECRET: process.env.SITE_REBUILD_SECRET,
  CONTENT_CHANGED: site.invalidate,
  CONTENT_SITE_DATA: siteContent.forPath,
  async VALIDATE_CONTENT(page) { pageMetadata(page.frontmatter); await renderContent(page) },
  VMPM_SSO_ORIGIN: vmpmOrigin,
  VMPM_AUTH: vmpmOrigin ? createVmpmAuth(process.env.VMPM_API_ORIGIN || 'http://127.0.0.1:8080') : undefined,
}

function requestBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = []
    request.on('data', (chunk) => chunks.push(chunk))
    request.on('end', () => resolve(Buffer.concat(chunks)))
    request.on('error', reject)
  })
}

function requestHeaders(request) {
  const headers = new Headers()
  for (const [key, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) headers.set(key, value.join(', '))
    else if (value != null) headers.set(key, value)
  }
  return headers
}

async function toWebRequest(request, url) {
  const body = ['GET', 'HEAD'].includes(request.method) ? undefined : await requestBody(request)
  return new Request(url, { method: request.method, headers: requestHeaders(request), body })
}

async function sendResponse(response, nodeResponse) {
  nodeResponse.statusCode = response.status
  response.headers.forEach((value, key) => nodeResponse.setHeader(key, value))
  const body = await response.arrayBuffer()
  nodeResponse.end(Buffer.from(body))
}

function contextFor(request, webRequest, relativePath) {
  const parts = relativePath.split('/').filter(Boolean)
  return {
    request: webRequest,
    env,
    params: { path: parts },
    waitUntil(promise) { Promise.resolve(promise).catch((error) => console.error('background task failed', error)) },
  }
}

async function dispatch(request, nodeResponse) {
  const host = request.headers.host || 'www.vmct.top'
  const forwardedProto = String(request.headers['x-forwarded-proto'] || 'http').split(',')[0]
  const url = `${forwardedProto}://${host}${request.url}`
  const webRequest = await toWebRequest(request, url)
  const pathname = new URL(url).pathname
  let response

  // Nginx serves these in production. Also support a direct local `start`
  // so the exact production bundle can be exercised without an Nginx install.
  if (!development && ['GET', 'HEAD'].includes(request.method)
    && !/^\/(?:api|internal|server|src|node_modules|\.git|\.vite)(?:\/|$)/.test(pathname)
    && /\.(?:css|js|json|svg|png|jpe?g|gif|webp|ico|avif|woff2?|ttf|mp[34]|pdf|txt)$/.test(pathname)) {
    let decoded
    try { decoded = decodeURIComponent(pathname) } catch { decoded = '' }
    const file = path.resolve(dist, '.' + decoded)
    if (decoded && !decoded.includes('\\') && file.startsWith(dist + path.sep) && fs.existsSync(file) && fs.statSync(file).isFile()) {
      const extension = path.extname(file)
      const types = { '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.txt': 'text/plain', '.pdf': 'application/pdf' }
      await sendResponse(new Response(request.method === 'HEAD' ? null : fs.readFileSync(file), { headers: {
        'Content-Type': types[extension] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff',
        'Cache-Control': pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
      } }), nodeResponse)
      return
    }
  }

  if (pathname === '/internal/rebuild' && request.method === 'POST') {
    const secret = env.SITE_REBUILD_SECRET
    const authorization = webRequest.headers.get('authorization') || ''
    if (!secret || authorization !== `Bearer ${secret}`) {
      response = new Response('Unauthorized', { status: 401 })
    } else {
      site.invalidate()
      response = new Response(JSON.stringify({ requested: true, mode: 'dynamic' }), {
        status: 202,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    await sendResponse(response, nodeResponse)
    return
  }

  if (pathname.startsWith('/api/content/')) {
    response = await contentModule.onRequest(contextFor(request, webRequest, pathname.slice('/api/content/'.length)))
  } else if (pathname === '/api/content') {
    response = await contentModule.onRequest(contextFor(request, webRequest, ''))
  } else if (pathname.startsWith('/api/translation-feedback')) {
    response = await feedbackModule.default.fetch(webRequest, env, contextFor(request, webRequest, ''))
  } else if (pathname.startsWith('/api/bilibili') || pathname.startsWith('/api/afdian')) {
    response = await aifadianModule.default.fetch(webRequest, env, contextFor(request, webRequest, ''))
  } else if (pathname === '/search' || pathname === '/api/dict/search') {
    const dictionaryRequest = pathname === '/search'
      ? webRequest
      : new Request(new URL(url).toString().replace('/api/dict/search', '/search'), webRequest)
    response = await dictionaryModule.default.fetch(dictionaryRequest, env, contextFor(request, dictionaryRequest, ''))
  } else {
    response = await site.handle(webRequest)
  }

  await sendResponse(response, nodeResponse)
}

const port = Number(process.env.PORT || 8787)
const server = http.createServer((request, response) => {
  const handle = () => dispatch(request, response).catch((error) => {
    console.error('request failed', error)
    if (!response.headersSent) response.writeHead(500, { 'Content-Type': 'application/json' })
    response.end(JSON.stringify({ error: 'Internal Server Error' }))
  })
  if (vite) vite.middlewares(request, response, handle)
  else void handle()
})

const avatarRefreshTimer = setInterval(() => {
  aifadianModule.default
    .scheduled({}, env, {
      waitUntil(promise) {
        Promise.resolve(promise).catch((error) => console.error('avatar refresh failed', error))
      },
    })
    .catch((error) => console.error('scheduled avatar refresh failed', error))
}, 6 * 60 * 60 * 1000)
avatarRefreshTimer.unref?.()

// Complete the existing idempotent schema/download migration before serving
// either SSR or the public content API, including on an older CMS database.
await contentModule.onRequest(contextFor(null, new Request('http://localhost/api/content/admin/auth/status'), 'admin/auth/status')).then(response => {
  if (!response.ok) throw new Error('CMS schema initialization failed')
})
server.listen(port, process.env.HOST || '127.0.0.1', () => {
  console.log(`vmct ECS API listening on ${process.env.HOST || '127.0.0.1'}:${port}`)
})

async function close() {
  clearInterval(avatarRefreshTimer)
  await vite?.close()
  server.close(async () => {
    await Promise.all([contentDb.close(), feedbackDb.close(), dictionaryDb.close()])
    if (pool) await pool.end()
  })
}
process.on('SIGINT', close)
process.on('SIGTERM', close)

