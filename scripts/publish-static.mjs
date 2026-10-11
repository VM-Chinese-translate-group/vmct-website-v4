import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { pathToFileURL } from 'node:url'

async function checkRelease(id) {
  const origin = process.env.SITE_HEALTH_ORIGIN || 'http://127.0.0.1'
  const headers = { Host: 'www.vmct.top', 'Cache-Control': 'no-cache' }
  const marker = await fetch(`${origin}/.vmct-release.json?v=${id}`, {
    headers, signal: AbortSignal.timeout(10000), redirect: 'error',
  })
  if (!marker.ok || (await marker.json()).id !== id)
    throw new Error('Nginx 未提供刚发布的版本；检查宿主机挂载和站点 root')
  const home = await fetch(`${origin}/?release=${id}`, {
    headers, signal: AbortSignal.timeout(10000), redirect: 'error',
  })
  if (!home.ok || !(await home.text()).trim()) throw new Error('站点首页健康检查失败')
}

// Caller holds .vmct-deploy.lock for the complete build and publication.
export async function publishStatic({ source, target, health = checkRelease }) {
  source = path.resolve(source)
  target = path.resolve(target)
  const index = await fs.stat(path.join(source, 'index.html'))
  if (!index.isFile() || index.size === 0) throw new Error('构建产物缺少有效 index.html')
  const parent = path.dirname(target)
  const releases = path.join(parent, `.${path.basename(target)}-releases`)
  await fs.mkdir(releases, { recursive: true })
  const existing = await fs.lstat(target).catch((e) => {
    if (e.code !== 'ENOENT') throw e
    return null
  })
  if (existing && !existing.isSymbolicLink())
    throw new Error('发布目标必须是符号链接，请先执行持久化迁移')
  const previous = existing ? await fs.readlink(target) : null
  const id = `${Date.now()}-${randomUUID()}`
  const release = path.join(releases, id)
  const staging = `${release}.staging`
  const pending = `${target}.${id}.link`
  let switched = false
  try {
    await fs.cp(source, staging, { recursive: true, dereference: true })
    // Server rendering output is build machinery, not a public web asset.
    await fs.rm(path.join(staging, 'server'), { recursive: true, force: true })
    await fs.writeFile(path.join(staging, '.vmct-release.json'), JSON.stringify({ id }))
    await fs.rename(staging, release)
    await fs.symlink(path.relative(parent, release), pending)
    await fs.rename(pending, target)
    switched = true
    await health(id)
  } catch (error) {
    if (switched) {
      if (previous !== null) {
        await fs.symlink(previous, pending)
        await fs.rename(pending, target)
      } else {
        await fs.unlink(target)
      }
    }
    await fs.rm(staging, { recursive: true, force: true })
    await fs.rm(pending, { force: true })
    await fs.rm(release, { recursive: true, force: true })
    throw error
  }
  // Cleanup failure must not turn a successful publication into a failure.
  try {
    const entries = (await fs.readdir(releases)).filter((name) =>
      /^\d+-[0-9a-f-]+$/.test(name)).sort().reverse()
    const protectedPaths = new Set([release,
      previous === null ? '' : path.resolve(parent, previous)])
    for (const name of entries.slice(5)) {
      const item = path.join(releases, name)
      if (!protectedPaths.has(item)) await fs.rm(item, { recursive: true, force: true })
    }
  } catch (error) {
    console.warn('发布成功，历史版本清理失败：', error.message)
  }
  return id
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await publishStatic({
    source: process.argv[2] || path.resolve('dist'),
    target: process.env.NGINX_STATIC_ROOT || '/home/vmct/vmpm/dist/www.vmct.top',
  })
}
