import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { planRetention, applyRetention, backupPlans } from './prune-backups.mjs'

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'vmct-retention-'))
  t.after(() => fs.rm(root, { recursive: true, force: true }))
  async function version(directory, name, order) {
    const file = path.join(directory, name)
    await fs.mkdir(file, { recursive: true })
    await fs.writeFile(path.join(file, 'artifact'), name)
    await fs.utimes(file, 1700000000 + order, 1700000000 + order)
    return file
  }
  return { root, version }
}

test('preview leaves all files intact; apply keeps exactly the two newest versions', async t => {
  const { root, version } = await fixture(t)
  for (let i = 1; i <= 5; i++) await version(root, `version-${i}`, i)
  const plan = await planRetention(root)
  assert.deepEqual(plan.keep, ['version-5', 'version-4'])
  assert.equal((await fs.readdir(root)).length, 5)
  await applyRetention([plan])
  assert.deepEqual((await fs.readdir(root)).sort(), ['version-4', 'version-5'])
})

test('an older live and previous release take precedence over newer unused directories', async t => {
  const { root, version } = await fixture(t)
  const previous = await version(root, 'previous', 1)
  const live = await version(root, 'live', 2)
  await version(root, 'failed-build', 3)
  await version(root, 'unused-build', 4)
  const plan = await planRetention(root, { protectedPaths: [live, previous] })
  await applyRetention([plan])
  assert.deepEqual((await fs.readdir(root)).sort(), ['live', 'previous'])
})

test('clean independent collections separately, preserve data and only remove archives belonging to removed versions', async t => {
  const { root, version } = await fixture(t)
  const backups = path.join(root, '.backups')
  const releases = path.join(root, '.releases')
  for (const dir of [backups, releases]) {
    await version(dir, 'old', 1)
    await version(dir, 'middle', 2)
    await version(dir, 'latest', 3)
  }
  for (const name of ['old-resources.tar.gz', 'latest-resources.tar.gz', 'unrelated.bundle', 'private.env', 'standalone.sql'])
    await fs.writeFile(path.join(releases, name), name)
  await applyRetention([await planRetention(backups), await planRetention(releases, { archives: true })])
  assert.deepEqual((await fs.readdir(backups)).sort(), ['latest', 'middle'])
  assert.deepEqual((await fs.readdir(releases)).sort(), ['latest', 'latest-resources.tar.gz', 'middle', 'private.env', 'standalone.sql', 'unrelated.bundle'])
})

test('keep all collections with fewer than two versions and skip missing collections', async t => {
  const { root, version } = await fixture(t)
  await version(root, 'only', 1)
  const plans = [await planRetention(root), await planRetention(path.join(root, 'missing'))]
  await applyRetention(plans)
  assert.deepEqual(await fs.readdir(root), ['only'])
})

test('validate the entire plan before removing any directories if a candidate becomes a symlink', async t => {
  const { root, version } = await fixture(t)
  const releases = path.join(root, '.releases')
  const outside = await version(root, 'outside', 1)
  const old = await version(releases, 'old', 1)
  await version(releases, 'middle', 2)
  await version(releases, 'latest', 3)
  const plan = await planRetention(releases)
  await fs.rm(old, { recursive: true })
  await fs.symlink(outside, old, process.platform === 'win32' ? 'junction' : 'dir')
  await assert.rejects(applyRetention([plan]), /拒绝删除/)
  assert.equal(await fs.readFile(path.join(outside, 'artifact'), 'utf8'), 'outside')
  assert.equal((await fs.readdir(releases)).length, 3)
})

test('refuse a symlink collection root and ignore child symlinks', async t => {
  const { root, version } = await fixture(t)
  const outside = await version(root, 'outside', 1)
  const alias = path.join(root, 'alias')
  await fs.symlink(outside, alias, process.platform === 'win32' ? 'junction' : 'dir')
  await assert.rejects(planRetention(alias), /普通目录/)
  const plan = await planRetention(root)
  await applyRetention([plan])
  assert.equal(await fs.readFile(path.join(alias, 'artifact'), 'utf8'), 'outside')
})

test('project plan protects the active VMPM release and both healthy SSR generations', async t => {
  const { root, version } = await fixture(t)
  const appDir = path.join(root, 'website'), vmpmDir = path.join(root, 'vmpm')
  const current = await version(path.join(appDir, '.site-releases'), 'live', 2)
  const previous = await version(path.join(appDir, '.site-releases'), 'previous', 1)
  await version(path.join(appDir, '.site-releases'), 'failed-build', 3)
  await fs.mkdir(path.join(current, 'server'))
  await fs.writeFile(path.join(current, 'server', '.previous-release'), previous)
  await fs.symlink(current, path.join(appDir, 'dist'), process.platform === 'win32' ? 'junction' : 'dir')
  for (const dir of ['.backups', '.releases']) {
    await version(path.join(vmpmDir, dir), 'live', 1)
    await version(path.join(vmpmDir, dir), 'newer', 2)
    await version(path.join(vmpmDir, dir), 'newest', 3)
  }
  await fs.writeFile(path.join(vmpmDir, 'deploy-manifest.json'), JSON.stringify({ release: 'live' }))
  const stateDir = path.join(root, 'state')
  await version(stateDir, 'data', 1)
  for (let i = 1; i <= 3; i++) await version(stateDir, `persistence-backup.${i}`, i)
  await applyRetention(await backupPlans({ appDir, vmpmDir, stateDir,
    dataDir: path.join(root, 'data'), operationsDir: path.join(root, 'operations') }))
  assert.deepEqual((await fs.readdir(path.join(appDir, '.site-releases'))).sort(), ['live', 'previous'])
  assert.deepEqual((await fs.readdir(path.join(vmpmDir, '.backups'))).sort(), ['live', 'newest'])
  assert.deepEqual((await fs.readdir(stateDir)).sort(), ['data', 'persistence-backup.2', 'persistence-backup.3'])
})

test('the wrapper reuses an inherited website lock and skips busy website or VMPM releases', { skip: process.platform !== 'linux' }, async t => {
  const { root } = await fixture(t)
  const appDir = path.join(root, 'app'), vmpmDir = path.join(root, 'vmpm')
  await fs.mkdir(path.join(appDir, 'scripts'), { recursive: true })
  await fs.mkdir(vmpmDir)
  const marker = path.join(root, 'ran')
  await fs.writeFile(path.join(appDir, 'scripts/prune-backups.mjs'),
    'require("node:fs").writeFileSync(process.env.TEST_MARKER, "ran")'.replace('require("node:fs")', '(await import("node:fs")).default'))
  const wrapper = fileURLToPath(new URL('../server/prune-backups.sh', import.meta.url))
  const env = { ...process.env, APP_DIR: appDir, VMPM_DIR: vmpmDir, WRAPPER: wrapper, TEST_MARKER: marker }
  const cases = [
    ['exec 9>"$APP_DIR/.vmct-deploy.lock"; flock -n 9; bash "$WRAPPER" --apply', true],
    ['exec 10>"$APP_DIR/.vmct-deploy.lock"; flock -n 10; bash "$WRAPPER" --apply', false],
    ['exec 10>"$VMPM_DIR/.deploy.lock"; flock -n 10; bash "$WRAPPER" --apply', false],
  ]
  for (const [command, shouldRun] of cases) {
    await fs.rm(marker, { force: true })
    const result = spawnSync('bash', ['-c', command], { env, encoding: 'utf8' })
    assert.equal(result.status, 0, result.stderr)
    assert.equal(!!(await fs.stat(marker).catch(() => null)), shouldRun)
  }
})
