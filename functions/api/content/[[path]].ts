interface Env {
  CONTENT_DB: any
  CMS_ADMIN_VERIFIER?: string
  CMS_ADMIN_SALT?: string
}

const JSON_HEADERS = {
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8',
}
const encoder = new TextEncoder()
const PASSWORD_ITERATIONS = 100
const LEGACY_PASSWORD_ITERATIONS = 10
const CHALLENGE_MAX_AGE_MS = 2 * 60 * 1000
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 14

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public details?: Record<string, unknown>,
  ) {
    super(message)
  }
}

function json(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), { status, headers: { ...JSON_HEADERS, ...headers } })
}

function route(context: any) {
  const path = context.params?.path
  return (Array.isArray(path) ? path : path ? [path] : []).join('/')
}

async function readJson(request: Request) {
  try {
    return await request.json()
  } catch {
    throw new ApiError(400, '请求正文不是有效的 JSON')
  }
}

function requireSameOrigin(request: Request) {
  if (!['POST', 'PUT', 'DELETE'].includes(request.method)) return
  const origin = request.headers.get('Origin')
  if (origin && origin !== new URL(request.url).origin) throw new ApiError(403, '不允许跨站请求')
}

function toBase64Url(value: Uint8Array) {
  let binary = ''
  for (const byte of value) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function fromBase64Url(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(
    atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')),
    (item) => item.charCodeAt(0),
  )
}

function randomToken(byteLength = 32) {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(byteLength)))
}

async function hash(value: string) {
  return toBase64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))))
}

async function proof(verifier: string, challenge: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    fromBase64Url(verifier),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return toBase64Url(
    new Uint8Array(
      await crypto.subtle.sign('HMAC', key, encoder.encode(`vmct-content-admin-v1:${challenge}`)),
    ),
  )
}

function equal(left: string, right: string) {
  if (left.length !== right.length) return false
  let difference = 0
  for (let index = 0; index < left.length; index += 1)
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index)
  return difference === 0
}

function documentFrom(input: any) {
  const path = String(input?.path || '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+|\/+$/g, '')
    .replace(/\.md$/i, '')
  if (!path || path.includes('..') || !/^[\p{L}\p{N}._/-]+$/u.test(path))
    throw new ApiError(400, '页面路径无效')
  if (/^(admin|api)(?:\/|$)/.test(path)) throw new ApiError(400, '该页面路径为系统保留路径')
  const frontmatter = String(input?.frontmatter || '')
    .replace(/\r\n/g, '\n')
    .trim()
  const body = String(input?.body || '').replace(/\r\n/g, '\n')
  if (frontmatter.length > 100_000 || body.length > 500_000) throw new ApiError(413, '页面内容过长')
  return { path, frontmatter, body }
}

async function assertPathAvailable(db: any, path: string, exceptId = '') {
  const conflict = await db
    .prepare(
      "SELECT id FROM content_pages WHERE id != ? AND (path = ? OR (state = 'published' AND published_path = ?)) LIMIT 1",
    )
    .bind(exceptId, path, path)
    .first()
  if (conflict) throw new ApiError(409, '该页面路径已被其他草稿或已发布页面使用')
}

function cookie(request: Request) {
  const prefix = 'cms_content_session='
  return (request.headers.get('Cookie') || '')
    .split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith(prefix))
    ?.slice(prefix.length)
}

function sessionCookie(token: string, maxAge = SESSION_MAX_AGE_SECONDS) {
  return (
    'cms_content_session=' +
    token +
    '; Path=/api/content/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=' +
    maxAge
  )
}

async function setting(db: any, key: string) {
  const row = await db
    .prepare('SELECT setting_value AS value FROM cms_settings WHERE setting_key = ? LIMIT 1')
    .bind(key)
    .first()
  return row?.value as string | undefined
}

async function saveSetting(db: any, key: string, value: string) {
  await db
    .prepare(
      "INSERT INTO cms_settings (setting_key, setting_value, updated_at) VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value, updated_at = excluded.updated_at",
    )
    .bind(key, value)
    .run()
}

