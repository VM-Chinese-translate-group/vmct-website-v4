import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { spawn, spawnSync } from 'node:child_process'
import { once } from 'node:events'

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'vmct-update-'))
  t.after(() => fs.rm(root, { recursive: true, force: true }))
  await fs.mkdir(path.join(root, '.git'))
  await fs.mkdir(path.join(root, 'server'))
  await fs.mkdir(path.join(root, 'bin'))
  await fs.writeFile(path.join(root, 'current-day'), '2026-11-02\n')
  await fs.writeFile(path.join(root, 'quota-response'), JSON.stringify({ Quota: '100', Usage: '0' }))
  await fs.writeFile(path.join(root, 'bin/date'), `#!/usr/bin/env bash
[[ "$*" == '+%F' && "$TZ" == Asia/Shanghai ]] || exit 98
cat "$APP_DIR/current-day"
`, { mode: 0o755 })
  await fs.writeFile(path.join(root, 'bin/git'), `#!/usr/bin/env bash
case " $* " in
  *" fetch "*) echo fetch >>"$APP_DIR/events"; exit 0 ;;
  *" rev-parse "*) echo "$DEPLOY_TEST_REMOTE_REVISION" ;;
  *" diff "*) exit 0 ;;
  *" checkout "*|*" reset "*) echo "$*" >>"$APP_DIR/worktree-writes"; exit 0 ;;
  *) echo "unexpected git operation" >&2; exit 99 ;;
esac
`, { mode: 0o755 })
  await fs.writeFile(path.join(root, 'bin/aliyun'), `#!/usr/bin/env bash
set -Eeuo pipefail
case "$1 $2" in
  'esa GetPurgeQuota')
    echo quota >>"$APP_DIR/events"
    [[ \${DEPLOY_TEST_QUOTA_FAIL:-0} == 0 ]] || exit 44
    cat "$APP_DIR/quota-response"
    ;;
  'esa PurgeCaches')
    echo purge >>"$APP_DIR/events"
    echo purge >>"$APP_DIR/purges"
    printf '%s\\n' "$@" >"$APP_DIR/purge-args"
    # Opening the same file through a new descriptor must still be blocked.
    if flock -n "$APP_DIR/.vmct-deploy.lock" true; then exit 95; fi
    [[ \${DEPLOY_TEST_PURGE_FAIL:-0} == 0 ]] || exit 43
    if [[ -n \${DEPLOY_TEST_PURGE_RESPONSE:-} ]]; then
      printf '%s\\n' "$DEPLOY_TEST_PURGE_RESPONSE"
    else
      echo '{"TaskId":"purge-task"}'
    fi
    ;;
  *) echo 'unexpected aliyun operation' >&2; exit 97 ;;
esac
`, { mode: 0o755 })
  await fs.writeFile(path.join(root, 'server/deploy-ecs.sh'), `#!/usr/bin/env bash
set -Eeuo pipefail
echo "$DEPLOY_TEST_REMOTE_REVISION" >>"$APP_DIR/attempts"
echo deploy-start >>"$APP_DIR/events"
[[ \${DEPLOY_TEST_FAIL:-0} == 0 ]] || exit 42
echo "$DEPLOY_TEST_REMOTE_REVISION" >"$DEPLOY_STATE_FILE"
if [[ -n \${DEPLOY_TEST_DAY_AFTER_BUILD:-} ]]; then
  echo "$DEPLOY_TEST_DAY_AFTER_BUILD" >"$APP_DIR/current-day"
fi
if [[ -n \${DEPLOY_TEST_QUOTA_AFTER_BUILD:-} ]]; then
  echo "$DEPLOY_TEST_QUOTA_AFTER_BUILD" >"$APP_DIR/quota-response"
fi
echo deploy-complete >>"$APP_DIR/events"
`)
  const env = { ...process.env, PATH: `${root}/bin:${process.env.PATH}`,
    APP_DIR: root, DEPLOY_STATE_FILE: path.join(root, 'deployed-revision'),
    DEPLOY_TEST_REMOTE_REVISION: 'aabbccdd', ESA_SITE_ID: '123456',
    ESA_PURGE_STATE_FILE: path.join(root, 'esa-purge-state'),
    ESA_PURGE_PENDING_FILE: path.join(root, 'esa-purge-pending') }
  const update = (extra = {}) => spawnSync('bash', [
    new URL('../server/update-ecs.sh', import.meta.url).pathname,
  ], { env: { ...env, ...extra }, encoding: 'utf8' })
  const lines = async (name) => (await fs.readFile(path.join(root, name), 'utf8')).trim().split('\n')
  return { root, env, update, lines }
}

