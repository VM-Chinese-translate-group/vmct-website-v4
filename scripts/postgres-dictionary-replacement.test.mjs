import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { DatabaseSync } from 'node:sqlite'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createPostgresPool } from '../server/postgres.mjs'
import { dictionarySchemas, dictionaryAvailable, replaceDictionary, rollbackDictionary } from './migrate-postgres.mjs'

const quote = value => '"' + value.replaceAll('"', '""') + '"'
const project = fileURLToPath(new URL('../', import.meta.url))
const migrationModule = new URL('./migrate-postgres.mjs', import.meta.url).href
const postgresModule = new URL('../server/postgres.mjs', import.meta.url).href
const pgEnabled = Boolean(process.env.VMCT_DATABASE_URL)

function fixture(file, prefix, count = 55) {
  const db = new DatabaseSync(file)
  try {
    db.exec(`CREATE TABLE dict (ID INTEGER PRIMARY KEY, ORIGIN_NAME TEXT NOT NULL,
      TRANS_NAME TEXT NOT NULL, MODID TEXT NOT NULL, KEY TEXT NOT NULL,
      VERSION TEXT NOT NULL, CURSEFORGE TEXT NOT NULL)`)
    const insert = db.prepare('INSERT INTO dict VALUES(?,?,?,?,?,?,?)')
    for (let i = 0; i < count; i++)
      insert.run(i + 1, `${prefix} Door ${i}`, `${prefix}门 ${i}`, 'testmod', `door.${i}`, '1.0', 'testmod')
  } finally { db.close() }
}

async function isolated(t, label) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vmct-dictionary-pg-test-'))
  const schema = `dictionary_${label}_${process.pid}_${Date.now()}`
  assert.notEqual(schema, 'dictionary')
  const names = dictionarySchemas(schema)
  const pool = createPostgresPool(process.env.VMCT_DATABASE_URL)
  const client = await pool.connect()
  t.after(async () => {
    try {
      await client.query('ROLLBACK')
      for (const name of Object.values(names)) await client.query(`DROP SCHEMA IF EXISTS ${quote(name)} CASCADE`)
    } finally {
      client.release(); await pool.end(); fs.rmSync(dir, { recursive: true, force: true })
    }
  })
  assert.ok((await client.query("SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname='pg_trgm') AS installed")).rows[0].installed,
    'Integration database must already have pg_trgm installed')
  return { dir, schema, names, pool, client }
}

test('dictionary replacement names reject unrelated schemas', () => {
  assert.throws(() => dictionarySchemas('public'), /Invalid/)
  assert.throws(() => dictionarySchemas('dictionary; DROP SCHEMA content'), /Invalid/)
  assert.throws(() => dictionarySchemas('dictionary_' + 'a'.repeat(50)), /Invalid/)
})

test('PostgreSQL replacement, interrupted swap retry, rollback and index status use isolated schemas',
  { skip: !pgEnabled }, async t => {
    const { dir, schema, names, pool, client } = await isolated(t, 'swap_test')
    const old = path.join(dir, 'old.sqlite'), next = path.join(dir, 'next.sqlite')
    const newer = path.join(dir, 'newer.sqlite'), empty = path.join(dir, 'empty.sqlite')
    fixture(old, 'Old'); fixture(next, 'Next'); fixture(newer, 'Newer', 60); fixture(empty, 'Empty', 0)
    const firstName = async name => (await client.query(`SELECT origin_name FROM ${quote(name)}.dict ORDER BY id LIMIT 1`)).rows[0].origin_name
    assert.equal(await dictionaryAvailable(client, schema), false)
    assert.equal((await replaceDictionary(client, old, { schema })).hadPrevious, false)
    assert.equal(await dictionaryAvailable(client, schema), true)
    await replaceDictionary(client, next, { schema })
    assert.equal(await firstName(schema), 'Next Door 0')
    assert.equal(await firstName(names.previous), 'Old Door 0')
    const blocker = await pool.connect()
    try {
      await blocker.query('BEGIN')
      await blocker.query(`LOCK TABLE ${quote(names.previous)}.dict IN ACCESS EXCLUSIVE MODE`)
      await assert.rejects(replaceDictionary(client, newer, { schema, lockTimeoutMs: 100 }), /lock timeout/)
      assert.equal(await firstName(schema), 'Next Door 0')
      assert.equal(await dictionaryAvailable(client, names.next), true)
    } finally { await blocker.query('ROLLBACK'); blocker.release() }
    await replaceDictionary(client, newer, { schema })
    assert.equal(await firstName(schema), 'Newer Door 0')
    assert.equal(await firstName(names.previous), 'Next Door 0')
    await rollbackDictionary(client, { schema })
    assert.equal(await firstName(schema), 'Next Door 0')
    assert.equal(await firstName(names.failed), 'Newer Door 0')
    await assert.rejects(rollbackDictionary(client, { schema }), /No verified previous/)
    assert.equal(await firstName(schema), 'Next Door 0')
    await assert.rejects(replaceDictionary(client, empty, { schema }), /empty/)
    assert.equal(await firstName(schema), 'Next Door 0')
    await client.query(`DROP INDEX ${quote(schema)}.dict_trans_search_idx`)
    assert.equal(await dictionaryAvailable(client, schema), false)
    await replaceDictionary(client, next, { schema })
    assert.equal(await dictionaryAvailable(client, schema), true)
  })

