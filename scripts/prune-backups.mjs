import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const KEEP = 2

async function optionalStat(file) {
  return fs.lstat(file).catch(error => {
    if (error.code !== 'ENOENT') throw error
    return null
  })
}

// Each collection is independent. Live releases take priority over timestamps.
export async function planRetention(directory, { protectedPaths = [], include = () => true, archives = false } = {}) {
  directory = path.resolve(directory)
  const rootStat = await optionalStat(directory)
  if (!rootStat) return { directory, keep: [], remove: [] }
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error(`备份根目录必须是普通目录：${directory}`)
  directory = await fs.realpath(directory)
  const protectedSet = new Set(await Promise.all(protectedPaths.filter(Boolean).map(async file =>
    fs.realpath(file).catch(error => {
      if (error.code !== 'ENOENT') throw error
      return path.resolve(file)
    }))))
  const entries = await fs.readdir(directory, { withFileTypes: true })
  const versions = []
  for (const entry of entries) {
    if (!entry.isDirectory() || !include(entry.name)) continue
    const file = path.join(directory, entry.name)
    const stat = await fs.lstat(file)
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`备份候选已变化：${file}`)
    versions.push({ file, name: entry.name, mtime: stat.mtimeMs, dev: stat.dev, ino: stat.ino })
  }
  versions.sort((a, b) => b.mtime - a.mtime || b.name.localeCompare(a.name))
  const pinned = versions.filter(entry => protectedSet.has(entry.file))
  if (pinned.length > KEEP) throw new Error(`存在超过两份在用版本，停止清理：${directory}`)
  const keep = [...pinned, ...versions.filter(entry => !protectedSet.has(entry.file))].slice(0, KEEP)
  const remove = versions.filter(entry => !keep.includes(entry))
  if (archives && remove.length) {
    const removedNames = remove.map(entry => entry.name)
    for (const entry of entries) {
      if (!entry.isFile() || !/\.(?:tar\.gz|tar\.xz|tgz|zip|bundle|jar)$/.test(entry.name)
        || keep.some(version => entry.name.startsWith(`${version.name}-`) || entry.name.startsWith(`${version.name}.`))
        || !removedNames.some(name => entry.name.startsWith(`${name}-`) || entry.name.startsWith(`${name}.`))) continue
      const file = path.join(directory, entry.name)
      const stat = await fs.lstat(file)
      if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`归档候选已变化：${file}`)
      remove.push({ file, name: entry.name, dev: stat.dev, ino: stat.ino })
    }
  }
  return { directory, keep: keep.map(entry => entry.name), remove }
}

export async function applyRetention(plans) {
  // Validate every direct child before deleting anything. Never follow a link
  // substituted for a root or a candidate after the plan was generated.
  for (const plan of plans) {
    if (!plan.remove.length) continue
    const root = await fs.lstat(plan.directory)
    if (!root.isDirectory() || root.isSymbolicLink() || await fs.realpath(plan.directory) !== plan.directory)
      throw new Error(`备份根目录已变化：${plan.directory}`)
    for (const entry of plan.remove) {
      const stat = await fs.lstat(entry.file)
      if (path.dirname(entry.file) !== plan.directory || stat.isSymbolicLink()
        || stat.dev !== entry.dev || stat.ino !== entry.ino || await fs.realpath(entry.file) !== entry.file)
        throw new Error(`拒绝删除已变化的路径：${entry.file}`)
    }
  }
  for (const plan of plans) {
    for (const entry of plan.remove) await fs.rm(entry.file, { recursive: true })
  }
}

export async function pruneVersions(directory, options = {}) {
  const plan = await planRetention(directory, options)
  await applyRetention([plan])
  return plan
}

export async function backupPlans({ appDir = '/opt/vmct-website', vmpmDir = '/home/vmct/vmpm',
  dataDir = '/var/lib/vmct-website/data', stateDir = '/var/lib/vmct-website',
  operationsDir = '/var/backups/vmct-website', previousSiteRelease } = {}) {
  const manifestPath = path.join(vmpmDir, 'deploy-manifest.json')
  const manifestStat = await optionalStat(manifestPath)
  const release = manifestStat ? JSON.parse(await fs.readFile(manifestPath, 'utf8')).release : null
  if (release && (typeof release !== 'string' || path.basename(release) !== release || ['.', '..'].includes(release)))
    throw new Error('VMPM 在用版本标识无效')
  const previousMarker = path.join(appDir, 'dist', 'server', '.previous-release')
  if (!previousSiteRelease && await optionalStat(previousMarker)) previousSiteRelease = (await fs.readFile(previousMarker, 'utf8')).trim()
  const specs = [
    [path.join(vmpmDir, '.backups'), { protectedPaths: release ? [path.join(vmpmDir, '.backups', release)] : [] }],
    [path.join(vmpmDir, '.releases'), { archives: true, protectedPaths: release ? [path.join(vmpmDir, '.releases', release)] : [] }],
    [path.join(appDir, '.site-releases'), { protectedPaths: [path.join(appDir, 'dist'), previousSiteRelease] }],
    [path.join(dataDir, '.backups'), {}],
    [operationsDir, {}],
    [stateDir, { include: name => name.startsWith('persistence-backup.') }],
  ]
  // Public releases belong to publishStatic's health/rollback transaction.
  // Background cleanup must not race an independent docs-site publication.
  return Promise.all(specs.map(([directory, options]) => planRetention(directory, options)))
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  if (process.argv.slice(2).some(arg => arg !== '--apply')) throw new Error('用法：prune-backups.mjs [--apply]（默认只预览）')
  const plans = await backupPlans({ appDir: process.env.APP_DIR, vmpmDir: process.env.VMPM_DIR,
    dataDir: process.env.VMCT_DATA_DIR, stateDir: process.env.DEPLOY_STATE_DIR,
    operationsDir: process.env.DEPLOY_BACKUP_DIR, previousSiteRelease: process.env.PREVIOUS_SITE_RELEASE })
  for (const plan of plans) console.log(JSON.stringify({ directory: plan.directory, keep: plan.keep,
    remove: plan.remove.map(entry => entry.name) }))
  if (process.argv.includes('--apply')) await applyRetention(plans)
}