test('retry deployment after failed build even when git already fetched latest SHA', async (t) => {
  const { root, env, update, lines } = await fixture(t)
  assert.equal(update({ DEPLOY_TEST_FAIL: '1' }).status, 42)
  await assert.rejects(fs.stat(env.DEPLOY_STATE_FILE), { code: 'ENOENT' })
  await assert.rejects(fs.stat(env.ESA_PURGE_STATE_FILE), { code: 'ENOENT' })
  await assert.rejects(fs.stat(path.join(root, 'purges')), { code: 'ENOENT' })
  const result = update()
  assert.equal(result.status, 0, result.stderr)
  assert.deepEqual(await lines('attempts'), ['aabbccdd', 'aabbccdd'])
  assert.deepEqual(await lines('purges'), ['purge'])
  assert.equal((await fs.readFile(env.DEPLOY_STATE_FILE, 'utf8')).trim(), 'aabbccdd')
})

test('purge only after deployment completes, and skip an already deployed version', async (t) => {
  const { root, update, lines } = await fixture(t)
  const result = update({ ESA_CLI_PROFILE: 'ecs-esa', ESA_REGION: 'cn-shanghai', ESA_CLI_CONFIG_PATH: '/fixture/aliyun/config.json' })
  assert.equal(result.status, 0, result.stderr)
  assert.equal(update().status, 0)
  assert.deepEqual(await lines('attempts'), ['aabbccdd'])
  assert.deepEqual(await lines('events'), ['fetch', 'quota', 'deploy-start', 'deploy-complete', 'quota', 'purge', 'fetch'])
  const args = await lines('purge-args')
  for (const [flag, value] of Object.entries({
    '--SiteId': '123456', '--Type': 'purgeall', '--Content': '{"PurgeAll":true}',
    '--Force': 'true', '--retry-count': '0', '--version': '2024-09-10',
    '--profile': 'ecs-esa', '--region': 'cn-shanghai',
    '--config-path': '/fixture/aliyun/config.json',
  })) assert.equal(args[args.indexOf(flag) + 1], value, flag)
  await assert.rejects(fs.stat(path.join(root, 'esa-purge-pending')), { code: 'ENOENT' })
})

test('an existing release lock prevents checkout and deployment', async (t) => {
  const { root, update, lines } = await fixture(t)
  const holder = spawn('flock', [path.join(root, '.vmct-deploy.lock'), 'bash', '-c', 'echo locked; read -r done'], { stdio: ['pipe', 'pipe', 'pipe'] })
  t.after(() => holder.kill())
  await once(holder.stdout, 'data')
  const result = update()
  assert.equal(result.status, 0, result.stderr)
  await assert.rejects(fs.stat(path.join(root, 'attempts')), { code: 'ENOENT' })
  await assert.rejects(fs.stat(path.join(root, 'worktree-writes')), { code: 'ENOENT' })
  const closed = once(holder, 'close')
  holder.stdin.end('done\n')
  await closed
  assert.equal(update().status, 0)
  assert.deepEqual(await lines('attempts'), ['aabbccdd'])
})

