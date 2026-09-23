export default {
  async fetch(request, env, ctx) {
    const corsHeaders = getCorsHeaders()

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      })
    }

    try {
      if (request.method !== 'GET') {
        return textResponse('Method Not Allowed', 405, corsHeaders)
      }

      const url = new URL(request.url)
      const pathname = normalizePathname(url.pathname)

      if (pathname === '/api/bilibili' || pathname.startsWith('/api/bilibili/')) {
        return await handleBilibiliAvatar(url, request, ctx, corsHeaders)
      }

      if (pathname === '/api/afdian' || pathname.startsWith('/api/afdian/')) {
        return await handleAfdian(url, request, ctx, corsHeaders, env)
      }

      return textResponse('Not Found', 404, corsHeaders)
    } catch (error) {
      console.error('Unhandled worker error:', error)

      return jsonResponse(
        {
          error: 'Internal Server Error',
          message: String(error?.message || error),
        },
        500,
        corsHeaders,
      )
    }
  },

  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(refreshScheduledBilibiliAvatars(env))
  },
}

const BILIBILI_CACHE_TTL = 60 * 60 * 6
const BILIBILI_STALE_TTL = 60 * 60 * 24 * 7
const BILIBILI_NEGATIVE_CACHE_TTL = 60 * 10

const BILIBILI_BATCH_CONCURRENCY = 4

// 免费版单次调用外部子请求上限是 50；前端每批 30，这里留余量。
const BILIBILI_MAX_UPSTREAM_FETCHES_PER_INVOCATION = 35

// ECS 定时任务通过环境变量提供服务地址。
const BILIBILI_WORKER_ORIGIN = ''

// 如果 scheduled 还没记录过最近访问的 uid，可在这里填兜底 uid。
// 例如：const BILIBILI_SCHEDULED_FALLBACK_UIDS = ['123', '456']
const BILIBILI_SCHEDULED_FALLBACK_UIDS = []

// 凭据只从 ECS 环境变量读取，禁止提交到仓库。
const AFDIAN_USER_ID = ''
const AFDIAN_TOKEN = ''

function getCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Max-Age': '86400',
  }
}

function normalizePathname(pathname) {
  if (!pathname || pathname === '/') return '/'
  return pathname.endsWith('/') ? pathname.slice(0, -1) : pathname
}

function textResponse(body, status, corsHeaders, extraHeaders = {}) {
  return new Response(body, {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/plain;charset=UTF-8',
      ...extraHeaders,
    },
  })
}

function jsonResponse(body, status, corsHeaders, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json;charset=UTF-8',
      ...extraHeaders,
    },
  })
}

