interface Env {
  CONTENT_DB: any
}

const JSON_HEADERS = {
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8',
}
const encoder = new TextEncoder()
const PASSWORD_ITERATIONS = 10
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 14

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
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

async function hashPassword(password: string, salt: string) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: fromBase64Url(salt), iterations: PASSWORD_ITERATIONS },
    key,
    256,
  )
  return toBase64Url(new Uint8Array(bits))
}

function equal(left: string, right: string) {
  if (left.length !== right.length) return false
  let difference = 0
  for (let index = 0; index < left.length; index += 1)
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index)
  return difference === 0
}

function passwordFrom(value: unknown) {
  const password = String(value || '')
  if (!/^[\x21-\x7E]{6,}$/.test(password))
    throw new ApiError(400, '密码须至少 6 位，且只能包含数字、字母或符号')
  return password
}

function documentFrom(input: any) {
  const path = String(input?.path || '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+|\/+$/g, '')
    .replace(/\.md$/i, '')
  if (!path || path.includes('..') || !/^[\p{L}\p{N}._/-]+$/u.test(path))
    throw new ApiError(400, '页面路径无效')
  const frontmatter = String(input?.frontmatter || '')
    .replace(/\r\n/g, '\n')
    .trim()
  const body = String(input?.body || '').replace(/\r\n/g, '\n')
  if (frontmatter.length > 100_000 || body.length > 500_000) throw new ApiError(413, '页面内容过长')
  return { path, frontmatter, body }
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
  return json({ needsSetup: !(await setting(context.env.CONTENT_DB, 'admin_password_hash')) })
}

async function setup(context: any) {
  requireSameOrigin(context.request)
  if (await setting(context.env.CONTENT_DB, 'admin_password_hash'))
    throw new ApiError(409, '后台已初始化')
  const ip = await assertLoginAllowed(context)
  const password = passwordFrom((await readJson(context.request))?.password)
  const salt = randomToken(16)
  await saveSetting(context.env.CONTENT_DB, 'admin_password_salt', salt)
  await saveSetting(
    context.env.CONTENT_DB,
    'admin_password_hash',
    await hashPassword(password, salt),
  )
  await context.env.CONTENT_DB.prepare('DELETE FROM cms_login_attempts WHERE client_ip = ?')
    .bind(ip)
    .run()
  return json({ ok: true }, 201, { 'Set-Cookie': sessionCookie(await createSession(context)) })
}

async function login(context: any) {
  requireSameOrigin(context.request)
  const ip = await assertLoginAllowed(context)
  const password = passwordFrom((await readJson(context.request))?.password)
  const salt = await setting(context.env.CONTENT_DB, 'admin_password_salt')
  const expected = await setting(context.env.CONTENT_DB, 'admin_password_hash')
  if (!salt || !expected || !equal(await hashPassword(password, salt), expected)) {
    await loginFailure(context, ip)
    throw new ApiError(401, '密码错误')
  }
  await context.env.CONTENT_DB.prepare('DELETE FROM cms_login_attempts WHERE client_ip = ?')
    .bind(ip)
    .run()
  return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie(await createSession(context)) })
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
      'SELECT id, path, draft_frontmatter AS draftFrontmatter, draft_body AS draftBody, published_frontmatter AS publishedFrontmatter, published_body AS publishedBody, state, published_revision AS publishedRevision, created_at AS createdAt, updated_at AS updatedAt, published_at AS publishedAt FROM content_pages WHERE id = ? LIMIT 1',
    )
    .bind(id)
    .first()
  if (!result) throw new ApiError(404, '页面不存在')
  return result
}

async function listPages(context: any) {
  const result = await context.env.CONTENT_DB.prepare(
    'SELECT id, path, state, published_revision AS publishedRevision, created_at AS createdAt, updated_at AS updatedAt, published_at AS publishedAt FROM content_pages ORDER BY updated_at DESC, path ASC',
  ).all()
  return json({ pages: result.results || [] })
}

