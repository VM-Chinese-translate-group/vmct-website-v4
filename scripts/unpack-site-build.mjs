import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'

const [archiveArg, targetArg, checksum, commit] = process.argv.slice(2)
const root = process.cwd()
const archive = path.resolve(archiveArg)
const target = path.resolve(targetArg)
const releases = path.join(root, '.site-releases')
const hash = async file => createHash('sha256').update(await fs.readFile(file)).digest('hex')
if (!/^[a-f0-9]{64}$/.test(checksum || '') || !/^[a-f0-9]{40}$/.test(commit || '')) throw new Error('预构建产物缺少有效校验和或提交号')
if (path.dirname(target) !== releases || !path.basename(target).startsWith(commit + '-')) throw new Error('预构建目录必须位于当前版本的 .site-releases 内')
if (await hash(archive) !== checksum) throw new Error('预构建归档校验失败')
const names = execFileSync('tar', ['-tzf', archive], { encoding: 'utf8' }).trim().split('\n')
for (const name of names) {
  const normalized = name.replace(/^\.\//, '').replace(/\/$/, '')
  if (!normalized) continue
  if (name.startsWith('/') || name.includes('\\') || name.split('/').includes('..') ||
      !/^(?:dist(?:\/.*)?|server(?:\/generated(?:\/content-api\.mjs)?)?|site-build\.json)$/.test(normalized)) throw new Error('预构建归档包含非法路径')
}
const verbose = execFileSync('tar', ['-tzvf', archive], { encoding: 'utf8' })
if (verbose.split('\n').some(line => line && !/^[-d]/.test(line))) throw new Error('预构建归档包含链接或特殊文件')
const work = await fs.mkdtemp(path.join(os.tmpdir(), 'vmct-unpack-'))
try {
  execFileSync('tar', ['-xzf', archive, '--no-same-owner', '--no-same-permissions', '-C', work])
  const manifest = JSON.parse(await fs.readFile(path.join(work, 'site-build.json'), 'utf8'))
  if (manifest.commit !== commit) throw new Error('预构建产物与部署提交不一致')
  for (const file of ['dist/index.html', 'dist/.vite/ssr-manifest.json', 'dist/server/entry-server.js', 'server/generated/content-api.mjs']) {
    if (await hash(path.join(work, file)) !== manifest.files?.[file]) throw new Error('预构建文件校验失败: ' + file)
  }
  if ((await fs.readdir(target)).length) throw new Error('预构建目标必须为空目录')
  await fs.cp(path.join(work, 'dist'), target, { recursive: true })
  await fs.mkdir(path.join(root, 'server/generated'), { recursive: true })
  const api = path.join(root, 'server/generated/content-api.mjs')
  await fs.copyFile(path.join(work, 'server/generated/content-api.mjs'), api + '.next')
  await fs.rename(api + '.next', api)
  console.log('已校验并安装本地预构建产物: ' + commit)
} finally { await fs.rm(work, { recursive: true, force: true }) }
