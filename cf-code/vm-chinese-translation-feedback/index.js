var __defProp = Object.defineProperty
var __name = (target, value) => __defProp(target, 'name', { value, configurable: true })

// src/index.ts
var SUBTYPES = {
  modpack: ['technology', 'adventure', 'kitchen_sink', 'magic', 'other'],
  map: ['puzzle', 'minigame', 'adventure', 'horror', 'parkour', 'other'],
  other: ['other'],
}

var ALLOWED_PLATFORMS = [
  { platform: 'CurseForge', hosts: ['curseforge.com'], patterns: ['/minecraft/'] },
  { platform: 'Modrinth', hosts: ['modrinth.com'], patterns: ['/'] },
  { platform: 'Planet Minecraft', hosts: ['planetminecraft.com'], patterns: ['/'] },
  { platform: 'Minecraft Maps', hosts: ['minecraftmaps.com'], patterns: ['/'] },
  { platform: 'MapVerse', hosts: ['mapverse.net', 'mapverse.gg', 'mapverse.com'], patterns: ['/'] },
]

var TRACKING_PARAMS = /* @__PURE__ */ new Set(['fbclid', 'gclid', 'mc_cid', 'mc_eid'])
var VALID_CATEGORIES = /* @__PURE__ */ new Set(['modpack', 'map', 'other'])
var VALID_VOTE_ACTIONS = /* @__PURE__ */ new Set(['like', 'unlike'])
var DISALLOWED_URL_PARTS = /* @__PURE__ */ new Set([
  'search',
  'download',
  'downloads',
  'api',
  'login',
  'signup',
  'categories',
  'category',
])

var DOWNLOAD_FILE_PATTERN = /\.(zip|jar|rar|7z|mcworld|exe|apk)$/i
var TEXT_ENCODER = new TextEncoder()

var cachedCorsOriginsRaw
var cachedCorsOrigins

var MODRINTH_API_BASE = 'https://api.modrinth.com/v2'
var CURSEFORGE_API_BASE = 'https://api.curseforge.com/v1'
var DEFAULT_CURSEFORGE_GAME_ID = '432'
var CURSEFORGE_POPULARITY_SORT_FIELD = '2'
var COVER_REQUEST_TIMEOUT_MS = 3500

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  })
}
__name(json, 'json')

function originList(env) {
  const raw =
    env.CORS_ORIGINS ||
    'https://www.vmct.top,http://localhost:5173'
  if (raw === cachedCorsOriginsRaw && cachedCorsOrigins) return cachedCorsOrigins

  cachedCorsOriginsRaw = raw
  cachedCorsOrigins = raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
  return cachedCorsOrigins
}
__name(originList, 'originList')

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin')
  const headers = new Headers()

  headers.set('Vary', 'Origin')
  if (origin && originList(env).includes(origin)) {
    headers.set('Access-Control-Allow-Origin', origin)
    headers.set('Access-Control-Allow-Credentials', 'true')
  }

  headers.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  headers.set('Access-Control-Allow-Headers', 'Content-Type')
  headers.set('Access-Control-Max-Age', '86400')
  return headers
}
__name(corsHeaders, 'corsHeaders')

function withCors(response, request, env, cookie) {
  const headers = new Headers(response.headers)
  corsHeaders(request, env).forEach((value, key) => headers.set(key, value))
  if (cookie) headers.append('Set-Cookie', cookie)
  return new Response(response.body, { status: response.status, headers })
}
__name(withCors, 'withCors')

function parseCookie(request, name) {
  const raw = request.headers.get('Cookie') || ''
  const pair = raw
    .split(';')
    .map((value) => value.trim())
    .find((value) => value.startsWith(`${name}=`))
  if (!pair) return null

  try {
    return decodeURIComponent(pair.slice(name.length + 1))
  } catch {
    return null
  }
}
__name(parseCookie, 'parseCookie')

function createVisitorId() {
  return crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '')
}
__name(createVisitorId, 'createVisitorId')

