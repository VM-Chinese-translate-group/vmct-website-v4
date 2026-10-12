import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const project = fileURLToPath(new URL('../', import.meta.url))
const deploy = fs.readFileSync(new URL('../server/deploy-ecs.sh', import.meta.url), 'utf8')
function section(start, end) {
  const from = deploy.indexOf(start)
  const until = deploy.indexOf(end, from)
  assert.ok(from >= 0 && until > from, 'the deployment guard section must exist')
  return deploy.slice(from, until)
}

// Execute the actual dictionary guards without invoking checkout, package
// installation, services, nginx or the rest of the production deployer.
const guardedSteps = section('# Read only the active backend', 'if [[ ! -f "${ENV_FILE}" ]]; then')
  + section('# Bootstrap a legacy dictionary', '${SUDO} install -m 0644 server/vmct-website-api.service')

function fixture(t, backend = 'postgres') {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'vmct-deploy-dictionary-'))
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
  const data = path.join(directory, 'data')
  fs.mkdirSync(data)
  const envFile = path.join(directory, 'private.env')
  if (backend !== 'bootstrap') fs.writeFileSync(envFile,
    (backend ? `VMCT_DATABASE_BACKEND=${backend}\n` : '')
    + 'VMCT_DATABASE_URL=fixture-private-url\nSITE_REBUILD_SECRET=fixture-private-secret\n', { mode: 0o600 })
  const prebuilt = path.join(directory, 'prebuilt.sqlite')
  const backup = path.join(directory, 'backup.sql')
  const database = path.join(data, 'dictionary.sqlite')
  const log = path.join(directory, 'commands.log')
  fs.writeFileSync(prebuilt, 'prebuilt-dictionary')
  fs.writeFileSync(backup, 'backup-fixture')
  fs.writeFileSync(log, '')
  const run = (extra = {}) => spawnSync('bash', ['-c', `set -Eeuo pipefail
SUDO=''
chown() { echo chown >> "$TEST_LOG"; }
node() {
  if [[ " $* " == *" scripts/import-dictionary.mjs "* ]]; then
    echo import >> "$TEST_LOG"
    printf imported-dictionary > "\${@: -1}"
  else
    command node "$@"
  fi
}
${guardedSteps}`], { cwd: project, encoding: 'utf8',
    env: { ...process.env, DATA_DIR: data, ENV_FILE: envFile, TEST_LOG: log,
      DICT_DB_FILE: '', DICT_BACKUP: '',
      // The private file must win over unrelated caller overrides.
      VMCT_DATABASE_BACKEND: backend === 'postgres' ? 'sqlite' : 'postgres',
      VMCT_DATABASE_URL: 'inherited-private-url', ...extra } })
  return { run, directory, data, database, prebuilt, backup, log }
}

const linuxOnly = { skip: process.platform !== 'linux' }

test('PG deployment skips both dictionary sources and preserves existing SQLite and WAL files', linuxOnly, t => {
  const { run, database, prebuilt, backup, log, directory } = fixture(t)
  for (const suffix of ['', '-wal', '-shm']) fs.writeFileSync(database + suffix, 'previous' + suffix)
  const first = run({ DICT_DB_FILE: prebuilt, DICT_BACKUP: backup })
  assert.equal(first.status, 0, first.stderr)
  for (const suffix of ['', '-wal', '-shm']) assert.equal(fs.readFileSync(database + suffix, 'utf8'), 'previous' + suffix)
  assert.equal(fs.readFileSync(log, 'utf8'), '')
  assert.doesNotMatch(first.stdout + first.stderr, /fixture-private|inherited-private/)

  // Neither a missing legacy database nor a nonexistent source should cause
  // PG deployment to create or import a SQLite dictionary.
  fs.rmSync(database)
  const second = run({ DICT_DB_FILE: path.join(directory, 'missing.sqlite'), DICT_BACKUP: backup })
  assert.equal(second.status, 0, second.stderr)
  assert.equal(fs.existsSync(database), false)
  assert.equal(fs.readFileSync(log, 'utf8'), '')
  assert.equal(fs.readFileSync(database + '-wal', 'utf8'), 'previous-wal')
})

test('explicit SQLite, a legacy env file and first bootstrap retain prebuilt dictionary installation', linuxOnly, async t => {
  for (const backend of ['sqlite', '', 'bootstrap']) await t.test(backend || 'legacy default', child => {
    const { run, database, prebuilt, backup, log } = fixture(child, backend)
    for (const suffix of ['', '-wal', '-shm']) fs.writeFileSync(database + suffix, 'previous')
    const result = run({ DICT_DB_FILE: prebuilt, DICT_BACKUP: backup })
    assert.equal(result.status, 0, result.stderr)
    assert.equal(fs.readFileSync(database, 'utf8'), 'prebuilt-dictionary')
    assert.equal(fs.existsSync(database + '-wal'), false)
    assert.equal(fs.existsSync(database + '-shm'), false)
    assert.equal(fs.readFileSync(log, 'utf8'), 'chown\n')
  })
})

test('SQLite deployment imports a backup only if no dictionary exists', linuxOnly, t => {
  const { run, database, backup, log } = fixture(t, 'sqlite')
  const first = run({ DICT_BACKUP: backup })
  assert.equal(first.status, 0, first.stderr)
  assert.equal(fs.readFileSync(database, 'utf8'), 'imported-dictionary')
  assert.equal(fs.readFileSync(log, 'utf8'), 'import\n')
  const second = run({ DICT_BACKUP: backup })
  assert.equal(second.status, 0, second.stderr)
  assert.equal(fs.readFileSync(log, 'utf8'), 'import\n')
})

test('an invalid private backend fails before touching SQLite dictionary files', linuxOnly, t => {
  const { run, database, prebuilt, log } = fixture(t, 'invalid')
  fs.writeFileSync(database, 'previous')
  const result = run({ DICT_DB_FILE: prebuilt })
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /VMCT_DATABASE_BACKEND/)
  assert.equal(fs.readFileSync(database, 'utf8'), 'previous')
  assert.equal(fs.readFileSync(log, 'utf8'), '')
  assert.doesNotMatch(result.stdout + result.stderr, /fixture-private|inherited-private/)
})
