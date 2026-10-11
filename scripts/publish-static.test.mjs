import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import http from 'node:http'
import { publishStatic } from './publish-static.mjs'

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'vmct-publish-'))
  t.after(() => fs.rm(root, { recursive: true, force: true }))
  const source = path.join(root, 'dist')
  const target = path.join(root, 'mounted', 'www.vmct.top')
  await fs.mkdir(path.join(source, 'server'), { recursive: true })
  await fs.writeFile(path.join(source, 'index.html'), 'version-one')
  await fs.writeFile(path.join(source, 'server', 'entry.js'), 'private build output')
  return { source, target }
}

test('publish through mounted parent, preserve dict, omit server bundle', async (t) => {
  const { source, target } = await fixture(t)
  const dict = path.join(path.dirname(target), 'dict.vmct.top')
  await fs.mkdir(dict, { recursive: true })
  await fs.writeFile(path.join(dict, 'index.html'), 'dictionary')
  await publishStatic({ source, target, health: async (id) => {
    assert.equal(JSON.parse(await fs.readFile(path.join(target, '.vmct-release.json'))).id, id)
    assert.equal(await fs.readFile(path.join(target, 'index.html'), 'utf8'), 'version-one')
  } })
  assert.equal(await fs.readFile(path.join(dict, 'index.html'), 'utf8'), 'dictionary')
  await assert.rejects(fs.stat(path.join(target, 'server')), { code: 'ENOENT' })
  assert.ok(!path.isAbsolute(await fs.readlink(target)))
})

test('health failure restores previous release and removes failed release', async (t) => {
  const { source, target } = await fixture(t)
  await publishStatic({ source, target, health: async () => {} })
  const previous = await fs.readlink(target)
  await fs.writeFile(path.join(source, 'index.html'), 'version-two')
  await assert.rejects(publishStatic({ source, target, health: async () => {
    assert.equal(await fs.readFile(path.join(target, 'index.html'), 'utf8'), 'version-two')
    throw new Error('unhealthy')
  } }), /unhealthy/)
  assert.equal(await fs.readlink(target), previous)
  assert.equal(await fs.readFile(path.join(target, 'index.html'), 'utf8'), 'version-one')
  assert.equal((await fs.readdir(path.dirname(path.resolve(path.dirname(target), previous)))).length, 1)
})

test('invalid build leaves live release intact', async (t) => {
  const { source, target } = await fixture(t)
  await publishStatic({ source, target, health: async () => {} })
  const previous = await fs.readlink(target)
  await fs.writeFile(path.join(source, 'index.html'), '')
  await assert.rejects(publishStatic({ source, target, health: async () => {} }), /index.html/)
  assert.equal(await fs.readlink(target), previous)
})

test('failed first deployment removes broken live link', async (t) => {
  const { source, target } = await fixture(t)
  await assert.rejects(publishStatic({ source, target, health: async () => {
    throw new Error('unhealthy')
  } }), /unhealthy/)
  await assert.rejects(fs.lstat(target), { code: 'ENOENT' })
})

test('real HTTP health check selects the www virtual host and verifies release', async (t) => {
  const { source, target } = await fixture(t)
  const server = http.createServer(async (req, res) => {
    if (req.headers.host !== 'www.vmct.top') { req.socket.destroy(); return }
    const file = req.url.startsWith('/.vmct-release.json') ? '.vmct-release.json' : 'index.html'
    res.end(await fs.readFile(path.join(target, file)))
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const saved = process.env.SITE_HEALTH_ORIGIN
  process.env.SITE_HEALTH_ORIGIN = `http://127.0.0.1:${server.address().port}`
  t.after(() => {
    server.closeAllConnections(); server.close()
    if (saved === undefined) delete process.env.SITE_HEALTH_ORIGIN
    else process.env.SITE_HEALTH_ORIGIN = saved
  })
  await publishStatic({ source, target })
  assert.equal(await fs.readFile(path.join(target, 'index.html'), 'utf8'), 'version-one')
})
