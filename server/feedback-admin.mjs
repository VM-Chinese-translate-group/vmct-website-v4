import {
  ALLOWED_PLATFORMS,
  normalizeName,
  parseSubtypes,
  safeCoverUrl,
  safeSources,
} from '../cf-code/vm-chinese-translation-feedback/index.js'

const PAGE_SIZE = 20
const statuses = ['candidate', 'planned', 'translating', 'completed', 'hidden']
const platforms = ALLOWED_PLATFORMS.map(({ platform }) => platform)

class FeedbackError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

function json(data, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } })
}

function text(value, label, max, optional = false) {
  if (optional && (value == null || value === '')) return null
  if (typeof value !== 'string' || value.length > max || (!optional && !value.trim()))
    throw new FeedbackError(400, `${label}须填写有效内容，最多 ${max} 个字符。`)
  return value.trim() || null
}

function choice(value, label, values) {
  if (!values.includes(value)) throw new FeedbackError(400, `${label}无效。`)
  return value
}

function name(value, label) {
  const original = text(value, label, 120)
  const normalized = normalizeName(original)
  if (!normalized) throw new FeedbackError(400, `${label}须包含有效名称。`)
  return [original, normalized]
}

function classification(body) {
  try {
    return parseSubtypes(body.category, body.subtypes)
  } catch {
    throw new FeedbackError(400, '请选择该分类下至少一个有效类型。')
  }
}

function voterHash(value) {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/i.test(value))
    throw new FeedbackError(400, '访客哈希须为 64 位十六进制字符。')
  return value.toLowerCase()
}

function flag(value, label) {
  return choice(value, label, [0, 1])
}

const collections = {
  sources: {
    key: 'normalized_url',
    order: 'is_primary DESC, created_at, normalized_url',
    values(body) {
      const url = text(body.url, '来源链接', 2048)
      let source
      try {
        source = safeSources([url])[0]
      } catch {
        throw new FeedbackError(400, '请填写受支持平台的项目链接。')
      }
      return {
        url: source.url,
        normalized_url: source.normalizedUrl,
        platform: source.platform,
        external_id: source.externalId,
        is_primary: flag(body.is_primary, '主要来源'),
      }
    },
  },
  aliases: {
    key: 'normalized_alias',
    order: 'created_at, normalized_alias',
    values(body) {
      const [alias, normalized_alias] = name(body.alias, '别名')
      return { alias, normalized_alias }
    },
  },
  submissions: {
    key: 'id',
    order: 'created_at DESC, id',
    values(body) {
      const [original_name, normalized_name] = name(body.original_name, '原始名称')
      return {
        category: body.category,
        subtype: classification(body).join(','),
        original_name,
        normalized_name,
        note: text(body.note, '备注', 500, true),
        voter_hash: voterHash(body.voter_hash),
        result: choice(body.result, '处理结果', ['created', 'merged']),
      }
    },
  },
  votes: {
    key: 'voter_hash',
    order: 'updated_at DESC, voter_hash',
    values(body, key, now) {
      return {
        voter_hash: key || voterHash(body.voter_hash),
        active: flag(body.active, '投票状态'),
        updated_at: now,
      }
    },
  },
}

function itemValues(body, now) {
  const [display_name, normalized_name] = name(body.display_name, '项目名称')
  const subtypes = classification(body)
  const coverInput = text(body.cover_url, '封面地址', 2048, true)
  const cover_url = safeCoverUrl(coverInput)
  if (coverInput && !cover_url) throw new FeedbackError(400, '封面须使用有效的 HTTPS 地址。')
  return {
    category: body.category,
    subtype: subtypes[0],
    subtypes: subtypes.join(','),
    display_name,
    normalized_name,
    status: choice(body.status, '项目状态', statuses),
    cover_url,
    cover_platform: choice(body.cover_platform || null, '封面平台', [null, ...platforms]),
    updated_at: now,
  }
}

async function readBody(request) {
  const value = await request.json().catch(() => null)
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new FeedbackError(400, '请求正文须为 JSON 对象。')
  return value
}

function pageOffset(params) {
  const page = Number(params.get('page') ?? '1')
  if (!Number.isSafeInteger(page) || page < 1 || page > 1000000)
    throw new FeedbackError(400, '页码无效。')
  return (page - 1) * PAGE_SIZE
}

function pageResponse(rows) {
  return json({ rows: rows.results.slice(0, PAGE_SIZE), hasMore: rows.results.length > PAGE_SIZE })
}

