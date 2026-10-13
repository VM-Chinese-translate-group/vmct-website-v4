import { PostgresD1 } from './postgres.mjs'

export function postgresSearchPlan(raw, column) {
  if (!['origin_name', 'trans_name'].includes(column)) throw new Error('Invalid search column')
  const params = [], clauses = []
  let includes = 0
  const bind = value => { params.push(value); return `$${params.length}` }
  for (const match of raw.matchAll(/"([^"]+)"|\S+/g)) {
    let token = match[1] || match[0], excluded = token.startsWith('-')
    if (excluded) token = token.slice(1)
    if (!token) continue
    let clause
    if (/[\u3400-\u9fff\uf900-\ufaff]/.test(token)) {
      if (token.endsWith('+')) token = token.slice(0, -1)
      clause = `${column} ILIKE ${bind('%' + token.replace(/[\\%_]/g, '\\$&') + '%')} ESCAPE '\\'`
    } else if (!match[1] && /[+*]$/.test(token)) {
      const plus = token.endsWith('+'), base = token.slice(0, -1)
      const words = base.match(/[\p{L}\p{N}_]+/gu)
      if (!words?.length) continue
      const query = words.map(word => `'${word.replaceAll("'", "''")}'`).join(' & ') + ':*'
      clause = `${column}_search @@ to_tsquery('simple', ${bind(query)})`
      if (plus) clause = `(${clause} AND NOT ${column}_search @@ plainto_tsquery('simple', ${bind(base)}))`
    } else {
      clause = `${column}_search @@ ${match[1] ? 'phraseto_tsquery' : 'plainto_tsquery'}('simple', ${bind(token)})`
    }
    clauses.push(excluded ? `NOT (${clause})` : clause)
    if (!excluded) includes++
  }
  if (!includes) throw new Error('搜索词不能只包含排除条件')
  return { where: clauses.join(' AND '), params }
}

export class PostgresDictionary extends PostgresD1 {
  async searchDictionary({ normalizedQuery, searchColumn, itemsPerPage, offset, cachedTotal }) {
    const plan = postgresSearchPlan(normalizedQuery, searchColumn)
    return this.withClient(async client => {
      const ranked = `WITH ranked AS (
        SELECT trans_name, origin_name, modid, version, key, curseforge,
          CASE WHEN lower(${searchColumn}) = lower($${plan.params.length + 1}) THEN 1 ELSE 0 END AS exact_match
        FROM dict WHERE ${plan.where}
      ), bundles AS (
        SELECT trans_name, origin_name, modid, max(exact_match) AS exact_match,
          modid || ' (' || string_agg(DISTINCT version, '/' ORDER BY version) || ')' AS mod_with_ver,
          string_agg(DISTINCT key, ',' ORDER BY key) AS unique_keys,
          string_agg(DISTINCT curseforge, ',' ORDER BY curseforge) AS unique_cfs
        FROM ranked GROUP BY trans_name, origin_name, modid
      )`
      const params = [...plan.params, normalizedQuery]
      const result = await client.query(`${ranked}
        SELECT trans_name, origin_name,
          string_agg(mod_with_ver, ', ' ORDER BY modid) AS all_mods,
          string_agg(replace(unique_keys, ',', '|'), ',' ORDER BY modid) AS all_keys,
          string_agg(replace(unique_cfs, ',', '|'), ',' ORDER BY modid) AS all_curseforges,
          count(*)::integer AS frequency
        FROM bundles GROUP BY trans_name, origin_name
        ORDER BY max(exact_match) DESC, frequency DESC, origin_name, trans_name
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, itemsPerPage, offset])
      const total = cachedTotal ?? Number((await client.query(
        `SELECT count(*) AS total FROM (SELECT 1 FROM dict WHERE ${plan.where} GROUP BY trans_name, origin_name) grouped`, plan.params)).rows[0].total)
      return [{ success: true, results: result.rows }, { total }]
    })
  }
}