test('Concurrent PostgreSQL replacements retain the session lock between candidate commit and schema swap',
  { skip: !pgEnabled }, async t => {
    const { dir, schema, names, pool, client } = await isolated(t, 'parallel_test')
    const old = path.join(dir, 'old.sqlite'), firstFile = path.join(dir, 'first.sqlite')
    const secondFile = path.join(dir, 'second.sqlite')
    fixture(old, 'Old'); fixture(firstFile, 'First'); fixture(secondFile, 'Second')
    await replaceDictionary(client, old, { schema })
    const other = await pool.connect()
    const pid = (await other.query('SELECT pg_backend_pid() AS pid')).rows[0].pid
    let readyResolve, readyReject, releaseCandidate
    const ready = new Promise((resolve, reject) => { readyResolve = resolve; readyReject = reject })
    const released = new Promise(resolve => { releaseCandidate = resolve })
    let gated = false
    const gatedClient = {
      query(...args) {
        // COPY query objects must retain their synchronous stream return value.
        const result = client.query(...args)
        if (args[0] === 'COMMIT' && !gated) {
          gated = true
          return result.then(async value => { readyResolve(); await released; return value })
        }
        return result
      },
    }
    const first = replaceDictionary(gatedClient, firstFile, { schema })
    first.catch(readyReject)
    let second
    try {
      await ready
      second = replaceDictionary(other, secondFile, { schema })
      second.catch(() => {})
      let blocked = false
      const deadline = Date.now() + 5000
      while (Date.now() < deadline) {
        const activity = (await client.query('SELECT wait_event_type,wait_event FROM pg_stat_activity WHERE pid=$1', [pid])).rows[0]
        if (activity?.wait_event_type === 'Lock' && activity.wait_event === 'advisory') { blocked = true; break }
        await new Promise(resolve => setTimeout(resolve, 10))
      }
      assert.equal(blocked, true, 'Second migration must wait while the first candidate is committed')
      assert.equal((await client.query(`SELECT origin_name FROM ${quote(names.next)}.dict ORDER BY id LIMIT 1`)).rows[0].origin_name, 'First Door 0')
      releaseCandidate()
      await first
      await second
      assert.equal((await client.query(`SELECT origin_name FROM ${quote(schema)}.dict ORDER BY id LIMIT 1`)).rows[0].origin_name, 'Second Door 0')
      assert.equal((await client.query(`SELECT origin_name FROM ${quote(names.previous)}.dict ORDER BY id LIMIT 1`)).rows[0].origin_name, 'First Door 0')
    } finally {
      releaseCandidate()
      await Promise.allSettled([first, second].filter(Boolean))
      other.release()
    }
  })

