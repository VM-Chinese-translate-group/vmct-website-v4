import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'vmct-update-'))
  t.after(() => fs.rm(root, { recursive: true, force: true }))
  await fs.mkdir(path.join(root, '.git'))
  await fs.mkdir(path.join(root, 'server'))
  await fs.mkdir(path.join(root, 'bin'))
  await fs.writeFile(path.join(root, 'bin/git'), `#!/usr/bin/env bash
case " $* " in
  *" fetch "*) exit 0 ;;
  *" rev-parse "*) echo aabbccdd ;;
  *" diff "*) exit 0 ;;
  *) echo "unexpected git operation" >&2; exit 99 ;;
esac
`, { mode: 0o755 })
  await fs.writeFile(path.join(root, 'server/deploy-ecs.sh'), `#!/usr/bin/env bash
echo attempt >>"$APP_DIR/attempts"
[[ \${DEPLOY_TEST_FAIL:-0} == 0 ]] || exit 42
echo aabbccdd >"$DEPLOY_STATE_FILE"
`)
  const env = { ...process.env, PATH: `${root}/bin:${process.env.PATH}`,
    APP_DIR: root, DEPLOY_STATE_FILE: path.join(root, 'deployed-revision') }
  const update = (extra = {}) => spawnSync('bash', [
    new URL('../server/update-ecs.sh', import.meta.url).pathname,
  ], { env: { ...env, ...extra }, encoding: 'utf8' })
  return { root, env, update }
}

test('retry deployment after failed build even when git already fetched latest SHA', async (t) => {
  const { root, env, update } = await fixture(t)
  assert.equal(update({ DEPLOY_TEST_FAIL: '1' }).status, 42)
  await assert.rejects(fs.stat(env.DEPLOY_STATE_FILE), { code: 'ENOENT' })
  assert.equal(update().status, 0)
  assert.equal((await fs.readFile(path.join(root, 'attempts'), 'utf8')).trim().split('\n').length, 2)
  assert.equal((await fs.readFile(env.DEPLOY_STATE_FILE, 'utf8')).trim(), 'aabbccdd')
})

test('skip a version only after a successful deployment', async (t) => {
  const { root, update } = await fixture(t)
  assert.equal(update().status, 0)
  assert.equal(update().status, 0)
  assert.equal((await fs.readFile(path.join(root, 'attempts'), 'utf8')).trim(), 'attempt')
})
