import fs from 'node:fs'
import { createHash } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import { pathToFileURL } from 'node:url'

export const REPOSITORY = 'VM-Chinese-translate-group/i18n-Dict-Extender'

export function latestScheduledStart(now = new Date()) {
  const scheduled = new Date(now)
  scheduled.setUTCHours(10, 0, 0, 0)
  scheduled.setUTCDate(scheduled.getUTCDate() - (scheduled.getUTCDay() + 2) % 7)
  if (scheduled > now) scheduled.setUTCDate(scheduled.getUTCDate() - 7)
  return scheduled
}

export function selectRelease(release, installed, now = new Date()) {
  const published = new Date(release.published_at)
  if (release.draft || release.prerelease || !Number.isFinite(published.getTime())) {
    throw new Error('Invalid upstream release')
  }
  if (published < latestScheduledStart(now)) {
    const error = new Error('Upstream has not published this week’s dictionary yet; retry later')
    error.exitCode = 75
    throw error
  }
  const asset = release.assets?.find((item) => item.name === 'Dict-Sqlite.db')
  if (!asset || !Number.isSafeInteger(asset.size) || asset.size <= 0
    || !Number.isSafeInteger(asset.id) || asset.id <= 0 || !release.tag_name) {
    throw new Error('Release is missing a valid Dict-Sqlite.db asset')
  }
  const url = new URL(asset.browser_download_url)
  if (url.origin !== 'https://github.com' || url.username || url.password || url.search || url.hash
    || !url.pathname.startsWith(`/${REPOSITORY}/releases/download/`)
    || !url.pathname.endsWith('/Dict-Sqlite.db')) {
    throw new Error('Unexpected dictionary download URL')
  }
  if (asset.digest && !/^sha256:[a-f0-9]{64}$/i.test(asset.digest)) {
    throw new Error('Invalid release asset digest')
  }
  const result = {
    repository: REPOSITORY, tag: release.tag_name, publishedAt: published.toISOString(),
    assetId: asset.id, url: url.href, size: asset.size, digest: asset.digest?.toLowerCase() ?? null,
  }
  result.unchanged = installed?.tag === result.tag && installed?.assetId === result.assetId
    && installed?.digest === result.digest
  return result
}

export async function verifyDownload(file, manifest) {
  if (fs.statSync(file).size !== manifest.size) throw new Error('Dictionary download size mismatch')
  const hash = createHash('sha256')
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk)
  const digest = `sha256:${hash.digest('hex')}`
  if (manifest.digest && digest !== manifest.digest) throw new Error('Dictionary SHA-256 mismatch')
  return digest
}

export function prepareDictionary(file) {
  const db = new DatabaseSync(file)
  try {
    db.exec('PRAGMA trusted_schema = OFF; PRAGMA journal_mode = DELETE;')
    if (db.prepare('PRAGMA quick_check').get().quick_check !== 'ok') throw new Error('SQLite quick_check failed')
    const columns = new Set(db.prepare('PRAGMA table_info(dict)').all().map((item) => item.name.toLowerCase()))
    for (const column of ['id', 'origin_name', 'trans_name', 'modid', 'key', 'version', 'curseforge']) {
      if (!columns.has(column)) throw new Error(`Dictionary is missing column ${column}`)
    }
    const rows = db.prepare('SELECT COUNT(*) AS total FROM dict').get().total
    if (!rows) throw new Error('Dictionary is empty')
    db.exec(`
      DROP TABLE IF EXISTS dict_fts;
      CREATE VIRTUAL TABLE dict_fts USING fts5(
        origin_name, trans_name, modid, key, version, curseforge,
        content='dict', content_rowid='ID'
      );
      INSERT INTO dict_fts(dict_fts) VALUES('rebuild');
      INSERT INTO dict_fts(dict_fts) VALUES('integrity-check');
      ANALYZE;
    `)
    for (const query of ['origin_name:door*', 'trans_name:门*']) {
      if (!db.prepare('SELECT COUNT(*) AS total FROM dict_fts WHERE dict_fts MATCH ?').get(query).total) {
        throw new Error(`Dictionary search validation failed: ${query}`)
      }
    }
    if (db.prepare('PRAGMA quick_check').get().quick_check !== 'ok') throw new Error('Indexed SQLite quick_check failed')
    return { rows, bytes: fs.statSync(file).size }
  } finally {
    db.close()
  }
}

export function checkpointDictionary(file) {
  if (!fs.existsSync(file)) return
  const db = new DatabaseSync(file)
  try {
    db.exec('PRAGMA busy_timeout = 5000;')
    if (db.prepare('PRAGMA wal_checkpoint(TRUNCATE)').get().busy) throw new Error('Dictionary is still in use')
    db.exec('PRAGMA journal_mode = DELETE;')
  } finally {
    db.close()
  }
}

export async function verifyHealth(origin = 'http://127.0.0.1:8787') {
  let baseline
  for (const version of ['0', '1', '2', '999']) {
    const url = new URL('/api/dict/search', origin)
    url.search = new URLSearchParams({ q: 'door', page: '1', mode: 'en2zh', source: 'extended', v: version })
    const response = await fetch(url, {
      headers: { Host: 'dict.vmct.top', 'X-Forwarded-Proto': 'https' },
      signal: AbortSignal.timeout(15000),
    })
    if (!response.ok) throw new Error(`Dictionary API returned ${response.status}`)
    const result = await response.json()
    if (!Array.isArray(result.results) || !result.results.length || !(result.total > 0)) {
      throw new Error('Dictionary API returned empty search results')
    }
    const serialized = JSON.stringify({ results: result.results, total: result.total })
    if (baseline && serialized !== baseline) throw new Error('Dictionary API results differ between v parameters')
    baseline = serialized
  }
  const result = JSON.parse(baseline)
  return { rows: result.results.length, total: result.total }
}

async function main([command, file, manifestFile, stateFile]) {
  if (command === 'select') {
    const installed = stateFile && fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, 'utf8')) : null
    const manifest = selectRelease(JSON.parse(fs.readFileSync(file, 'utf8')), installed)
    fs.writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`)
    console.log(`${manifest.tag}: ${manifest.unchanged ? 'already installed' : 'update available'}`)
  } else if (command === 'verify') {
    console.log(await verifyDownload(file, JSON.parse(fs.readFileSync(manifestFile, 'utf8'))))
  } else if (command === 'prepare') {
    console.log(JSON.stringify(prepareDictionary(file)))
  } else if (command === 'checkpoint') {
    checkpointDictionary(file)
  } else if (command === 'health') {
    console.log(JSON.stringify(await verifyHealth(file)))
  } else {
    throw new Error('Usage: dictionary-update.mjs select|verify|prepare|checkpoint|health [file] [manifest] [state]')
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error.message)
    process.exitCode = error.exitCode || 1
  })
}
