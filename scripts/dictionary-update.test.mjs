import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'
import { test } from 'node:test'
import { latestScheduledStart, selectRelease, verifyDownload, prepareDictionary, checkpointDictionary, verifyHealth, REPOSITORY } from './dictionary-update.mjs'

const project = fileURLToPath(new URL('../', import.meta.url))
const fixtureSchema = `CREATE TABLE dict (
  ID INTEGER PRIMARY KEY, ORIGIN_NAME TEXT, TRANS_NAME TEXT, MODID TEXT,
  KEY TEXT, VERSION TEXT, CURSEFORGE TEXT
);`
function fixture(file, rows = 55) {
  const db = new DatabaseSync(file)
  db.exec(fixtureSchema)
  for (let i = 0; i < rows; i++) {
    db.prepare('INSERT INTO dict VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(i + 1, `Test Door ${i}`, `门 ${i}`, 'testmod', `door.${i}`, '1.0', 'testmod')
  }
  db.close()
}
function release(file, now = new Date()) {
  const bytes = fs.readFileSync(file)
  return {
    tag_name: 'dict-update-test', published_at: now.toISOString(),
    assets: [{ id: 123, name: 'Dict-Sqlite.db', size: bytes.length,
      digest: `sha256:${createHash('sha256').update(bytes).digest('hex')}`,
      browser_download_url: `https://github.com/${REPOSITORY}/releases/download/dict-update-test/Dict-Sqlite.db` }],
  }
}
function temp(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vmct-dictionary-test-'))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  return dir
}
async function http(t, handler) {
  const server = createServer(handler)
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  t.after(() => new Promise((resolve) => server.close(resolve)))
  return `http://127.0.0.1:${server.address().port}`
}

test('Friday scheduling, delayed release, asset validation and installed version', (t) => {
  const now = new Date('2026-10-09T11:00:00Z')
  assert.equal(latestScheduledStart(now).toISOString(), '2026-10-09T10:00:00.000Z')
  assert.equal(latestScheduledStart(new Date('2026-10-09T09:59:00Z')).toISOString(), '2026-10-02T10:00:00.000Z')
  assert.equal(latestScheduledStart(new Date('2026-10-11T23:00:00Z')).toISOString(), '2026-10-09T10:00:00.000Z')
  const file = path.join(temp(t), 'asset')
  fs.writeFileSync(file, 'fixture')
  const upstream = release(file, now)
  const manifest = selectRelease(upstream, null, now)
  assert.equal(manifest.unchanged, false)
  assert.equal(selectRelease(upstream, manifest, now).unchanged, true)
  assert.throws(() => selectRelease({ ...upstream, published_at: '2026-10-02T11:00:00Z' }, null, now), { exitCode: 75 })
  assert.throws(() => selectRelease({ ...upstream, draft: true }, null, now), /Invalid/)
  assert.throws(() => selectRelease({ ...upstream, assets: [] }, null, now), /missing/)
  for (const url of ['https://example.com/Dict-Sqlite.db', `https://github.com/other/repo/releases/download/test/Dict-Sqlite.db`]) {
    assert.throws(() => selectRelease({ ...upstream, assets: [{ ...upstream.assets[0], browser_download_url: url }] }, null, now), /Unexpected/)
  }
})

test('download integrity, native upstream schema and bilingual FTS', async (t) => {
  const file = path.join(temp(t), 'dictionary.sqlite')
  fixture(file)
  const manifest = selectRelease(release(file))
  assert.equal(await verifyDownload(file, manifest), manifest.digest)
  await assert.rejects(verifyDownload(file, { ...manifest, size: 1 }), /size mismatch/)
  await assert.rejects(verifyDownload(file, { ...manifest, digest: `sha256:${'0'.repeat(64)}` }), /SHA-256 mismatch/)
  assert.equal(prepareDictionary(file).rows, 55)
  // Rebuilding an existing index must be safe too.
  assert.equal(prepareDictionary(file).rows, 55)
  const db = new DatabaseSync(file)
  assert.equal(db.prepare("SELECT COUNT(*) AS total FROM dict_fts WHERE dict_fts MATCH 'trans_name:门*'").get().total, 55)
  db.close()
  const empty = path.join(path.dirname(file), 'empty.sqlite')
  fixture(empty, 0)
  assert.throws(() => prepareDictionary(empty), /empty/)
  const bad = path.join(path.dirname(file), 'wrong.sqlite')
  const wrong = new DatabaseSync(bad)
  wrong.exec('CREATE TABLE dict (id INTEGER)')
  wrong.close()
  assert.throws(() => prepareDictionary(bad), /missing column/)
})

test('checkpoint preserves WAL data before moving the database', (t) => {
  const file = path.join(temp(t), 'dictionary.sqlite')
  fixture(file, 1)
  const db = new DatabaseSync(file)
  db.exec("PRAGMA journal_mode=WAL; INSERT INTO dict VALUES (2, 'Door', '门', '', '', '', '')")
  db.close()
  checkpointDictionary(file)
  const reopened = new DatabaseSync(file)
  assert.equal(reopened.prepare('SELECT COUNT(*) AS total FROM dict').get().total, 2)
  assert.equal(reopened.prepare('PRAGMA journal_mode').get().journal_mode, 'delete')
  reopened.close()
})

test('health check rejects inconsistent v responses and failed HTTP requests', async (t) => {
  let mode = 'ok'
  const origin = await http(t, (request, response) => {
    const v = new URL(request.url, 'http://localhost').searchParams.get('v')
    if (mode === 'error') { response.writeHead(500); response.end(); return }
    response.setHeader('Content-Type', 'application/json')
    response.end(JSON.stringify({ results: [{ origin_name: 'door' }], total: mode === 'different' && v === '999' ? 2 : 1 }))
  })
  assert.deepEqual(await verifyHealth(origin), { rows: 1, total: 1 })
  mode = 'different'
  await assert.rejects(verifyHealth(origin), /differ/)
  mode = 'error'
  await assert.rejects(verifyHealth(origin), /500/)
})

test('Linux updater swaps successfully, skips installed data, preserves bad downloads and rolls back API failure', { skip: process.platform !== 'linux' }, async (t) => {
  const dir = temp(t)
  const data = path.join(dir, 'data')
  const bin = path.join(dir, 'bin')
  fs.mkdirSync(data)
  fs.mkdirSync(bin)
  const dbPath = path.join(data, 'dictionary.sqlite')
  const asset = path.join(dir, 'asset.sqlite')
  fixture(dbPath, 1)
  fixture(asset, 55)
  const releaseFile = path.join(dir, 'release.json')
  const logFile = path.join(dir, 'commands.log')
  fs.writeFileSync(releaseFile, JSON.stringify(release(asset)))
  fs.writeFileSync(path.join(bin, 'curl'), `#!/usr/bin/env bash
set -eu
echo curl >> "$TEST_LOG"
output=''
url=''
while [[ $# -gt 0 ]]; do
  case "$1" in
    --output) output="$2"; shift 2 ;;
    https://*) url="$1"; shift ;;
    *) shift ;;
  esac
done
if [[ "$url" == *api.github.com* ]]; then
  cp "$TEST_RELEASE" "$output"
else
  if [[ "\${TEST_DOWNLOAD_FAIL:-0}" == 1 ]]; then
    head -c 512 "$TEST_ASSET" > "$output"
    exit 28
  fi
  if [[ -f "$output" ]]; then echo resume >> "$TEST_LOG"; fi
  cp "$TEST_ASSET" "$output"
fi
`, { mode: 0o755 })
  fs.writeFileSync(path.join(bin, 'systemctl'), '#!/usr/bin/env bash\necho "systemctl $*" >> "$TEST_LOG"\n', { mode: 0o755 })
  // Production chown is exercised during deployment; the isolated test needs no root privileges.
  fs.writeFileSync(path.join(bin, 'chown'), '#!/usr/bin/env bash\nexit 0\n', { mode: 0o755 })
  let healthy = true
  const origin = await http(t, (_request, response) => {
    if (!healthy) { response.writeHead(500); response.end(); return }
    response.setHeader('Content-Type', 'application/json')
    response.end(JSON.stringify({ results: [{ origin_name: 'door' }], total: 55 }))
  })
  const run = (extra = {}) => new Promise((resolve) => {
    const child = spawn('bash', [path.join(project, 'server/update-dictionary.sh')], {
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, APP_DIR: dir,
        VMCT_DATA_DIR: data, DICTIONARY_API_ORIGIN: origin, DICTIONARY_HEALTH_ATTEMPTS: '1',
        TEST_RELEASE: releaseFile, TEST_ASSET: asset, TEST_LOG: logFile, ...extra },
    })
    let output = ''
    child.stdout.on('data', (chunk) => { output += chunk })
    child.stderr.on('data', (chunk) => { output += chunk })
    child.on('close', (code) => resolve({ code, output }))
  })
  fs.symlinkSync(path.join(project, 'scripts'), path.join(dir, 'scripts'))
  const count = (file) => {
    const db = new DatabaseSync(file)
    try { return db.prepare('SELECT COUNT(*) AS total FROM dict').get().total } finally { db.close() }
  }
  const interrupted = await run({ TEST_DOWNLOAD_FAIL: '1' })
  assert.notEqual(interrupted.code, 0)
  assert.equal(count(dbPath), 1)
  assert.equal(fs.statSync(path.join(data, '.dictionary-download/123.sqlite')).size, 512)
  assert.doesNotMatch(fs.readFileSync(logFile, 'utf8'), /systemctl/)
  const first = await run()
  assert.equal(first.code, 0, first.output)
  assert.equal(count(dbPath), 55)
  assert.equal(count(`${dbPath}.previous`), 1)
  const log = fs.readFileSync(logFile, 'utf8')
  assert.match(log, /resume/)
  assert.match(log, /systemctl stop vmct-website-api.service/)
  assert.match(log, /systemctl start vmct-website-api.service/)
  fs.writeFileSync(logFile, '')
  const second = await run()
  assert.equal(second.code, 0, second.output)
  assert.equal(fs.readFileSync(logFile, 'utf8'), 'curl\n')
  const upstream = release(asset)
  upstream.assets[0].id++
  upstream.assets[0].digest = `sha256:${'0'.repeat(64)}`
  fs.writeFileSync(releaseFile, JSON.stringify(upstream))
  fs.writeFileSync(logFile, '')
  const corrupt = await run()
  assert.notEqual(corrupt.code, 0)
  assert.match(corrupt.output, /SHA-256 mismatch/)
  assert.equal(count(dbPath), 55)
  assert.doesNotMatch(fs.readFileSync(logFile, 'utf8'), /systemctl/)
  fixture(path.join(dir, 'new.sqlite'), 60)
  fs.copyFileSync(path.join(dir, 'new.sqlite'), asset)
  const next = release(asset)
  next.assets[0].id++
  fs.writeFileSync(releaseFile, JSON.stringify(next))
  healthy = false
  const failure = await run()
  assert.notEqual(failure.code, 0)
  assert.match(failure.output, /restoring the previous/)
  assert.equal(count(dbPath), 55)
  assert.equal(JSON.parse(fs.readFileSync(path.join(data, 'dictionary-release.json'))).assetId, 123)
})
