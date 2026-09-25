import { spawn } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs/promises'

const root = process.cwd()
const node = process.execPath
const nginxContainer = process.env.NGINX_CONTAINER || 'nginx'
const nginxStaticRoot = process.env.NGINX_STATIC_ROOT || '/home/vmct/vmct-website-dist'
const nginxStaticStage = `${nginxStaticRoot}.new`
const lockPath = path.join(root, '.rebuild-site.lock')
const commands = [
  ['scripts/sync-content.mjs'],
  ['node_modules/vite/bin/vite.js', 'build'],
  ['node_modules/vite/bin/vite.js', 'build', '--ssr', 'src/entry-server.ts', '--outDir', 'dist/server'],
  ['scripts/prerender.mjs'],
]

function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(node, args, {
      cwd: root,
      stdio: 'inherit',
      env: {
        ...process.env,
        CONTENT_EXPORT_URL:
          process.env.CONTENT_EXPORT_URL || 'http://127.0.0.1:8787/api/content/internal/export',
      },
    })
    child.on('error', reject)
    child.on('exit', (code, signal) => {
      if (code === 0) resolve()
      else reject(new Error(`构建命令失败：${args.join(' ')} (${signal || code})`))
    })
  })
}

function runExternal(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(args[0], args.slice(1), {
      cwd: root,
      stdio: 'inherit',
      env: process.env,
    })
    child.on('error', reject)
    child.on('exit', (code, signal) => {
      if (code === 0) resolve()
      else reject(new Error(`命令失败：${args.join(' ')} (${signal || code})`))
    })
  })
}

async function runCapture(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(args[0], args.slice(1), {
      cwd: root,
      env: process.env,
      stdio: ['ignore', 'pipe', 'inherit'],
    })
    let output = ''
    child.stdout.on('data', (chunk) => {
      output += chunk
    })
    child.on('error', reject)
    child.on('exit', (code, signal) => {
      if (code === 0) resolve(output)
      else reject(new Error(`命令失败：${args.join(' ')} (${signal || code})`))
    })
  })
}

async function deployToNginx() {
  const containers = String(await runCapture(['docker', 'ps', '--format', '{{.Names}}']))
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean)
  if (!containers.includes(nginxContainer))
    throw new Error(`找不到运行中的 Nginx 容器：${nginxContainer}`)

  // Copy into a staging directory and swap it in one rename inside the
  // existing container. This keeps the previous site available until the
  // new build is complete.
  await runExternal(['docker', 'exec', nginxContainer, 'rm', '-rf', nginxStaticStage, nginxStaticRoot])
  await runExternal(['docker', 'exec', nginxContainer, 'mkdir', '-p', nginxStaticStage])
  await runExternal(['docker', 'cp', `${root}/dist/.`, `${nginxContainer}:${nginxStaticStage}/`])
  await runExternal(['docker', 'exec', nginxContainer, 'mv', nginxStaticStage, nginxStaticRoot])
  await runExternal(['docker', 'exec', nginxContainer, 'nginx', '-t'])
  await runExternal(['docker', 'exec', nginxContainer, 'nginx', '-s', 'reload'])
}

let lock
try {
  lock = await fs.open(lockPath, 'wx')
} catch (error) {
  if (error?.code === 'EEXIST') throw new Error('已有一个站点重建任务正在运行')
  throw error
}

try {
  await lock.writeFile(`${process.pid}\n`)
  for (const args of commands) await run(args)
  await deployToNginx()
  console.log('单服务器静态站点构建并部署完成')
} finally {
  await lock?.close().catch(() => {})
  await fs.rm(lockPath, { force: true }).catch(() => {})
}