async function ensureContentSchema(db: any) {
  const columns = await db.prepare('PRAGMA table_info(content_pages)').all()
  if (!(columns.results || []).some((column: any) => column.name === 'draft_version'))
    await db
      .prepare('ALTER TABLE content_pages ADD COLUMN draft_version INTEGER NOT NULL DEFAULT 0')
      .run()
  if (!(columns.results || []).some((column: any) => column.name === 'published_path')) {
    await db.prepare('ALTER TABLE content_pages ADD COLUMN published_path TEXT').run()
    await db
      .prepare(
        'UPDATE content_pages SET published_path = COALESCE((SELECT path FROM content_revisions WHERE page_id = content_pages.id ORDER BY revision DESC LIMIT 1), path) WHERE published_at IS NOT NULL',
      )
      .run()
  }
  if (!(columns.results || []).some((column: any) => column.name === 'has_unpublished_changes')) {
    await db
      .prepare(
        'ALTER TABLE content_pages ADD COLUMN has_unpublished_changes INTEGER NOT NULL DEFAULT 0',
      )
      .run()
    await db
      .prepare(
        "UPDATE content_pages SET has_unpublished_changes = CASE WHEN state = 'draft' OR (state IN ('published', 'archived') AND published_at IS NOT NULL AND (path IS NOT published_path OR draft_frontmatter IS NOT published_frontmatter OR draft_body IS NOT published_body)) THEN 1 ELSE 0 END",
      )
      .run()
  }
}

async function passwordConfig(context: any) {
  let salt =
    context.env.CMS_ADMIN_SALT || (await setting(context.env.CONTENT_DB, 'admin_password_salt'))
  if (!salt) {
    salt = randomToken(16)
    await saveSetting(context.env.CONTENT_DB, 'admin_password_salt', salt)
  }
  if (context.env.CMS_ADMIN_VERIFIER) {
    if (!/^[A-Za-z0-9_-]{43}$/.test(context.env.CMS_ADMIN_VERIFIER))
      throw new Error('CMS_ADMIN_VERIFIER 格式无效')
    return {
      salt,
      iterations: PASSWORD_ITERATIONS,
      verifier: context.env.CMS_ADMIN_VERIFIER,
      managedByEnvironment: true,
    }
  }
  const verifier = await setting(context.env.CONTENT_DB, 'admin_password_hash')
  const storedIterations = Number(
    (await setting(context.env.CONTENT_DB, 'admin_password_iterations')) ||
      LEGACY_PASSWORD_ITERATIONS,
  )
  return {
    salt,
    iterations:
      Number.isSafeInteger(storedIterations) && storedIterations > 0
        ? storedIterations
        : LEGACY_PASSWORD_ITERATIONS,
    verifier,
    managedByEnvironment: false,
  }
}

async function ensureChallengeTable(db: any) {
  await db
    .prepare(
      'CREATE TABLE IF NOT EXISTS cms_auth_challenges (id TEXT PRIMARY KEY, challenge TEXT NOT NULL, client_ip TEXT NOT NULL, expires_at TEXT NOT NULL)',
    )
    .run()
}

async function assertLoginAllowed(context: any) {
  const ip = context.request.headers.get('CF-Connecting-IP') || 'unknown'
  const row = await context.env.CONTENT_DB.prepare(
    'SELECT locked_until AS lockedUntil FROM cms_login_attempts WHERE client_ip = ? LIMIT 1',
  )
    .bind(ip)
    .first()
  if (row?.lockedUntil && new Date(row.lockedUntil).getTime() > Date.now())
    throw new ApiError(429, '尝试次数过多，请 15 分钟后再试')
  return ip
}

async function loginFailure(context: any, ip: string) {
  const now = new Date()
  const row = await context.env.CONTENT_DB.prepare(
    'SELECT failed_count AS failedCount, window_started_at AS windowStartedAt FROM cms_login_attempts WHERE client_ip = ? LIMIT 1',
  )
    .bind(ip)
    .first()
  const inWindow =
    row?.windowStartedAt && new Date(row.windowStartedAt).getTime() + 900_000 > now.getTime()
  const count = inWindow ? Number(row?.failedCount || 0) + 1 : 1
  const locked = count >= 5 ? new Date(now.getTime() + 900_000).toISOString() : null
  await context.env.CONTENT_DB.prepare(
    'INSERT INTO cms_login_attempts (client_ip, failed_count, window_started_at, locked_until) VALUES (?, ?, ?, ?) ON CONFLICT(client_ip) DO UPDATE SET failed_count = excluded.failed_count, window_started_at = excluded.window_started_at, locked_until = excluded.locked_until',
  )
    .bind(ip, count, now.toISOString(), locked)
    .run()
}

