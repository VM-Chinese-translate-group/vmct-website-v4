import fs from 'node:fs/promises'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const root = process.cwd()
const sourcePath = path.join(root, 'functions', 'api', 'content', '[[path]].ts')
const outputDir = path.join(root, 'server', 'generated')
const tempDir = path.join(outputDir, '.compile')
const tempSource = path.join(tempDir, 'content-api.ts')
const tempOutput = path.join(tempDir, 'content-api.js')
const outputPath = path.join(outputDir, 'content-api.mjs')
const tsc = path.join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'tsc.cmd' : 'tsc')

await fs.mkdir(tempDir, { recursive: true })
await fs.writeFile(tempSource, await fs.readFile(sourcePath, 'utf8'), 'utf8')

const result = spawnSync(
  tsc,
  [
    tempSource,
    '--target',
    'ES2022',
    '--module',
    'ESNext',
    '--moduleResolution',
    'bundler',
    '--skipLibCheck',
    '--outDir',
    tempDir,
    '--declaration',
    'false',
    '--sourceMap',
    'false',
    '--ignoreConfig',
  ],
  { stdio: 'inherit', cwd: root, shell: process.platform === 'win32' },
)

if (result.error) throw result.error
if (result.status !== 0) throw new Error(`tsc 编译失败，退出码：${result.status}`)

await fs.rename(tempOutput, outputPath)
await fs.rm(tempDir, { recursive: true, force: true })
console.log(`CMS API 已编译：${path.relative(root, outputPath)}`)