test('Linux PostgreSQL updater retries startup, skips without SQLite, repairs indexes and preserves state on failure',
  { skip: !pgEnabled || process.platform !== 'linux' }, async t => {
    const { dir, schema, names, client } = await isolated(t, 'shell_test')
    const data = path.join(dir, 'data'), bin = path.join(dir, 'bin'), scripts = path.join(dir, 'scripts')
    for (const folder of [data, bin, scripts]) fs.mkdirSync(folder)
    const old = path.join(dir, 'old.sqlite'), asset = path.join(dir, 'asset.sqlite')
    fixture(old, 'Old'); fixture(asset, 'Next')
    await replaceDictionary(client, old, { schema })
    const releaseFile = path.join(dir, 'release.json'), logFile = path.join(dir, 'commands.log')
    function release(id) {
      const bytes = fs.readFileSync(asset)
      return { tag_name: `test-${id}`, published_at: new Date().toISOString(), assets: [{
        id, name: 'Dict-Sqlite.db', size: bytes.length,
        digest: `sha256:${createHash('sha256').update(bytes).digest('hex')}`,
        browser_download_url: `https://github.com/VM-Chinese-translate-group/i18n-Dict-Extender/releases/download/test-${id}/Dict-Sqlite.db`,
      }] }
    }
    fs.writeFileSync(releaseFile, JSON.stringify(release(123)))
    fs.copyFileSync(path.join(project, 'scripts/dictionary-update.mjs'), path.join(scripts, 'dictionary-update.mjs'))
    // Invoke real migration functions with a unique namespace; no canonical
    // dictionary schema or real system service is touched by this test.
    fs.writeFileSync(path.join(scripts, 'migrate-postgres.mjs'), `
import fs from 'node:fs';
import { createPostgresPool } from ${JSON.stringify(postgresModule)};
import { dictionaryAvailable, replaceDictionary, rollbackDictionary } from ${JSON.stringify(migrationModule)};
const schema=process.env.TEST_DICTIONARY_SCHEMA;
if (!schema?.startsWith('dictionary_shell_test_')) throw new Error('Test schema required');
const pool=createPostgresPool(process.env.VMCT_DATABASE_URL), client=await pool.connect();
const command=process.argv[2];
fs.appendFileSync(process.env.TEST_LOG, 'migration '+command+'\\n');
try {
  if (command==='--dictionary-status') { if (!await dictionaryAvailable(client,schema)) process.exitCode=1; }
  else if (command==='--dictionary') await replaceDictionary(client,process.argv[3],{schema});
  else if (command==='--dictionary-rollback') await rollbackDictionary(client,{schema});
  else throw new Error('Unexpected test command');
} catch(error) { console.error(error.message); process.exitCode=1; }
finally { client.release(); await pool.end(); }
`)
    fs.writeFileSync(path.join(bin, 'curl'), `#!/usr/bin/env bash
set -eu
echo curl >> "$TEST_LOG"
output=''; url=''
while [[ $# -gt 0 ]]; do
  case "$1" in
    --output) output="$2"; shift 2 ;;
    https://*) url="$1"; shift ;;
    *) shift ;;
  esac
done
if [[ "$url" == *api.github.com* ]]; then cp "$TEST_RELEASE" "$output"; else cp "$TEST_ASSET" "$output"; fi
`, { mode: 0o755 })
    fs.writeFileSync(path.join(bin, 'systemctl'), '#!/usr/bin/env bash\necho "systemctl $*" >> "$TEST_LOG"\n', { mode: 0o755 })
    let mode = 'startup', requests = 0
    const server = createServer((_request, response) => {
      if (mode === 'failed' || mode === 'startup' && requests++ === 0) {
        response.writeHead(503); response.end(); return
      }
      response.setHeader('Content-Type', 'application/json')
      response.end(JSON.stringify({ results: [{ origin_name: 'door' }], total: 55 }))
    })
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    t.after(() => new Promise(resolve => server.close(resolve)))
    const origin = `http://127.0.0.1:${server.address().port}`
    const run = () => new Promise(resolve => {
      const child = spawn('bash', [path.join(project, 'server/update-dictionary.sh')], {
        env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, APP_DIR: dir, VMCT_DATA_DIR: data,
          VMCT_DATABASE_BACKEND: 'postgres', DICTIONARY_API_ORIGIN: origin, DICTIONARY_HEALTH_ATTEMPTS: '2',
          TEST_DICTIONARY_SCHEMA: schema, TEST_RELEASE: releaseFile, TEST_ASSET: asset, TEST_LOG: logFile },
      })
      let output = ''
      child.stdout.on('data', chunk => { output += chunk })
      child.stderr.on('data', chunk => { output += chunk })
      child.on('close', code => resolve({ code, output }))
    })
    const firstName = async name => (await client.query(`SELECT origin_name FROM ${quote(name)}.dict ORDER BY id LIMIT 1`)).rows[0].origin_name
    const first = await run()
    assert.equal(first.code, 0, first.output)
    assert.equal(await firstName(schema), 'Next Door 0')
    assert.equal(await firstName(names.previous), 'Old Door 0')
    assert.ok(!fs.existsSync(path.join(data, 'dictionary.sqlite')))
    let state = fs.readFileSync(path.join(data, 'dictionary-release.json'), 'utf8')
    mode = 'ready'; fs.writeFileSync(logFile, '')
    const skipped = await run()
    assert.equal(skipped.code, 0, skipped.output)
    assert.match(fs.readFileSync(logFile, 'utf8'), /migration --dictionary-status/)
    assert.doesNotMatch(fs.readFileSync(logFile, 'utf8'), /systemctl|migration --dictionary\n/)
    await client.query(`DROP INDEX ${quote(schema)}.dict_trans_search_idx`)
    const repaired = await run()
    assert.equal(repaired.code, 0, repaired.output)
    assert.equal(await dictionaryAvailable(client, schema), true)
    state = fs.readFileSync(path.join(data, 'dictionary-release.json'), 'utf8')
    const failedAsset = path.join(dir, 'failed.sqlite')
    fixture(failedAsset, 'Failed', 60); fs.copyFileSync(failedAsset, asset)
    fs.writeFileSync(releaseFile, JSON.stringify(release(124)))
    mode = 'failed'; fs.writeFileSync(logFile, '')
    const failure = await run()
    assert.notEqual(failure.code, 0)
    assert.match(failure.output, /restoring the previous PostgreSQL/)
    assert.equal(await firstName(schema), 'Next Door 0')
    assert.equal(await firstName(names.failed), 'Failed Door 0')
    assert.equal(fs.readFileSync(path.join(data, 'dictionary-release.json'), 'utf8'), state)
    assert.match(fs.readFileSync(logFile, 'utf8'), /migration --dictionary-rollback/)
  })
