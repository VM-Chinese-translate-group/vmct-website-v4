import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'

const root = process.cwd()
const output = path.resolve(process.argv[2] || 'dist-package/site.tar.gz')
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
const work = await fs.mkdtemp(path.join(os.tmpdir(), 'vmct-package-'))
const hash = async file => createHash('sha256').update(await fs.readFile(file)).digest('hex')
try {
  await fs.cp(path.join(root, 'dist'), path.join(work, 'dist'), { recursive: true, dereference: true })
  await fs.mkdir(path.join(work, 'server/generated'), { recursive: true })
  const api = 'server/generated/content-api.mjs'
  await fs.copyFile(path.join(root, api), path.join(work, api))
  const files = ['dist/index.html', 'dist/.vite/ssr-manifest.json', 'dist/server/entry-server.js', api]
  const hashes = Object.fromEntries(await Promise.all(files.map(async file => [file, await hash(path.join(work, file))])))
  await fs.writeFile(path.join(work, 'site-build.json'), JSON.stringify({ commit, files: hashes }))
  await fs.mkdir(path.dirname(output), { recursive: true })
  execFileSync('tar', ['-czf', output, '-C', work, '.'])
  console.log(JSON.stringify({ commit, archive: output, sha256: await hash(output) }))
} finally { await fs.rm(work, { recursive: true, force: true }) }