async function listItems(db, params) {
  const search = text(params.get('q'), '搜索词', 120, true)
  const filter = search ? `%${search.toLowerCase().replace(/[!%_]/g, '!$&')}%` : null
  const status = params.get('status')
  if (status) choice(status, '项目状态', statuses)
  const clauses = []
  const bindings = []
  if (filter) {
    clauses.push(`(LOWER(display_name) LIKE ? ESCAPE '!' OR id = ? OR EXISTS (
      SELECT 1 FROM feedback_aliases WHERE item_id = feedback_items.id AND normalized_alias LIKE ? ESCAPE '!'
    ))`)
    bindings.push(filter, search, filter)
  }
  if (status) {
    clauses.push('status = ?')
    bindings.push(status)
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  return pageResponse(await db.prepare(`SELECT * FROM feedback_items ${where}
    ORDER BY created_at DESC, id LIMIT ? OFFSET ?`)
    .bind(...bindings, PAGE_SIZE + 1, pageOffset(params)).all())
}

function mutation(db, method, table, values, where, keys) {
  const entries = Object.entries(values)
  const columns = entries.map(([column]) => column)
  const data = entries.map(([, value]) => value)
  if (method === 'POST') {
    return db.prepare(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`)
      .bind(...data)
  }
  if (method === 'PUT') {
    return db.prepare(`UPDATE ${table} SET ${columns.map(column => `${column} = ?`).join(', ')} WHERE ${where}`)
      .bind(...data, ...keys)
  }
  return db.prepare(`DELETE FROM ${table} WHERE ${where}`).bind(...keys)
}

function missing() {
  return new FeedbackError(404, '记录不存在或已被删除。')
}

async function handleItems(db, request, id, params) {
  const { method } = request
  if (method === 'GET') {
    if (!id) return listItems(db, params)
    const item = await db.prepare('SELECT * FROM feedback_items WHERE id = ?').bind(id).first()
    if (!item) throw missing()
    return json({ item })
  }
  if (!['POST', 'PUT', 'DELETE'].includes(method) || (method === 'POST' ? id : !id))
    throw new FeedbackError(405, '不支持此操作。')

  const now = new Date().toISOString()
  const values = method === 'DELETE' ? {} : itemValues(await readBody(request), now)
  if (method === 'POST') {
    id = crypto.randomUUID()
    Object.assign(values, { id, canonical_key: `admin:${id}`, created_at: now })
  }
  const result = await mutation(db, method, 'feedback_items', values, 'id = ?', [id]).run()
  if (!result.meta.changes) throw missing()
  return json({ id }, method === 'POST' ? 201 : 200)
}

async function handleCollection(db, request, id, kind, params) {
  if (!Object.hasOwn(collections, kind)) throw new FeedbackError(404, '接口不存在。')
  const { key: column, order, values: validate } = collections[kind]
  const table = `feedback_${kind}`
  const { method } = request
  if (!await db.prepare('SELECT id FROM feedback_items WHERE id = ?').bind(id).first()) throw missing()
  if (method === 'GET') {
    return pageResponse(await db.prepare(`SELECT * FROM ${table} WHERE item_id = ? ORDER BY ${order} LIMIT ? OFFSET ?`)
      .bind(id, PAGE_SIZE + 1, pageOffset(params)).all())
  }
  if (!['POST', 'PUT', 'DELETE'].includes(method)) throw new FeedbackError(405, '不支持此操作。')
  const body = await readBody(request)
  const key = method === 'POST' ? null : text(body.key, '记录标识', 4096)
  const now = new Date().toISOString()
  const values = method === 'DELETE' ? {} : validate(body, key, now)
  const where = `item_id = ? AND ${column} = ?`
  if (key && !await db.prepare(`SELECT 1 FROM ${table} WHERE ${where}`).bind(id, key).first()) throw missing()
  if (method === 'POST') {
    Object.assign(values, { item_id: id, created_at: now })
    if (kind === 'submissions') values.id = crypto.randomUUID()
  }

  const statements = [
    // Match the lock order of the public voting endpoint on PostgreSQL.
    db.prepare('UPDATE feedback_items SET updated_at = updated_at WHERE id = ?').bind(id),
  ]
  if (kind === 'sources' && values.is_primary === 1) {
    statements.push(key
      ? db.prepare(`UPDATE feedback_sources SET is_primary = 0
        WHERE item_id = ? AND ${column} != ?
        AND EXISTS (SELECT 1 FROM feedback_sources WHERE ${where})`).bind(id, key, id, key)
      : db.prepare('UPDATE feedback_sources SET is_primary = 0 WHERE item_id = ?').bind(id))
  }
  const mutationIndex = statements.length
  statements.push(mutation(db, method, table, values, where, [id, key]))
  if (kind === 'votes') {
    statements.push(db.prepare(`UPDATE feedback_items SET vote_count =
      (SELECT COUNT(*) FROM feedback_votes WHERE item_id = ? AND active = 1),
      updated_at = ? WHERE id = ?`).bind(id, now, id))
  }
  if (kind === 'sources') {
    statements.push(db.prepare(`UPDATE feedback_items SET canonical_key = COALESCE(
      (SELECT LOWER(platform) || ':' || external_id FROM feedback_sources
       WHERE item_id = ? AND external_id IS NOT NULL ORDER BY is_primary DESC, created_at, normalized_url LIMIT 1),
      'admin:' || id), updated_at = ? WHERE id = ?`).bind(id, now, id))
  }

  const results = await db.batch(statements)
  if (!results[mutationIndex].meta.changes) throw missing()
  return json({ ok: true }, method === 'POST' ? 201 : 200)
}

export function createFeedbackAdmin(db) {
  return async (request, segments) => {
    try {
      if (segments.length > 2) throw new FeedbackError(404, '接口不存在。')
      const [id, kind] = segments
      const params = new URL(request.url).searchParams
      const itemId = id ? decodeURIComponent(id) : null
      return kind
        ? await handleCollection(db, request, itemId, kind, params)
        : await handleItems(db, request, itemId, params)
    } catch (error) {
      if (error instanceof FeedbackError) return json({ error: error.message }, error.status)
      if (error instanceof URIError) return json({ error: '记录标识无效。' }, 400)
      if (error.code === '23505' || /UNIQUE constraint failed/i.test(error.message))
        return json({ error: '该链接、别名或投票已存在。' }, 409)
      if (error.code === '23503' || /FOREIGN KEY constraint failed/i.test(error.message))
        return json({ error: '关联项目已被删除，请刷新列表。' }, 409)
      console.error('feedback admin database error', error.code)
      return json({ error: '汉化征集数据库操作失败。' }, 500)
    }
  }
}
