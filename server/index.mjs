import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { SQLiteD1, createCacheStorage } from './db.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dataDir = path.resolve(process.env.VMCT_DATA_DIR || path.join(root, 'data'))
const contentDb = new SQLiteD1(
  path.join(dataDir, 'content.sqlite'),
  path.join(root, 'database', 'content-cms.sql'),
)
const feedbackDb = new SQLiteD1(
  path.join(dataDir, 'translation-feedback.sqlite'),
  path.join(root, 'database', 'translation-feedback.sql'),
)
const dictionaryDb = new SQLiteD1(
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

const env = {
  CONTENT_DB: contentDb,
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

  if (pathname === '/internal/rebuild' && request.method === 'POST') {
    const secret = env.SITE_REBUILD_SECRET
    const authorization = webRequest.headers.get('authorization') || ''
    if (!secret || authorization !== `Bearer ${secret}`) {
      response = new Response('Unauthorized', { status: 401 })
    } else {
      response = new Response(JSON.stringify({ requested: true }), {
        status: 202,
        headers: { 'Content-Type': 'application/json' },
      })
      const child = await import('node:child_process')
      const rebuild = child.spawn(process.execPath, ['scripts/rebuild-site.mjs'], {
        cwd: root,
        detached: true,
        // Keep the build output in the systemd journal so a failed
        // container copy or Nginx reload can be diagnosed from ECS.
        stdio: 'inherit',
        env: { ...process.env, CONTENT_EXPORT_URL: 'http://127.0.0.1:8787/api/content/internal/export' },
      })
      rebuild.unref()
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
    response = new Response('Not Found', { status: 404 })
  }

  await sendResponse(response, nodeResponse)
}

const port = Number(process.env.PORT || 8787)
const server = http.createServer((request, response) => {
  dispatch(request, response).catch((error) => {
    console.error('request failed', error)
    if (!response.headersSent) response.writeHead(500, { 'Content-Type': 'application/json' })
    response.end(JSON.stringify({ error: 'Internal Server Error' }))
  })
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

server.listen(port, process.env.HOST || '127.0.0.1', () => {
  console.log(`vmct ECS API listening on ${process.env.HOST || '127.0.0.1'}:${port}`)
})

function close() {
  clearInterval(avatarRefreshTimer)
  contentDb.close()
  feedbackDb.close()
  dictionaryDb.close()
  server.close()
}
process.on('SIGINT', close)
process.on('SIGTERM', close)