function visitorCookie(request) {
  const current = parseCookie(request, 'feedback_vid')
  if (current) return { value: current, setCookie: void 0 }

  const value = createVisitorId()
  const requestUrl = new URL(request.url)
  const origin = request.headers.get('Origin')

  const crossSite = origin
    ? (() => {
        try {
          return new URL(origin).hostname !== requestUrl.hostname
        } catch {
          return false
        }
      })()
    : false

  const secure = requestUrl.protocol === 'https:' || crossSite ? '; Secure' : ''
  const sameSite = crossSite ? 'None' : 'Lax'

  return {
    value,
    setCookie: `feedback_vid=${encodeURIComponent(value)}; Max-Age=31536000; Path=/; HttpOnly; SameSite=${sameSite}${secure}`,
  }
}
__name(visitorCookie, 'visitorCookie')

async function hashVisitor(value, env) {
  const bytes = TEXT_ENCODER.encode(`${env.ID_HASH_SECRET || 'development-only-secret'}:${value}`)
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))

  let hex = ''
  for (const byte of digest) hex += byte.toString(16).padStart(2, '0')
  return hex
}
__name(hashVisitor, 'hashVisitor')

function normalizeName(value) {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase()
    .trim()
    .replace(/[\s\u3000]+/g, ' ')
    .replace(/[“”"'‘’]/g, '')
    .replace(/[，。、；：！？（）【】「」]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
__name(normalizeName, 'normalizeName')

function normalizeUrl(value) {
  const url = new URL(value)
  url.hash = ''

  for (const key of [...url.searchParams.keys()]) {
    const lowerKey = key.toLowerCase()
    if (lowerKey.startsWith('utm_') || TRACKING_PARAMS.has(lowerKey)) {
      url.searchParams.delete(key)
    }
  }

  url.hostname = url.hostname.toLowerCase()
  url.pathname = url.pathname.replace(/\/{2,}/g, '/').replace(/\/$/, '') || '/'
  return url.toString()
}
__name(normalizeUrl, 'normalizeUrl')

function safeCoverUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return null

  try {
    const url = new URL(value)
    return url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}
__name(safeCoverUrl, 'safeCoverUrl')

async function fetchJson(url, headers = {}) {
  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json', ...headers },
      signal: AbortSignal.timeout(COVER_REQUEST_TIMEOUT_MS),
    })

    if (!response.ok) return null
    return await response.json()
  } catch {
    return null
  }
}
__name(fetchJson, 'fetchJson')

async function fetchModrinthCover(source) {
  if (!source.externalId) return null

  const project = await fetchJson(
    `${MODRINTH_API_BASE}/project/${encodeURIComponent(source.externalId)}`,
  )
  const url = safeCoverUrl(project?.icon_url)
  return url ? { platform: 'Modrinth', url } : null
}
__name(fetchModrinthCover, 'fetchModrinthCover')

async function fetchCurseForgeCover(source, env) {
  const apiKey = env.CURSEFORGE_API_KEY?.trim()
  const slug = source.externalId?.trim()
  if (!apiKey || !slug) return null

  const gameId = env.CURSEFORGE_GAME_ID?.trim() || DEFAULT_CURSEFORGE_GAME_ID
  if (!/^\d+$/.test(gameId)) return null

  const params = new URLSearchParams({
    gameId,
    searchFilter: slug,
    sortField: CURSEFORGE_POPULARITY_SORT_FIELD,
    sortOrder: 'desc',
    pageSize: '50',
  })

  const search = await fetchJson(`${CURSEFORGE_API_BASE}/mods/search?${params}`, {
    'x-api-key': apiKey,
  })
  const lowerSlug = slug.toLowerCase()
  const match = search?.data?.find((entry) => entry.slug?.toLowerCase() === lowerSlug)

  const assetUrl = safeCoverUrl(match?.assets?.coverUrl)
  if (assetUrl) return { platform: 'CurseForge', url: assetUrl }
  if (typeof match?.id !== 'number') return null

  const details = await fetchJson(`${CURSEFORGE_API_BASE}/mods/${match.id}`, {
    'x-api-key': apiKey,
  })
  const logoUrl = safeCoverUrl(details?.data?.logo?.url || details?.data?.logo?.thumbnailUrl)
  return logoUrl ? { platform: 'CurseForge', url: logoUrl } : null
}
__name(fetchCurseForgeCover, 'fetchCurseForgeCover')

async function updateMissingCover(env, item, sources, updatedAt) {
  if (item.cover_url) return

  for (const source of sources) {
    let cover = null

    if (source.platform === 'Modrinth') {
      cover = await fetchModrinthCover(source)
    } else if (source.platform === 'CurseForge') {
      cover = await fetchCurseForgeCover(source, env)
    }

    if (!cover) continue

    try {
      await env.FEEDBACK_DB.prepare(
        "UPDATE feedback_items SET cover_url = ?, cover_platform = ?, updated_at = ? WHERE id = ? AND (cover_url IS NULL OR cover_url = '')",
      )
        .bind(cover.url, cover.platform, updatedAt, item.id)
        .run()
    } catch {}

    return
  }
}
__name(updateMissingCover, 'updateMissingCover')

function platformForUrl(value) {
  let url

  try {
    url = new URL(value)
  } catch {
    return null
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null

  const hostname = url.hostname.toLowerCase().replace(/^www\./, '')
  const config = ALLOWED_PLATFORMS.find((item) =>
    item.hosts.some((host) => hostname === host || hostname.endsWith(`.${host}`)),
  )

  if (!config || !config.patterns.some((pattern) => url.pathname.startsWith(pattern))) return null

  const parts = url.pathname.split('/').filter(Boolean)
  const last = (parts.at(-1) || '').toLowerCase()

  if (
    parts.length < 1 ||
    (config.platform === 'CurseForge' && parts.length < 3) ||
    DISALLOWED_URL_PARTS.has(last) ||
    DOWNLOAD_FILE_PATTERN.test(last)
  ) {
    return null
  }

  return { platform: config.platform, externalId: parts.at(-1) || null }
}
__name(platformForUrl, 'platformForUrl')

function safeSources(values) {
  if (!Array.isArray(values)) throw new Error('urls must be an array')

  const urls = [
    ...new Set(
      values
        .filter((value) => typeof value === 'string')
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ]

  if (urls.length < 1 || urls.length > 3) {
    throw new Error('provide between one and three source URLs')
  }

  return urls.map((url) => {
    const normalizedUrl = normalizeUrl(url)
    const platform = platformForUrl(normalizedUrl)

    if (!platform) {
      throw new Error(
        'only CurseForge, Modrinth, Planet Minecraft, Minecraft Maps, and MapVerse URLs are supported',
      )
    }

    return { ...platform, url, normalizedUrl }
  })
}
__name(safeSources, 'safeSources')

function validateCategory(category) {
  if (!VALID_CATEGORIES.has(category)) throw new Error('invalid category')
}
__name(validateCategory, 'validateCategory')

function parseSubtypes(category, value) {
  validateCategory(category)

  const values = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : []
  const subtypes = [
    ...new Set(
      values
        .filter((entry) => typeof entry === 'string')
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  ]

  if (!subtypes.length || subtypes.some((subtype) => !SUBTYPES[category].includes(subtype))) {
    throw new Error('invalid subtype')
  }

  return subtypes
}
__name(parseSubtypes, 'parseSubtypes')

function bigrams(value) {
  const result = /* @__PURE__ */ new Set()
  for (let index = 0; index < value.length - 1; index++) {
    result.add(value.slice(index, index + 2))
  }
  return result
}
__name(bigrams, 'bigrams')

function similarity(left, right) {
  if (left === right) return 1
  if (!left || !right) return 0

  const a = bigrams(left)
  const b = bigrams(right)
  const smaller = a.size <= b.size ? a : b
  const larger = smaller === a ? b : a

  let intersection = 0
  for (const gram of smaller) {
    if (larger.has(gram)) intersection++
  }

  return (2 * intersection) / (a.size + b.size || 1)
}
__name(similarity, 'similarity')

async function suggestions(env, params) {
  const category = params.get('category')
  const requestedSubtypes = parseSubtypes(
    category,
    params.get('subtypes') || params.get('subtype') || '',
  )

  const name = normalizeName(params.get('name') || '')
  if (!name) return []

  const result = await env.FEEDBACK_DB.prepare(
    'SELECT id, category, subtype, subtypes, display_name, normalized_name FROM feedback_items WHERE category = ? AND status != ? ORDER BY vote_count DESC, created_at ASC LIMIT 200',
  )
    .bind(category, 'hidden')
    .all()

  const candidateIds = result.results.map((row) => row.id)
  const submittedUrls = []

  for (const value of params.getAll('url')) {
    try {
      submittedUrls.push(normalizeUrl(value))
    } catch {}
  }

  const submittedUrlSet = new Set(submittedUrls)
  const submittedPlatformIds = /* @__PURE__ */ new Set()

  for (const value of submittedUrls) {
    const platform = platformForUrl(value)
    if (platform) {
      submittedPlatformIds.add(`${platform.platform}\0${platform.externalId}`)
    }
  }

  const placeholders = candidateIds.map(() => '?').join(',')

  const sourceRowsPromise =
    candidateIds.length && submittedUrls.length
      ? env.FEEDBACK_DB.prepare(
          `SELECT item_id, normalized_url, platform, external_id FROM feedback_sources WHERE item_id IN (${placeholders})`,
        )
          .bind(...candidateIds)
          .all()
      : Promise.resolve({ results: [] })

  const aliasRowsPromise = candidateIds.length
    ? env.FEEDBACK_DB.prepare(
        `SELECT item_id, normalized_alias FROM feedback_aliases WHERE item_id IN (${placeholders})`,
      )
        .bind(...candidateIds)
        .all()
    : Promise.resolve({ results: [] })

  const [sourceRows, aliasRows] = await Promise.all([sourceRowsPromise, aliasRowsPromise])

  const sourceMap = /* @__PURE__ */ new Map()
  for (const source of sourceRows.results) {
    let list = sourceMap.get(source.item_id)
    if (!list) {
      list = []
      sourceMap.set(source.item_id, list)
    }
    list.push(source)
  }

  const aliasMap = /* @__PURE__ */ new Map()
  for (const alias of aliasRows.results) {
    let list = aliasMap.get(alias.item_id)
    if (!list) {
      list = []
      aliasMap.set(alias.item_id, list)
    }
    list.push(String(alias.normalized_alias || ''))
  }

  const matches = []

  for (const row of result.results) {
    const candidateSubtypes = String(row.subtypes || row.subtype || '')
      .split(',')
      .filter(Boolean)

    if (!requestedSubtypes.some((subtype) => candidateSubtypes.includes(subtype))) {
      continue
    }

    let score = similarity(name, row.normalized_name)
    const aliases = aliasMap.get(row.id)

    if (aliases) {
      for (const alias of aliases) {
        const aliasScore = similarity(name, alias)
        if (aliasScore > score) score = aliasScore
      }
    }

    const candidateSources = sourceMap.get(row.id) || []
    let exactUrl = false
    let samePlatformId = false

    for (const source of candidateSources) {
      if (submittedUrlSet.has(source.normalized_url)) {
        exactUrl = true
      }

      if (submittedPlatformIds.has(`${source.platform}\0${source.external_id}`)) {
        samePlatformId = true
      }

      if (exactUrl && samePlatformId) break
    }

    const reason = exactUrl
      ? 'same-url'
      : samePlatformId
        ? 'platform-id'
        : score === 1
          ? 'same-name'
          : score >= 0.42
            ? 'similar-name'
            : null

    if (!reason) continue

    matches.push({
      id: row.id,
      displayName: row.display_name,
      category: row.category,
      subtypes: candidateSubtypes,
      confidence: exactUrl || samePlatformId ? 1 : score,
      reason,
      sources: candidateSources.map((source) => ({
        platform: source.platform,
        url: source.url,
      })),
    })
  }

  matches.sort((a, b) => b.confidence - a.confidence)
  return matches.slice(0, 5)
}
__name(suggestions, 'suggestions')

async function loadItems(env, request, visitorHash) {
  const url = new URL(request.url)
  const category = url.searchParams.get('category')
  const subtype = url.searchParams.get('subtype')

  const clauses = ['status != ?']
  const bindings = ['hidden']

  if (category) {
    clauses.push('category = ?')
    bindings.push(category)
  }

  if (subtype) {
    clauses.push("(',' || subtypes || ',') LIKE '%,' || ? || ',%'")
    bindings.push(subtype)
  }

  const rows = await env.FEEDBACK_DB.prepare(
    `SELECT id, category, subtype, subtypes, display_name, cover_url, cover_platform, vote_count, status, created_at FROM feedback_items WHERE ${clauses.join(' AND ')} ORDER BY vote_count DESC, created_at ASC LIMIT 200`,
  )
    .bind(...bindings)
    .all()

  const ids = rows.results.map((row) => row.id)
  const placeholders = ids.map(() => '?').join(',')

  const [votes, sources] = await Promise.all([
    ids.length
      ? env.FEEDBACK_DB.prepare(
          `SELECT item_id FROM feedback_votes WHERE voter_hash = ? AND active = 1 AND item_id IN (${placeholders})`,
        )
          .bind(visitorHash, ...ids)
          .all()
      : Promise.resolve({ results: [] }),

    ids.length
      ? env.FEEDBACK_DB.prepare(
          `SELECT item_id, platform, url FROM feedback_sources WHERE item_id IN (${placeholders}) ORDER BY is_primary DESC, created_at ASC`,
        )
          .bind(...ids)
          .all()
      : Promise.resolve({ results: [] }),
  ])

  const voted = new Set(votes.results.map((row) => row.item_id))
  const sourceMap = /* @__PURE__ */ new Map()

  for (const source of sources.results) {
    let list = sourceMap.get(source.item_id)

    if (!list) {
      list = []
      sourceMap.set(source.item_id, list)
    }

    list.push({ platform: source.platform, url: source.url })
  }

  return rows.results.map((row, index) => ({
    id: row.id,
    category: row.category,
    subtypes: String(row.subtypes || row.subtype || '')
      .split(',')
      .filter(Boolean),
    displayName: row.display_name,
    coverUrl: row.cover_url,
    coverPlatform: row.cover_platform,
    voteCount: row.vote_count,
    rank: index + 1,
    status: row.status,
    sources: sourceMap.get(row.id) || [],
    votedByCurrentVisitor: voted.has(row.id),
  }))
}
__name(loadItems, 'loadItems')

async function loadSingleItem(env, id, visitorHash) {
  const result = await env.FEEDBACK_DB.prepare(
    'SELECT id, category, subtype, subtypes, display_name, cover_url, cover_platform, vote_count, status FROM feedback_items WHERE id = ?',
  )
    .bind(id)
    .first()

  if (!result) throw new Error('item not found')

  const [sources, vote] = await Promise.all([
    env.FEEDBACK_DB.prepare(
      'SELECT platform, url FROM feedback_sources WHERE item_id = ? ORDER BY is_primary DESC, created_at ASC',
    )
      .bind(id)
      .all(),

    env.FEEDBACK_DB.prepare(
      'SELECT 1 FROM feedback_votes WHERE item_id = ? AND voter_hash = ? AND active = 1',
    )
      .bind(id, visitorHash)
      .first(),
  ])

  return {
    id: result.id,
    category: result.category,
    subtypes: String(result.subtypes || result.subtype || '')
      .split(',')
      .filter(Boolean),
    displayName: result.display_name,
    coverUrl: result.cover_url,
    coverPlatform: result.cover_platform,
    voteCount: result.vote_count,
    rank: 0,
    status: result.status,
    sources: sources.results,
    votedByCurrentVisitor: Boolean(vote),
  }
}
__name(loadSingleItem, 'loadSingleItem')

async function handleSubmission(request, env, visitorHash) {
  const body = await request.json()

  if (typeof body.selectedExistingItemId === 'string') {
    throw new Error('existing items must be voted for instead of submitted')
  }

  const subtypes = parseSubtypes(body.category, body.subtypes || body.subtype)

  if (
    typeof body.originalName !== 'string' ||
    body.originalName.trim().length < 1 ||
    body.originalName.length > 120
  ) {
    throw new Error('originalName must be between 1 and 120 characters')
  }

  if (
    typeof body.note !== 'undefined' &&
    (typeof body.note !== 'string' || body.note.length > 500)
  ) {
    throw new Error('note is too long')
  }

  const sources = safeSources(body.urls)
  const originalName = body.originalName.trim()
  const normalizedName = normalizeName(originalName)
  const now = new Date().toISOString()

  let item = null
  let result = 'created'

  const normalizedUrls = sources.map((source) => source.normalizedUrl)

  const exact = await env.FEEDBACK_DB.prepare(
    `SELECT fi.* FROM feedback_items fi JOIN feedback_sources fs ON fs.item_id = fi.id WHERE fi.status != ? AND fi.category = ? AND fs.normalized_url IN (${normalizedUrls.map(() => '?').join(',')}) LIMIT 1`,
  )
    .bind('hidden', body.category, ...normalizedUrls)
    .first()

  if (exact) {
    item = exact
    result = 'merged'
  }

  if (!item) {
    const source = sources[0]
    const canonicalKey = `${source.platform.toLowerCase()}:${source.externalId || normalizedName}`

    const existing = await env.FEEDBACK_DB.prepare(
      'SELECT * FROM feedback_items WHERE canonical_key = ?',
    )
      .bind(canonicalKey)
      .first()

    if (existing) {
      item = existing
      result = 'merged'
    } else {
      item = {
        id: crypto.randomUUID(),
        category: body.category,
        subtype: subtypes[0],
        subtypes: subtypes.join(','),
        canonical_key: canonicalKey,
        display_name: originalName,
        normalized_name: normalizedName,
        status: 'candidate',
        cover_url: null,
        cover_platform: source.platform,
        vote_count: 0,
        created_at: now,
        updated_at: now,
      }

      await env.FEEDBACK_DB.prepare(
        'INSERT INTO feedback_items (id, category, subtype, subtypes, canonical_key, display_name, normalized_name, status, cover_url, cover_platform, vote_count, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      )
        .bind(
          item.id,
          item.category,
          item.subtype,
          item.subtypes,
          item.canonical_key,
          item.display_name,
          item.normalized_name,
          item.status,
          null,
          item.cover_platform,
          0,
          now,
          now,
        )
        .run()
    }
  }

  for (let index = 0; index < sources.length; index++) {
    const source = sources[index]

    await env.FEEDBACK_DB.prepare(
      'INSERT OR IGNORE INTO feedback_sources (item_id, platform, url, normalized_url, external_id, is_primary, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
      .bind(
        item.id,
        source.platform,
        source.url,
        source.normalizedUrl,
        source.externalId,
        index === 0 ? 1 : 0,
        now,
      )
      .run()
  }

  const existingSubtypes = String(item.subtypes || item.subtype || '')
    .split(',')
    .filter(Boolean)
  const mergedSubtypes = [...new Set([...existingSubtypes, ...subtypes])]

  const existingSubtypeString = existingSubtypes.join(',')
  const mergedSubtypeString = mergedSubtypes.join(',')

  if (mergedSubtypeString !== existingSubtypeString) {
    await env.FEEDBACK_DB.prepare(
      'UPDATE feedback_items SET subtype = ?, subtypes = ?, updated_at = ? WHERE id = ?',
    )
      .bind(mergedSubtypes[0], mergedSubtypeString, now, item.id)
      .run()

    item.subtypes = mergedSubtypeString
    item.subtype = mergedSubtypes[0]
  }

  await env.FEEDBACK_DB.prepare(
    'INSERT OR IGNORE INTO feedback_aliases (item_id, alias, normalized_alias, created_at) VALUES (?, ?, ?, ?)',
  )
    .bind(item.id, originalName, normalizedName, now)
    .run()

  await env.FEEDBACK_DB.prepare(
    'INSERT INTO feedback_submissions (id, item_id, category, subtype, original_name, normalized_name, note, voter_hash, result, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  )
    .bind(
      crypto.randomUUID(),
      item.id,
      body.category,
      subtypes.join(','),
      originalName,
      normalizedName,
      typeof body.note === 'string' ? body.note.trim() : null,
      visitorHash,
      result,
      now,
    )
    .run()

  await updateMissingCover(env, item, sources, now)

  return {
    item: await loadSingleItem(env, item.id, visitorHash),
    result,
  }
}
__name(handleSubmission, 'handleSubmission')

async function handleVote(request, env, visitorHash) {
  const body = await request.json()

  if (typeof body.itemId !== 'string' || !VALID_VOTE_ACTIONS.has(body.action)) {
    throw new Error('invalid vote payload')
  }

  const item = await env.FEEDBACK_DB.prepare(
    'SELECT id FROM feedback_items WHERE id = ? AND status != ?',
  )
    .bind(body.itemId, 'hidden')
    .first()

  if (!item) throw new Error('item not found')

  const existing = await env.FEEDBACK_DB.prepare(
    'SELECT active FROM feedback_votes WHERE item_id = ? AND voter_hash = ?',
  )
    .bind(body.itemId, visitorHash)
    .first()

  const shouldBeActive = body.action === 'like'

  if (existing && Boolean(existing.active) === shouldBeActive) {
    return { item: await loadSingleItem(env, body.itemId, visitorHash) }
  }

  if (!existing && !shouldBeActive) {
    return { item: await loadSingleItem(env, body.itemId, visitorHash) }
  }

  const now = new Date().toISOString()
  const activeValue = shouldBeActive ? 1 : 0

  if (existing) {
    const update = await env.FEEDBACK_DB.prepare(
      'UPDATE feedback_votes SET active = ?, updated_at = ? WHERE item_id = ? AND voter_hash = ? AND active != ?',
    )
      .bind(activeValue, now, body.itemId, visitorHash, activeValue)
      .run()

    if (Number(update.meta?.changes || 0) === 0) {
      return { item: await loadSingleItem(env, body.itemId, visitorHash) }
    }
  } else {
    const insert = await env.FEEDBACK_DB.prepare(
      'INSERT OR IGNORE INTO feedback_votes (item_id, voter_hash, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    )
      .bind(body.itemId, visitorHash, activeValue, now, now)
      .run()

    if (Number(insert.meta?.changes || 0) === 0) {
      return { item: await loadSingleItem(env, body.itemId, visitorHash) }
    }
  }

  await env.FEEDBACK_DB.prepare(
    'UPDATE feedback_items SET vote_count = MAX(0, vote_count + ?), updated_at = ? WHERE id = ?',
  )
    .bind(shouldBeActive ? 1 : -1, now, body.itemId)
    .run()

  return { item: await loadSingleItem(env, body.itemId, visitorHash) }
}
__name(handleVote, 'handleVote')

var index_default = {
  async fetch(request, env) {
    const url = new URL(request.url)
    const path = url.pathname.replace(/^\/api\/translation-feedback/, '') || '/'

    if (request.method === 'OPTIONS') {
      return withCors(new Response(null, { status: 204 }), request, env)
    }

    const requestOrigin = request.headers.get('Origin')

    if (requestOrigin && !originList(env).includes(requestOrigin) && request.method !== 'GET') {
      return withCors(json({ error: 'origin not allowed' }, 403), request, env)
    }

    const cookie = visitorCookie(request)
    const visitorHash = await hashVisitor(cookie.value, env)

    try {
      if (request.method === 'GET' && path === '/items') {
        const items = await loadItems(env, request, visitorHash)
        return withCors(json({ items, nextCursor: null }), request, env, cookie.setCookie)
      }

      if (request.method === 'GET' && path === '/suggestions') {
        const candidates = await suggestions(env, url.searchParams)
        return withCors(json({ candidates }), request, env, cookie.setCookie)
      }

      if (request.method === 'POST' && path === '/submissions') {
        return withCors(
          json(await handleSubmission(request, env, visitorHash), 201),
          request,
          env,
          cookie.setCookie,
        )
      }

      if (request.method === 'POST' && path === '/votes') {
        return withCors(
          json(await handleVote(request, env, visitorHash)),
          request,
          env,
          cookie.setCookie,
        )
      }

      return withCors(json({ error: 'not found' }, 404), request, env, cookie.setCookie)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'request failed'
      return withCors(json({ error: message }, 400), request, env, cookie.setCookie)
    }
  },
}

export { index_default as default }