test('allow the third daily purge, then coalesce multiple deferred updates into the next day latest revision', async (t) => {
  const { root, update, lines } = await fixture(t)
  for (const revision of ['release-1', 'release-2', 'release-3']) {
    const result = update({ DEPLOY_TEST_REMOTE_REVISION: revision })
    assert.equal(result.status, 0, result.stderr)
  }
  assert.deepEqual(await lines('esa-purge-state'), ['2026-11-02 123456 3'])
  const writesBefore = await lines('worktree-writes')
  for (const revision of ['deferred-1', 'deferred-2']) {
    const result = update({ DEPLOY_TEST_REMOTE_REVISION: revision })
    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /推迟到次日/)
  }
  assert.deepEqual(await lines('worktree-writes'), writesBefore)
  assert.deepEqual(await lines('attempts'), ['release-1', 'release-2', 'release-3'])
  assert.equal((await lines('purges')).length, 3)
  await fs.writeFile(path.join(root, 'current-day'), '2026-11-03\n')
  const result = update({ DEPLOY_TEST_REMOTE_REVISION: 'latest-next-day' })
  assert.equal(result.status, 0, result.stderr)
  assert.deepEqual(await lines('attempts'), ['release-1', 'release-2', 'release-3', 'latest-next-day'])
  assert.equal((await lines('purges')).length, 4)
  assert.deepEqual(await lines('esa-purge-state'), ['2026-11-03 123456 1'])
  assert.deepEqual(await lines('deployed-revision'), ['latest-next-day'])
})

test('ESA usage includes manual purges and defers before checkout when three slots are used', async (t) => {
  const { root, update } = await fixture(t)
  await fs.writeFile(path.join(root, 'quota-response'), JSON.stringify({ Quota: '100', Usage: '3' }))
  const result = update()
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /推迟到次日/)
  for (const name of ['worktree-writes', 'attempts', 'purges', 'esa-purge-pending']) {
    await assert.rejects(fs.stat(path.join(root, name)), { code: 'ENOENT' })
  }
})

test('respect a cloud quota smaller than the local three-per-day limit', async (t) => {
  const { root, update } = await fixture(t)
  await fs.writeFile(path.join(root, 'quota-response'), JSON.stringify({ Quota: '2', Usage: '2' }))
  const result = update()
  assert.equal(result.status, 0, result.stderr)
  await assert.rejects(fs.stat(path.join(root, 'worktree-writes')), { code: 'ENOENT' })
})

test('account for already used cloud slots even when local usage is lower', async (t) => {
  const { root, update, lines } = await fixture(t)
  await fs.writeFile(path.join(root, 'quota-response'), JSON.stringify({ Quota: '100', Usage: '2' }))
  const result = update()
  assert.equal(result.status, 0, result.stderr)
  assert.deepEqual(await lines('esa-purge-state'), ['2026-11-02 123456 3'])
  assert.equal(update({ DEPLOY_TEST_REMOTE_REVISION: 'next-release' }).status, 0)
  assert.deepEqual(await lines('attempts'), ['aabbccdd'])
  assert.deepEqual(await lines('purges'), ['purge'])
})

test('retry a failed purge without redeploying an already successful build', async (t) => {
  const { root, update, lines } = await fixture(t)
  const failed = update({ DEPLOY_TEST_PURGE_FAIL: '1' })
  assert.equal(failed.status, 1, failed.stderr)
  assert.deepEqual(await lines('deployed-revision'), ['aabbccdd'])
  assert.deepEqual(await lines('esa-purge-state'), ['2026-11-02 123456 1'])
  await fs.stat(path.join(root, 'esa-purge-pending'))
  const result = update()
  assert.equal(result.status, 0, result.stderr)
  assert.deepEqual(await lines('attempts'), ['aabbccdd'])
  assert.deepEqual(await lines('purges'), ['purge', 'purge'])
  assert.deepEqual(await lines('esa-purge-state'), ['2026-11-02 123456 2'])
  await assert.rejects(fs.stat(path.join(root, 'esa-purge-pending')), { code: 'ENOENT' })
})

test('ambiguous purge failures remain capped at three attempts and merge with a new version next day', async (t) => {
  const { root, update, lines } = await fixture(t)
  for (let attempt = 0; attempt < 3; attempt++) {
    assert.equal(update({ DEPLOY_TEST_PURGE_FAIL: '1' }).status, 1)
  }
  assert.equal(update({ DEPLOY_TEST_REMOTE_REVISION: 'deferred' }).status, 0)
  assert.deepEqual(await lines('attempts'), ['aabbccdd'])
  assert.equal((await lines('purges')).length, 3)
  await fs.writeFile(path.join(root, 'current-day'), '2026-11-03\n')
  const result = update({ DEPLOY_TEST_REMOTE_REVISION: 'latest-next-day' })
  assert.equal(result.status, 0, result.stderr)
  assert.deepEqual(await lines('attempts'), ['aabbccdd', 'latest-next-day'])
  assert.equal((await lines('purges')).length, 4)
})