async function createPage(context: any) {
  requireSameOrigin(context.request)
  const item = documentFrom(await readJson(context.request))
  const id = crypto.randomUUID()
  try {
    await context.env.CONTENT_DB.prepare(
      'INSERT INTO content_pages (id, path, draft_frontmatter, draft_body) VALUES (?, ?, ?, ?)',
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
  const item = documentFrom(await readJson(context.request))
  await page(context.env.CONTENT_DB, id)
  try {
    await context.env.CONTENT_DB.prepare(
      "UPDATE content_pages SET path = ?, draft_frontmatter = ?, draft_body = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?",
    )
      .bind(item.path, item.frontmatter, item.body, id)
      .run()
  } catch (error: any) {
    if (String(error?.message || '').includes('UNIQUE constraint failed'))
      throw new ApiError(409, '该页面路径已存在')
    throw error
  }
  return json({ page: await page(context.env.CONTENT_DB, id) })
}

async function publish(context: any, id: string) {
  requireSameOrigin(context.request)
  const current = await page(context.env.CONTENT_DB, id)
  if (!current.draftBody?.trim()) throw new ApiError(400, '不能发布空的 Markdown 正文')
  const input = await readJson(context.request).catch(() => ({}))
  const revision = Number(current.publishedRevision || 0) + 1
  await context.env.CONTENT_DB.batch([
    context.env.CONTENT_DB.prepare(
      'INSERT INTO content_revisions (id, page_id, revision, path, frontmatter, body, message) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).bind(
      crypto.randomUUID(),
      id,
      revision,
      current.path,
      current.draftFrontmatter,
      current.draftBody,
      typeof input?.message === 'string' ? input.message.slice(0, 500) : null,
    ),
    context.env.CONTENT_DB.prepare(
      "UPDATE content_pages SET published_frontmatter = draft_frontmatter, published_body = draft_body, state = 'published', published_revision = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), published_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?",
    ).bind(revision, id),
  ])
  return json({ page: await page(context.env.CONTENT_DB, id), deployment: await deploy(context) })
}

async function archive(context: any, id: string) {
  requireSameOrigin(context.request)
  await page(context.env.CONTENT_DB, id)
  await context.env.CONTENT_DB.prepare(
    "UPDATE content_pages SET state = 'archived', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?",
  )
    .bind(id)
    .run()
  return json({ page: await page(context.env.CONTENT_DB, id), deployment: await deploy(context) })
}

async function exportContent(context: any) {
  const result = await context.env.CONTENT_DB.prepare(
    "SELECT path, published_frontmatter AS frontmatter, published_body AS body FROM content_pages WHERE state = 'published' AND published_at IS NOT NULL ORDER BY path ASC",
  ).all()
  return json({ pages: result.results || [] })
}

async function exportAllContent(context: any) {
  const result = await context.env.CONTENT_DB.prepare(
    'SELECT id, path, draft_frontmatter AS draftFrontmatter, draft_body AS draftBody, published_frontmatter AS publishedFrontmatter, published_body AS publishedBody, state, published_revision AS publishedRevision, created_at AS createdAt, updated_at AS updatedAt, published_at AS publishedAt FROM content_pages ORDER BY path ASC',
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
        'UPDATE content_pages SET draft_frontmatter = ?, draft_body = ?, published_frontmatter = ?, published_body = ?, state = ?, published_revision = ?, updated_at = ?, published_at = ? WHERE id = ?',
      )
        .bind(
          item.frontmatter,
          item.body,
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
        'INSERT INTO content_pages (id, path, draft_frontmatter, draft_body, published_frontmatter, published_body, state, published_revision, created_at, updated_at, published_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      )
        .bind(
          id,
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
    if (path === 'internal/export' && context.request.method === 'GET')
      return await exportContent(context)
    if (path === 'admin/auth/status' && context.request.method === 'GET')
      return await authStatus(context)
    if (path === 'admin/auth/setup' && context.request.method === 'POST')
      return await setup(context)
    if (path === 'admin/auth/login' && context.request.method === 'POST')
      return await login(context)
    if (path === 'admin/auth/logout' && context.request.method === 'POST')
      return await logout(context)
    await requireAdmin(context)
    if (path === 'admin/settings' && context.request.method === 'GET')
      return await getSettings(context)
    if (path === 'admin/settings' && context.request.method === 'PUT')
      return await saveSettings(context)
    if (path === 'admin/export' && context.request.method === 'GET')
      return await exportAllContent(context)
    if (path === 'admin/pages' && context.request.method === 'GET') return await listPages(context)
    if (path === 'admin/pages' && context.request.method === 'POST')
      return await createPage(context)
    if (path === 'admin/import' && context.request.method === 'POST')
      return await importContent(context)
    const [, , id, action] = (context.params?.path || []) as string[]
    if (!id) throw new ApiError(404, '接口不存在')
    if (!action && context.request.method === 'GET')
      return json({ page: await page(context.env.CONTENT_DB, id) })
    if (!action && context.request.method === 'PUT') return await saveDraft(context, id)
    if (action === 'publish' && context.request.method === 'POST') return await publish(context, id)
    if (action === 'archive' && context.request.method === 'POST') return await archive(context, id)
    throw new ApiError(404, '接口不存在')
  } catch (error) {
    if (error instanceof ApiError) return json({ error: error.message }, error.status)
    console.error('content CMS error', error)
    return json({ error: '内容服务发生错误' }, 500)
  }
}