async function createSession(context: any) {
  const token = randomToken()
  await context.env.CONTENT_DB.batch([
    context.env.CONTENT_DB.prepare('DELETE FROM cms_sessions WHERE expires_at <= ?').bind(
      new Date().toISOString(),
    ),
    context.env.CONTENT_DB.prepare(
      'INSERT INTO cms_sessions (token_hash, expires_at) VALUES (?, ?)',
    ).bind(await hash(token), new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000).toISOString()),
  ])
  return token
}

async function requireAdmin(context: any) {
  const token = cookie(context.request)
  if (!token) throw new ApiError(401, '请先登录后台')
  const tokenHash = await hash(token)
  const row = await context.env.CONTENT_DB.prepare(
    'SELECT token_hash FROM cms_sessions WHERE token_hash = ? AND expires_at > ? LIMIT 1',
  )
    .bind(tokenHash, new Date().toISOString())
    .first()
  if (!row) throw new ApiError(401, '登录已失效，请重新登录')
}

async function authStatus(context: any) {
  const config = await passwordConfig(context)
  return json({
    needsSetup: !config.verifier,
    managedByEnvironment: config.managedByEnvironment,
  })
}

async function authChallenge(context: any) {
  const ip = await assertLoginAllowed(context)
  const config = await passwordConfig(context)
  await ensureChallengeTable(context.env.CONTENT_DB)
  const id = randomToken(18)
  const challenge = randomToken()
  const now = new Date()
  await context.env.CONTENT_DB.batch([
    context.env.CONTENT_DB.prepare('DELETE FROM cms_auth_challenges WHERE expires_at <= ?').bind(
      now.toISOString(),
    ),
    context.env.CONTENT_DB.prepare(
      'INSERT INTO cms_auth_challenges (id, challenge, client_ip, expires_at) VALUES (?, ?, ?, ?)',
    ).bind(id, challenge, ip, new Date(now.getTime() + CHALLENGE_MAX_AGE_MS).toISOString()),
  ])
  return json({
    id,
    challenge,
    salt: config.salt,
    iterations: config.iterations,
    needsSetup: !config.verifier,
  })
}

async function consumeChallenge(context: any, id: unknown) {
  const challengeId = String(id || '')
  if (!/^[A-Za-z0-9_-]{20,}$/.test(challengeId)) throw new ApiError(400, '登录挑战无效')
  await ensureChallengeTable(context.env.CONTENT_DB)
  const ip = context.request.headers.get('CF-Connecting-IP') || 'unknown'
  const item = await context.env.CONTENT_DB.prepare(
    'SELECT challenge, client_ip AS clientIp, expires_at AS expiresAt FROM cms_auth_challenges WHERE id = ? LIMIT 1',
  )
    .bind(challengeId)
    .first()
  await context.env.CONTENT_DB.prepare('DELETE FROM cms_auth_challenges WHERE id = ?')
    .bind(challengeId)
    .run()
  if (!item || item.clientIp !== ip || new Date(item.expiresAt).getTime() <= Date.now())
    throw new ApiError(401, '登录挑战已失效，请重试')
  return String(item.challenge)
}

async function setup(context: any) {
  requireSameOrigin(context.request)
  if ((await passwordConfig(context)).verifier) throw new ApiError(409, '后台已初始化')
  const ip = await assertLoginAllowed(context)
  const input = await readJson(context.request)
  await consumeChallenge(context, input?.challengeId)
  const verifier = String(input?.verifier || '')
  if (!/^[A-Za-z0-9_-]{43}$/.test(verifier)) throw new ApiError(400, '密码凭据无效')
  await saveSetting(context.env.CONTENT_DB, 'admin_password_hash', verifier)
  await saveSetting(
    context.env.CONTENT_DB,
    'admin_password_iterations',
    String(PASSWORD_ITERATIONS),
  )
  await context.env.CONTENT_DB.prepare('DELETE FROM cms_login_attempts WHERE client_ip = ?')
    .bind(ip)
    .run()
  return json({ ok: true }, 201, { 'Set-Cookie': sessionCookie(await createSession(context)) })
}

