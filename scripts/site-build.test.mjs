import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { spawnSync, execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const unpack = fileURLToPath(new URL('./unpack-site-build.mjs', import.meta.url))
const hash = value => createHash('sha256').update(value).digest('hex')
test('prebuilt release validates checksum, revision and file types before installing', { skip: process.platform !== 'linux' }, async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'vmct-build-test-'))
  t.after(async () => {
    assert.equal(path.dirname(root), path.resolve(os.tmpdir()))
    await fs.rm(root, { recursive: true, force: true })
  })
  const app = path.join(root, 'app'), source = path.join(root, 'source'), archive = path.join(root, 'site.tar.gz')
  const commit = 'a'.repeat(40), files = {}
  for (const [file, value] of Object.entries({ 'dist/index.html': 'browser', 'dist/.vite/ssr-manifest.json': '{}', 'dist/server/entry-server.js': 'renderer', 'server/generated/content-api.mjs': 'api' })) {
    await fs.mkdir(path.dirname(path.join(source, file)), { recursive: true })
    await fs.writeFile(path.join(source, file), value)
    files[file] = hash(value)
  }
  await fs.writeFile(path.join(source, 'site-build.json'), JSON.stringify({ commit, files }))
  const target = path.join(app, '.site-releases', commit + '-1')
  await fs.mkdir(target, { recursive: true })
  const pack = async () => {
    execFileSync('tar', ['-czf', archive, '-C', source, '.'])
    return hash(await fs.readFile(archive))
  }
  const install = checksum => spawnSync(process.execPath, [unpack, archive, target, checksum, commit], { cwd: app, encoding: 'utf8' })
  const checksum = await pack()
  assert.notEqual(install('0'.repeat(64)).status, 0)
  assert.deepEqual(await fs.readdir(target), [])
  await fs.writeFile(path.join(source, 'site-build.json'), JSON.stringify({ commit: 'b'.repeat(40), files }))
  assert.notEqual(install(await pack()).status, 0)
  assert.deepEqual(await fs.readdir(target), [])
  await fs.writeFile(path.join(source, 'site-build.json'), JSON.stringify({ commit, files }))
  await fs.writeFile(path.join(root, 'outside'), 'must stay unchanged')
  await fs.symlink(path.join(root, 'outside'), path.join(source, 'dist', 'linked.js'))
  assert.notEqual(install(await pack()).status, 0)
  assert.equal(await fs.readFile(path.join(root, 'outside'), 'utf8'), 'must stay unchanged')
  await fs.unlink(path.join(source, 'dist', 'linked.js'))
  const result = install(await pack())
  assert.equal(result.status, 0, result.stderr)
  assert.equal(await fs.readFile(path.join(target, 'index.html'), 'utf8'), 'browser')
  assert.equal(await fs.readFile(path.join(app, 'server/generated/content-api.mjs'), 'utf8'), 'api')
})