function responseWithCors(response, corsHeaders) {
  const headers = new Headers(response.headers)

  for (const [key, value] of Object.entries(corsHeaders)) {
    headers.set(key, value)
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

async function safeCacheMatch(cache, key) {
  try {
    return await cache.match(key)
  } catch (error) {
    console.warn('Cache match failed:', error)
    return null
  }
}

async function safeCachePut(cache, key, response) {
  try {
    await cache.put(key, response)
  } catch (error) {
    console.warn('Cache put failed:', error)
  }
}

async function handleBilibiliAvatar(url, request, ctx, corsHeaders) {
  const rawSingleUid = url.searchParams.get('uid')

  if (rawSingleUid != null && String(rawSingleUid).trim()) {
    const uid = parseBilibiliUid(rawSingleUid)

    if (!uid) {
      return textResponse('Missing or invalid uid', 400, corsHeaders)
    }

    ctx.waitUntil(saveLatestBilibiliUids(request, [uid]))

    const faces = await getBilibiliAvatarMap([uid], request, ctx, corsHeaders)
    const face = faces[uid] || ''

    if (!face) {
      return textResponse('Avatar Not Found', 404, corsHeaders, {
        'Cache-Control': 'no-store',
      })
    }

    return textResponse(face, 200, corsHeaders, {
      'Cache-Control': `public, max-age=${BILIBILI_CACHE_TTL}`,
    })
  }

  const uids = parseBilibiliUids(url.searchParams.get('uids'))

  if (!uids.length) {
    return jsonResponse(
      {
        error: 'Missing or invalid uids',
      },
      400,
      corsHeaders,
    )
  }

  ctx.waitUntil(saveLatestBilibiliUids(request, uids))

  const faces = await getBilibiliAvatarMap(uids, request, ctx, corsHeaders)
  const complete = uids.every((uid) => Boolean(faces[uid]))

  return jsonResponse(faces, 200, corsHeaders, {
    // 如果还有缺失，不要把“缺头像结果”缓存 6 小时。
    'Cache-Control': complete ? `public, max-age=${BILIBILI_CACHE_TTL}` : 'public, max-age=60',
  })
}

async function getBilibiliAvatarMap(uids, request, ctx, corsHeaders) {
  const cache = caches.default
  const origin = new URL(request.url).origin
  const cacheKey = getBilibiliAvatarStoreCacheKey(origin)
  const store = await loadBilibiliAvatarStore(cache, cacheKey)

  const now = Date.now()
  const needRefreshUids = getUidsNeedingRefresh(store, uids, now)
  const immediateUids = needRefreshUids.slice(0, BILIBILI_MAX_UPSTREAM_FETCHES_PER_INVOCATION)

  // 关键修复：缺头像时当前请求直接刷新，不再只 waitUntil 后台刷新。
  if (immediateUids.length) {
    await refreshBilibiliAvatarStore(cache, cacheKey, store, immediateUids, corsHeaders)
  }

  const remainingUids = needRefreshUids.slice(BILIBILI_MAX_UPSTREAM_FETCHES_PER_INVOCATION)

  if (remainingUids.length) {
    ctx.waitUntil(
      refreshBilibiliAvatarStore(
        cache,
        cacheKey,
        store,
        remainingUids.slice(0, BILIBILI_MAX_UPSTREAM_FETCHES_PER_INVOCATION),
        corsHeaders,
      ),
    )
  }

  return filterFaces(store.faces, uids)
}

async function loadBilibiliAvatarStore(cache, cacheKey) {
  const cached = await safeCacheMatch(cache, cacheKey)
  const payload = cached ? await cached.json().catch(() => null) : null

  const faces = isPlainObject(payload?.faces) ? payload.faces : {}
  const uidUpdatedAt = isPlainObject(payload?.uidUpdatedAt) ? payload.uidUpdatedAt : {}
  const failedAt = isPlainObject(payload?.failedAt) ? payload.failedAt : {}

  return {
    updatedAt: Number(payload?.updatedAt || 0),
    faces: normalizeFaceMap(faces),
    uidUpdatedAt,
    failedAt,
  }
}

async function refreshScheduledBilibiliAvatars(env = {}) {
  const origin = env.BILIBILI_WORKER_ORIGIN || BILIBILI_WORKER_ORIGIN
  const latestUids = await loadLatestBilibiliUids(origin)
  const uids = latestUids.length
    ? latestUids
    : parseBilibiliUids(BILIBILI_SCHEDULED_FALLBACK_UIDS.join(','))

  if (!uids.length) return

  const cache = caches.default
  const cacheKey = getBilibiliAvatarStoreCacheKey(origin)
  const store = await loadBilibiliAvatarStore(cache, cacheKey)

  await refreshBilibiliAvatarStore(
    cache,
    cacheKey,
    store,
    uids.slice(0, BILIBILI_MAX_UPSTREAM_FETCHES_PER_INVOCATION),
    getCorsHeaders(),
  )
}

async function refreshBilibiliAvatarStore(cache, cacheKey, store, uids, corsHeaders) {
  const now = Date.now()
  const uniqueUids = parseBilibiliUids(uids.join(','))

  await runWithConcurrency(uniqueUids, BILIBILI_BATCH_CONCURRENCY, async (uid) => {
    const face = await fetchBilibiliAvatar(uid)

    if (face) {
      store.faces[uid] = face
      store.uidUpdatedAt[uid] = now
      delete store.failedAt[uid]
      return
    }

    // 拉取失败时不删除旧头像，避免临时上游异常导致已有头像消失。
    store.failedAt[uid] = now
  })

  store.updatedAt = Date.now()

  const response = jsonResponse(store, 200, corsHeaders, {
    'Cache-Control': `public, max-age=${BILIBILI_STALE_TTL}`,
  })

  await safeCachePut(cache, cacheKey, response.clone())

  return store
}

function getUidsNeedingRefresh(store, uids, now) {
  return uids.filter((uid) => {
    const face = typeof store.faces[uid] === 'string' ? store.faces[uid].trim() : ''
    const uidUpdatedAt = Number(store.uidUpdatedAt[uid] || 0)
    const failedAt = Number(store.failedAt[uid] || 0)

    if (isValidHttpsUrl(face) && now - uidUpdatedAt <= BILIBILI_CACHE_TTL * 1000) {
      return false
    }

    if (!face && failedAt && now - failedAt <= BILIBILI_NEGATIVE_CACHE_TTL * 1000) {
      return false
    }

    return true
  })
}

async function fetchBilibiliAvatar(uid) {
  const sources = [
    () => fetchBilibiliAvatarFromUapis(uid),
    () => fetchBilibiliAvatarFromCardApi(uid),
    () => fetchBilibiliAvatarFromSpaceApi(uid),
  ]

  for (const source of sources) {
    const face = await source()

    if (face) {
      return face
    }
  }

  return ''
}

async function fetchBilibiliAvatarFromUapis(uid) {
  try {
    const apiUrl = `https://uapis.cn/api/v1/social/bilibili/userinfo?uid=${encodeURIComponent(uid)}`

    const upstream = await fetch(apiUrl, {
      headers: getBilibiliRequestHeaders(uid),
    })

    if (!upstream.ok) {
      console.warn(`Bilibili uapis failed: uid=${uid}, status=${upstream.status}`)
      return ''
    }

    const data = await upstream.json().catch(() => null)
    return normalizeBilibiliFace(data?.face)
  } catch (error) {
    console.warn(`Bilibili uapis fetch failed: uid=${uid}`, error)
    return ''
  }
}

async function fetchBilibiliAvatarFromCardApi(uid) {
  try {
    const apiUrl = `https://api.bilibili.com/x/web-interface/card?mid=${encodeURIComponent(uid)}`

    const upstream = await fetch(apiUrl, {
      headers: getBilibiliRequestHeaders(uid),
    })

    if (!upstream.ok) {
      console.warn(`Bilibili card api failed: uid=${uid}, status=${upstream.status}`)
      return ''
    }

    const data = await upstream.json().catch(() => null)

    if (Number(data?.code) !== 0) {
      console.warn(`Bilibili card api returned non-zero code: uid=${uid}, code=${data?.code}`)
      return ''
    }

    return normalizeBilibiliFace(data?.data?.card?.face)
  } catch (error) {
    console.warn(`Bilibili card api fetch failed: uid=${uid}`, error)
    return ''
  }
}

async function fetchBilibiliAvatarFromSpaceApi(uid) {
  try {
    const apiUrl = `https://api.bilibili.com/x/space/acc/info?mid=${encodeURIComponent(uid)}`

    const upstream = await fetch(apiUrl, {
      headers: getBilibiliRequestHeaders(uid),
    })

    if (!upstream.ok) {
      console.warn(`Bilibili space api failed: uid=${uid}, status=${upstream.status}`)
      return ''
    }

    const data = await upstream.json().catch(() => null)

    if (Number(data?.code) !== 0) {
      console.warn(`Bilibili space api returned non-zero code: uid=${uid}, code=${data?.code}`)
      return ''
    }

    return normalizeBilibiliFace(data?.data?.face)
  } catch (error) {
    console.warn(`Bilibili space api fetch failed: uid=${uid}`, error)
    return ''
  }
}

function getBilibiliRequestHeaders(uid) {
  return {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
    Accept: 'application/json,text/plain,*/*',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    Referer: `https://space.bilibili.com/${encodeURIComponent(uid)}/`,
  }
}

function normalizeBilibiliFace(rawFace) {
  const face = typeof rawFace === 'string' ? rawFace.trim().replace(/^http:\/\//i, 'https://') : ''
  return isValidHttpsUrl(face) ? face : ''
}

function normalizeFaceMap(rawFaces) {
  const faces = {}

  for (const [uid, face] of Object.entries(rawFaces)) {
    const normalizedUid = parseBilibiliUid(uid)
    const normalizedFace = normalizeBilibiliFace(face)

    if (normalizedUid && normalizedFace) {
      faces[normalizedUid] = normalizedFace
    }
  }

  return faces
}

function parseBilibiliUid(rawUid) {
  const uid = String(rawUid || '').trim()
  return /^\d+$/.test(uid) ? uid : ''
}

function parseBilibiliUids(rawUids) {
  return [
    ...new Set(
      String(rawUids || '')
        .split(',')
        .map(parseBilibiliUid)
        .filter(Boolean),
    ),
  ]
}

function getBilibiliAvatarStoreCacheKey(origin) {
  return new Request(new URL('/api/bilibili/avatar-store', origin).toString(), {
    method: 'GET',
  })
}

function getLatestBilibiliUidsCacheKey(origin) {
  return new Request(new URL('/api/bilibili/latest-uids', origin).toString(), {
    method: 'GET',
  })
}

async function saveLatestBilibiliUids(request, uids) {
  try {
    const origin = new URL(request.url).origin
    const response = new Response(JSON.stringify({ uids: parseBilibiliUids(uids.join(',')) }), {
      headers: {
        'Content-Type': 'application/json;charset=UTF-8',
        'Cache-Control': `public, max-age=${BILIBILI_STALE_TTL}`,
      },
    })

    await safeCachePut(caches.default, getLatestBilibiliUidsCacheKey(origin), response)
  } catch (error) {
    console.warn('Save latest Bilibili UIDs failed:', error)
  }
}

async function loadLatestBilibiliUids(origin) {
  const cached = await safeCacheMatch(caches.default, getLatestBilibiliUidsCacheKey(origin))
  const payload = cached ? await cached.json().catch(() => null) : null

  if (!payload || !Array.isArray(payload.uids)) return []

  return parseBilibiliUids(payload.uids.join(','))
}

function filterFaces(faces, uids) {
  const result = {}

  for (const uid of uids) {
    const face = normalizeBilibiliFace(faces[uid])

    if (face) {
      result[uid] = face
    }
  }

  return result
}

function isValidHttpsUrl(value) {
  return /^https:\/\/.+/i.test(String(value || '').trim())
}

function isPlainObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

async function runWithConcurrency(items, limit, worker) {
  const queue = [...items]
  const workerCount = Math.min(Math.max(1, limit), queue.length)

  const workers = Array.from({ length: workerCount }, async () => {
    while (queue.length) {
      const item = queue.shift()

      if (item == null) continue

      await worker(item)
    }
  })

  await Promise.all(workers)
}

async function handleAfdian(url, request, ctx, corsHeaders, env = {}) {
  const config = {
    userId: String(env.AFDIAN_USER_ID || AFDIAN_USER_ID).trim(),
    token: String(env.AFDIAN_TOKEN || AFDIAN_TOKEN).trim(),
  }

  if (!config.userId || !config.token || config.token.includes('把你原文件里的')) {
    return jsonResponse(
      {
        error: 'Missing Afdian userId or token',
      },
      500,
      corsHeaders,
    )
  }

  const page = Number.parseInt(url.searchParams.get('page') || '1', 10)

  if (!Number.isFinite(page) || page < 1) {
    return jsonResponse(
      {
        error: 'Missing or invalid page',
      },
      400,
      corsHeaders,
    )
  }

  const cacheUrl = new URL(request.url)
  cacheUrl.searchParams.set('page', String(page))

  const cacheKey = new Request(cacheUrl.toString(), {
    method: 'GET',
  })

  const cache = caches.default
  const cached = await safeCacheMatch(cache, cacheKey)

  if (cached) {
    return responseWithCors(cached, corsHeaders)
  }

  try {
    const ts = Math.floor(Date.now() / 1000)
    const params = JSON.stringify({ page })
    const raw = `${config.token}params${params}ts${ts}user_id${config.userId}`
    const sign = await md5Hex(raw)

    const upstream = await fetch('https://afdian.com/api/open/query-sponsor', {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0',
        Accept: 'application/json',
        'Content-Type': 'application/json;charset=UTF-8',
      },
      body: JSON.stringify({
        user_id: config.userId,
        params,
        ts,
        sign,
      }),
    })

    const data = await upstream.json().catch(() => null)

    if (!upstream.ok) {
      return jsonResponse(
        {
          error: 'Afdian upstream error',
          status: upstream.status,
          data,
        },
        502,
        corsHeaders,
      )
    }

    const response = jsonResponse(data ?? {}, 200, corsHeaders, {
      'Cache-Control': 'public, max-age=600',
    })

    ctx.waitUntil(safeCachePut(cache, cacheKey, response.clone()))

    return response
  } catch (error) {
    console.error('Afdian request failed:', error)

    return jsonResponse(
      {
        error: 'Afdian request failed',
        message: String(error?.message || error),
      },
      500,
      corsHeaders,
    )
  }
}

async function md5Hex(input) {
  // Cloudflare's runtime exposes MD5 through SubtleCrypto; Node's WebCrypto
  // intentionally does not. The ECS adapter uses the native Node hash here.
  if (typeof process !== 'undefined' && process.versions?.node) {
    const { createHash } = await import('node:crypto')
    return createHash('md5').update(input).digest('hex')
  }
  const buf = await crypto.subtle.digest('MD5', new TextEncoder().encode(input))

  return [...new Uint8Array(buf)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}