async function login(context: any) {
  requireSameOrigin(context.request)
  const ip = await assertLoginAllowed(context)
  const input = await readJson(context.request)
  const challenge = await consumeChallenge(context, input?.challengeId)
  const config = await passwordConfig(context)
  const submittedProof = String(input?.proof || '')
  if (!config.verifier || !equal(await proof(config.verifier, challenge), submittedProof)) {
    await loginFailure(context, ip)
    throw new ApiError(401, '密码错误')
  }
  await context.env.CONTENT_DB.prepare('DELETE FROM cms_login_attempts WHERE client_ip = ?')
    .bind(ip)
    .run()
  return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie(await createSession(context)) })
}

async function changePassword(context: any) {
  requireSameOrigin(context.request)
  if (context.env.CMS_ADMIN_VERIFIER)
    throw new ApiError(409, '密码由 CMS_ADMIN_VERIFIER 环境变量管理')
  const input = await readJson(context.request)
  const salt = String(input?.salt || '')
  const verifier = String(input?.verifier || '')
  if (!/^[A-Za-z0-9_-]{22}$/.test(salt) || !/^[A-Za-z0-9_-]{43}$/.test(verifier))
    throw new ApiError(400, '密码凭据无效')
  await context.env.CONTENT_DB.batch([
    context.env.CONTENT_DB.prepare(
      "INSERT INTO cms_settings (setting_key, setting_value, updated_at) VALUES ('admin_password_salt', ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value, updated_at = excluded.updated_at",
    ).bind(salt),
    context.env.CONTENT_DB.prepare(
      "INSERT INTO cms_settings (setting_key, setting_value, updated_at) VALUES ('admin_password_hash', ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value, updated_at = excluded.updated_at",
    ).bind(verifier),
    context.env.CONTENT_DB.prepare(
      "INSERT INTO cms_settings (setting_key, setting_value, updated_at) VALUES ('admin_password_iterations', ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value, updated_at = excluded.updated_at",
    ).bind(String(PASSWORD_ITERATIONS)),
    context.env.CONTENT_DB.prepare('DELETE FROM cms_sessions'),
  ])
  return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie('', 0) })
}

async function logout(context: any) {
  requireSameOrigin(context.request)
  const token = cookie(context.request)
  if (token)
    await context.env.CONTENT_DB.prepare('DELETE FROM cms_sessions WHERE token_hash = ?')
      .bind(await hash(token))
      .run()
  return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie('', 0) })
}

async function getSettings(context: any) {
  return json({
    deploymentHookUrl: (await setting(context.env.CONTENT_DB, 'deployment_hook_url')) || '',
  })
}