test('reset usage when deployment crosses midnight in Beijing time', async (t) => {
  const { root, update, lines } = await fixture(t)
  await fs.writeFile(path.join(root, 'esa-purge-state'), '2026-11-02 123456 2\n')
  const result = update({ DEPLOY_TEST_DAY_AFTER_BUILD: '2026-11-03' })
  assert.equal(result.status, 0, result.stderr)
  assert.deepEqual(await lines('esa-purge-state'), ['2026-11-03 123456 1'])
})

test('retain a pending purge if an operator exhausts the quota during deployment', async (t) => {
  const { root, update, lines } = await fixture(t)
  const result = update({ DEPLOY_TEST_QUOTA_AFTER_BUILD: JSON.stringify({ Quota: '3', Usage: '3' }) })
  assert.equal(result.status, 0, result.stderr)
  assert.deepEqual(await lines('attempts'), ['aabbccdd'])
  await fs.stat(path.join(root, 'esa-purge-pending'))
  await assert.rejects(fs.stat(path.join(root, 'purges')), { code: 'ENOENT' })
  await fs.writeFile(path.join(root, 'current-day'), '2026-11-03\n')
  await fs.writeFile(path.join(root, 'quota-response'), JSON.stringify({ Quota: '3', Usage: '0' }))
  const retried = update()
  assert.equal(retried.status, 0, retried.stderr)
  assert.deepEqual(await lines('attempts'), ['aabbccdd'])
  assert.deepEqual(await lines('purges'), ['purge'])
})

test('do not deploy when quota lookup fails or returns malformed data', async (t) => {
  const { root, update } = await fixture(t)
  assert.equal(update({ DEPLOY_TEST_QUOTA_FAIL: '1' }).status, 1)
  for (const data of ['invalid-json', '{}', '{"Quota":"3","Usage":-1}', '{"Quota":"3","Usage":"unknown"}']) {
    await fs.writeFile(path.join(root, 'quota-response'), data)
    assert.equal(update().status, 1)
  }
  await assert.rejects(fs.stat(path.join(root, 'worktree-writes')), { code: 'ENOENT' })
})

test('do not deploy with missing site configuration or invalid persisted usage', async (t) => {
  const { root, update } = await fixture(t)
  assert.equal(update({ ESA_SITE_ID: '' }).status, 1)
  for (const data of ['invalid-state', '2026-11-02 123456 4', '2026-11-03 123456 1', '2026-11-02 999999 1']) {
    await fs.writeFile(path.join(root, 'esa-purge-state'), data)
    const result = update()
    assert.equal(result.status, 1, result.stderr)
  }
  await assert.rejects(fs.stat(path.join(root, 'worktree-writes')), { code: 'ENOENT' })
})

test('retain a pending purge when a successful CLI exit does not include a task ID', async (t) => {
  const { root, update } = await fixture(t)
  const result = update({ DEPLOY_TEST_PURGE_RESPONSE: '{}' })
  assert.equal(result.status, 1, result.stderr)
  await fs.stat(path.join(root, 'esa-purge-pending'))
  const retried = update()
  assert.equal(retried.status, 0, retried.stderr)
})

test('an unchanged site does not query ESA or require configuration', async (t) => {
  const { root, update, lines } = await fixture(t)
  await fs.writeFile(path.join(root, 'deployed-revision'), 'aabbccdd\n')
  const result = update({ ESA_SITE_ID: '', DEPLOY_TEST_QUOTA_FAIL: '1' })
  assert.equal(result.status, 0, result.stderr)
  assert.deepEqual(await lines('events'), ['fetch'])
  await assert.rejects(fs.stat(path.join(root, 'attempts')), { code: 'ENOENT' })
})

test('an unchanged site still runs backup retention before fetching', async t => {
  const { root, update, lines } = await fixture(t)
  await fs.writeFile(path.join(root, 'deployed-revision'), 'aabbccdd\n')
  await fs.writeFile(path.join(root, 'server/prune-backups.sh'), 'echo retention >>"$APP_DIR/events"\n')
  const result = update()
  assert.equal(result.status, 0, result.stderr)
  assert.deepEqual(await lines('events'), ['retention', 'fetch'])
})