async function saveSettings(context: any) {
  requireSameOrigin(context.request)
  const hook = String((await readJson(context.request))?.deploymentHookUrl || '').trim()
  if (hook && !/^https:\/\//.test(hook)) throw new ApiError(400, 'Deploy Hook 必须是 HTTPS 地址')
  await saveSetting(context.env.CONTENT_DB, 'deployment_hook_url', hook)
  return json({ deploymentHookUrl: hook })
}

async function deploy(context: any) {
  const hook = await setting(context.env.CONTENT_DB, 'deployment_hook_url')
  if (!hook) return { requested: false, error: '请先在后台设置 Pages Deploy Hook' }
  try {
    const response = await fetch(hook, { method: 'POST' })
    return response.ok
      ? { requested: true }
      : { requested: false, error: 'Deploy Hook 返回 HTTP ' + response.status }
  } catch (error) {
    return {
      requested: false,
      error: error instanceof Error ? error.message : '无法调用 Deploy Hook',
    }
  }
}

async function page(db: any, id: string) {
  const result = await db
    .prepare(
      'SELECT id, path, published_path AS publishedPath, draft_frontmatter AS draftFrontmatter, draft_body AS draftBody, published_frontmatter AS publishedFrontmatter, published_body AS publishedBody, state, draft_version AS draftVersion, published_revision AS publishedRevision, created_at AS createdAt, updated_at AS updatedAt, published_at AS publishedAt FROM content_pages WHERE id = ? LIMIT 1',
    )
    .bind(id)
    .first()
  if (!result) throw new ApiError(404, '页面不存在')
  return result
}

async function listPages(context: any) {
  const result = await context.env.CONTENT_DB.prepare(
    'SELECT id, path, published_path AS publishedPath, draft_frontmatter AS draftFrontmatter, state, has_unpublished_changes AS hasUnpublishedChanges, draft_version AS draftVersion, published_revision AS publishedRevision, created_at AS createdAt, updated_at AS updatedAt, published_at AS publishedAt FROM content_pages ORDER BY updated_at DESC, path ASC',
  ).all()
  return json({ pages: result.results || [] })
}

async function createPage(context: any) {
  requireSameOrigin(context.request)
  const item = documentFrom(await readJson(context.request))
  const id = crypto.randomUUID()
  await assertPathAvailable(context.env.CONTENT_DB, item.path)
  try {
    await context.env.CONTENT_DB.prepare(
      'INSERT INTO content_pages (id, path, draft_frontmatter, draft_body, has_unpublished_changes) VALUES (?, ?, ?, ?, 1)',
    )
      .bind(id, item.path, item.frontmatter, item.body)
      .run()
  } catch (error: any) {
    if (String(error?.message || '').includes('UNIQUE constraint failed'))
      throw new ApiError(409, '该页面路径已存在')
    throw error
  }
  return json({ page: await page(context.env.CONTENT_DB, id) }, 201)
}

async function saveDraft(context: any, id: string) {
  requireSameOrigin(context.request)
  const input = await readJson(context.request)
  const item = documentFrom(input)
  const expectedDraftVersion = Number(input?.expectedDraftVersion)
  if (!Number.isSafeInteger(expectedDraftVersion) || expectedDraftVersion < 0)
    throw new ApiError(400, '草稿版本无效')
  await assertPathAvailable(context.env.CONTENT_DB, item.path, id)
  try {
    const result = await context.env.CONTENT_DB.prepare(
      "UPDATE content_pages SET path = ?, draft_frontmatter = ?, draft_body = ?, has_unpublished_changes = CASE WHEN state = 'draft' OR ? IS NOT published_path OR ? IS NOT published_frontmatter OR ? IS NOT published_body THEN 1 ELSE 0 END, draft_version = draft_version + 1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND draft_version = ?",
    )
      .bind(
        item.path,
        item.frontmatter,
        item.body,
        item.path,
        item.frontmatter,
        item.body,
        id,
        expectedDraftVersion,
      )
      .run()
    if (!result.meta?.changes) {
      const current = await page(context.env.CONTENT_DB, id)
      throw new ApiError(409, '草稿已在其他窗口中更新', 'EDIT_CONFLICT', { page: current })
    }
  } catch (error: any) {
    if (error instanceof ApiError) throw error
    if (String(error?.message || '').includes('UNIQUE constraint failed'))
      throw new ApiError(409, '该页面路径已存在')
    throw error
  }
  return json({ page: await page(context.env.CONTENT_DB, id) })
}

async function discardDraft(context: any, id: string) {
  requireSameOrigin(context.request)
  const input = await readJson(context.request)
  const current = await page(context.env.CONTENT_DB, id)
  if (current.state !== 'published') throw new ApiError(400, '只有已上线页面可以撤回到线上版本')
  if (!current.publishedAt || !current.publishedPath)
    throw new ApiError(400, '尚未发布的页面没有可恢复的线上版本')
  if (Number(input?.expectedDraftVersion) !== Number(current.draftVersion))
    throw new ApiError(409, '草稿已在其他窗口中更新', 'EDIT_CONFLICT', { page: current })
  try {
    const result = await context.env.CONTENT_DB.prepare(
      "UPDATE content_pages SET path = published_path, draft_frontmatter = published_frontmatter, draft_body = published_body, state = 'published', has_unpublished_changes = 0, draft_version = draft_version + 1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND draft_version = ?",
    )
      .bind(id, current.draftVersion)
      .run()
    if (!result.meta?.changes) {
      const latest = await page(context.env.CONTENT_DB, id)
      throw new ApiError(409, '草稿已在其他窗口中更新', 'EDIT_CONFLICT', { page: latest })
    }
  } catch (error: any) {
    if (error instanceof ApiError) throw error
    if (String(error?.message || '').includes('UNIQUE constraint failed'))
      throw new ApiError(409, '线上页面路径已被其他草稿占用，无法撤回')
    throw error
  }
  return json({ page: await page(context.env.CONTENT_DB, id) })
}

function validatePublishable(current: any) {
  if (!current.draftBody?.trim()) throw new ApiError(400, '不能发布空的 Markdown 正文')
  if (!/^title:\s*\S+/m.test(current.draftFrontmatter || ''))
    throw new ApiError(400, '发布前必须填写页面标题')
  const resourcePage = /^(modpacks|map)\//.test(current.path)
  if (resourcePage && !/<DownloadLayout\b/.test(current.draftBody))
    throw new ApiError(400, '资源页面必须使用 DownloadLayout')
  if (resourcePage && !/<DownloadLinks\b/.test(current.draftBody))
    throw new ApiError(400, '资源页面至少需要一个下载组件')
  if (!resourcePage && !/<DocLayout\b/.test(current.draftBody))
    throw new ApiError(400, '文档页面必须使用 DocLayout')
  if (/example\.com\/replace-me/.test(current.draftBody))
    throw new ApiError(400, '请替换模板中的示例下载地址')
}

function publishStatements(db: any, current: any, message: unknown) {
  const revision = Number(current.publishedRevision || 0) + 1
  return [
    db
      .prepare(
        'INSERT INTO content_revisions (id, page_id, revision, path, frontmatter, body, message) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .bind(
        crypto.randomUUID(),
        current.id,
        revision,
        current.path,
        current.draftFrontmatter,
        current.draftBody,
        typeof message === 'string' ? message.slice(0, 500) : null,
      ),
    db
      .prepare(
        "UPDATE content_pages SET published_path = path, published_frontmatter = draft_frontmatter, published_body = draft_body, state = 'published', has_unpublished_changes = 0, published_revision = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), published_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?",
      )
      .bind(revision, current.id),
  ]
}

async function publish(context: any, id: string) {
  requireSameOrigin(context.request)
  const current = await page(context.env.CONTENT_DB, id)
  validatePublishable(current)
  const input = await readJson(context.request).catch(() => ({}))
  if (Number(input?.expectedDraftVersion) !== Number(current.draftVersion))
    throw new ApiError(409, '草稿已在其他窗口中更新', 'EDIT_CONFLICT', { page: current })
  await context.env.CONTENT_DB.batch(
    publishStatements(context.env.CONTENT_DB, current, input?.message),
  )
  return json({ page: await page(context.env.CONTENT_DB, id), deployment: await deploy(context) })
}

async function publishBatch(context: any) {
  requireSameOrigin(context.request)
  const input = await readJson(context.request)
  if (!Array.isArray(input?.pages) || !input.pages.length || input.pages.length > 50)
    throw new ApiError(400, 'pages 必须是 1 到 50 项的数组')
  const seen = new Set<string>()
  const selected: any[] = []
  for (const item of input.pages) {
    const id = String(item?.id || '')
    if (!id || seen.has(id)) throw new ApiError(400, '发布列表包含无效或重复页面')
    seen.add(id)
    const current = await page(context.env.CONTENT_DB, id)
    try {
      validatePublishable(current)
    } catch (error) {
      if (error instanceof ApiError)
        throw new ApiError(
          error.status,
          `/${current.path}：${error.message}`,
          error.code,
          error.details,
        )
      throw error
    }
    if (Number(item?.expectedDraftVersion) !== Number(current.draftVersion))
      throw new ApiError(409, `/${current.path} 的草稿已在其他窗口中更新`, 'EDIT_CONFLICT', {
        page: current,
      })
    selected.push(current)
  }
  await context.env.CONTENT_DB.batch(
    selected.flatMap((current) =>
      publishStatements(context.env.CONTENT_DB, current, input?.message),
    ),
  )
  return json({
    pages: await Promise.all(selected.map((current) => page(context.env.CONTENT_DB, current.id))),
    deployment: await deploy(context),
  })
}

async function archive(context: any, id: string) {
  requireSameOrigin(context.request)
  const input = await readJson(context.request).catch(() => ({}))
  const current = await page(context.env.CONTENT_DB, id)
  if (Number(input?.expectedDraftVersion) !== Number(current.draftVersion))
    throw new ApiError(409, '草稿已在其他窗口中更新', 'EDIT_CONFLICT', { page: current })
  await context.env.CONTENT_DB.prepare(
    "UPDATE content_pages SET state = 'archived', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?",
  )
    .bind(id)
    .run()
  return json({ page: await page(context.env.CONTENT_DB, id), deployment: await deploy(context) })
}

async function listRevisions(context: any, id: string) {
  await page(context.env.CONTENT_DB, id)
  const result = await context.env.CONTENT_DB.prepare(
    'SELECT revision, path, message, published_at AS publishedAt FROM content_revisions WHERE page_id = ? ORDER BY revision DESC',
  )
    .bind(id)
    .all()
  return json({ revisions: result.results || [] })
}

async function revision(context: any, id: string, revisionNumber: string) {
  const result = await context.env.CONTENT_DB.prepare(
    'SELECT revision, path, frontmatter, body, message, published_at AS publishedAt FROM content_revisions WHERE page_id = ? AND revision = ? LIMIT 1',
  )
    .bind(id, Number(revisionNumber))
    .first()
  if (!result) throw new ApiError(404, '历史版本不存在')
  return result
}

async function restoreRevision(context: any, id: string, revisionNumber: string) {
  requireSameOrigin(context.request)
  const input = await readJson(context.request)
  const expectedDraftVersion = Number(input?.expectedDraftVersion)
  const historical = await revision(context, id, revisionNumber)
  let result
  try {
    result = await context.env.CONTENT_DB.prepare(
      "UPDATE content_pages SET path = ?, draft_frontmatter = ?, draft_body = ?, has_unpublished_changes = 1, draft_version = draft_version + 1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND draft_version = ?",
    )
      .bind(historical.path, historical.frontmatter, historical.body, id, expectedDraftVersion)
      .run()
  } catch (error: any) {
    if (String(error?.message || '').includes('UNIQUE constraint failed'))
      throw new ApiError(409, '历史版本的页面路径已被其他页面使用')
    throw error
  }
  if (!result.meta?.changes) {
    const current = await page(context.env.CONTENT_DB, id)
    throw new ApiError(409, '草稿已在其他窗口中更新', 'EDIT_CONFLICT', { page: current })
  }
  return json({ page: await page(context.env.CONTENT_DB, id) })
}

async function exportContent(context: any) {
  const result = await context.env.CONTENT_DB.prepare(
    "SELECT COALESCE(published_path, path) AS path, published_frontmatter AS frontmatter, published_body AS body FROM content_pages WHERE state = 'published' AND published_at IS NOT NULL ORDER BY COALESCE(published_path, path) ASC",
  ).all()
  return json({ pages: result.results || [] })
}

async function exportAllContent(context: any) {
  const result = await context.env.CONTENT_DB.prepare(
    'SELECT id, path, published_path AS publishedPath, draft_frontmatter AS draftFrontmatter, draft_body AS draftBody, published_frontmatter AS publishedFrontmatter, published_body AS publishedBody, state, draft_version AS draftVersion, published_revision AS publishedRevision, created_at AS createdAt, updated_at AS updatedAt, published_at AS publishedAt FROM content_pages ORDER BY path ASC',
  ).all()
  return json({ pages: result.results || [] })
}

async function importContent(context: any) {
  requireSameOrigin(context.request)
  const payload = await readJson(context.request)
  if (!Array.isArray(payload?.pages) || !payload.pages.length || payload.pages.length > 500)
    throw new ApiError(400, 'pages 必须是 1 到 500 项的数组')
  const now = new Date().toISOString()
  for (const item of payload.pages.map(documentFrom)) {
    const existing = await context.env.CONTENT_DB.prepare(
      'SELECT id, published_revision AS revision FROM content_pages WHERE path = ? LIMIT 1',
    )
      .bind(item.path)
      .first()
    const id = existing?.id || crypto.randomUUID()
    const revision = Number(existing?.revision || 0) + 1
    if (existing) {
      await context.env.CONTENT_DB.prepare(
        'UPDATE content_pages SET draft_frontmatter = ?, draft_body = ?, published_path = ?, published_frontmatter = ?, published_body = ?, state = ?, has_unpublished_changes = 0, draft_version = draft_version + 1, published_revision = ?, updated_at = ?, published_at = ? WHERE id = ?',
      )
        .bind(
          item.frontmatter,
          item.body,
          item.path,
          item.frontmatter,
          item.body,
          'published',
          revision,
          now,
          now,
          id,
        )
        .run()
    } else {
      await context.env.CONTENT_DB.prepare(
        'INSERT INTO content_pages (id, path, published_path, draft_frontmatter, draft_body, published_frontmatter, published_body, state, has_unpublished_changes, published_revision, created_at, updated_at, published_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)',
      )
        .bind(
          id,
          item.path,
          item.path,
          item.frontmatter,
          item.body,
          item.frontmatter,
          item.body,
          'published',
          revision,
          now,
          now,
          now,
        )
        .run()
    }
    await context.env.CONTENT_DB.prepare(
      'INSERT INTO content_revisions (id, page_id, revision, path, frontmatter, body, message, published_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    )
      .bind(
        crypto.randomUUID(),
        id,
        revision,
        item.path,
        item.frontmatter,
        item.body,
        'Repository import',
        now,
      )
      .run()
  }
  return json({ imported: payload.pages.length, deployment: await deploy(context) })
}

export const onRequest = async (context: any) => {
  try {
    const path = route(context)
    await ensureContentSchema(context.env.CONTENT_DB)
    if (path === 'internal/export' && context.request.method === 'GET')
      return await exportContent(context)
    if (path === 'admin/auth/status' && context.request.method === 'GET')
      return await authStatus(context)
    if (path === 'admin/auth/challenge' && context.request.method === 'GET')
      return await authChallenge(context)
    if (path === 'admin/auth/setup' && context.request.method === 'POST')
      return await setup(context)
    if (path === 'admin/auth/login' && context.request.method === 'POST')
      return await login(context)
    if (path === 'admin/auth/logout' && context.request.method === 'POST')
      return await logout(context)
    await requireAdmin(context)
    if (path === 'admin/auth/password' && context.request.method === 'PUT')
      return await changePassword(context)
    if (path === 'admin/settings' && context.request.method === 'GET')
      return await getSettings(context)
    if (path === 'admin/settings' && context.request.method === 'PUT')
      return await saveSettings(context)
    if (path === 'admin/deploy' && context.request.method === 'POST') {
      requireSameOrigin(context.request)
      return json({ deployment: await deploy(context) })
    }
    if (path === 'admin/export' && context.request.method === 'GET')
      return await exportAllContent(context)
    if (path === 'admin/pages' && context.request.method === 'GET') return await listPages(context)
    if (path === 'admin/pages' && context.request.method === 'POST')
      return await createPage(context)
    if (path === 'admin/pages/publish-batch' && context.request.method === 'POST')
      return await publishBatch(context)
    if (path === 'admin/import' && context.request.method === 'POST')
      return await importContent(context)
    const rawSegments = context.params?.path
    const [, , id, action, revisionNumber, revisionAction] = (
      Array.isArray(rawSegments) ? rawSegments : rawSegments ? [rawSegments] : []
    ) as string[]
    if (!id) throw new ApiError(404, '接口不存在')
    if (!action && context.request.method === 'GET')
      return json({ page: await page(context.env.CONTENT_DB, id) })
    if (!action && context.request.method === 'PUT') return await saveDraft(context, id)
    if (action === 'discard-draft' && context.request.method === 'POST')
      return await discardDraft(context, id)
    if (action === 'publish' && context.request.method === 'POST') return await publish(context, id)
    if (action === 'archive' && context.request.method === 'POST') return await archive(context, id)
    if (action === 'revisions' && !revisionNumber && context.request.method === 'GET')
      return await listRevisions(context, id)
    if (
      action === 'revisions' &&
      revisionNumber &&
      !revisionAction &&
      context.request.method === 'GET'
    )
      return json({ revision: await revision(context, id, revisionNumber) })
    if (
      action === 'revisions' &&
      revisionNumber &&
      revisionAction === 'restore' &&
      context.request.method === 'POST'
    )
      return await restoreRevision(context, id, revisionNumber)
    throw new ApiError(404, '接口不存在')
  } catch (error) {
    if (error instanceof ApiError)
      return json({ error: error.message, code: error.code, ...error.details }, error.status)
    console.error('content CMS error', error)
    return json({ error: '内容服务发生错误' }, 500)
  }
}
