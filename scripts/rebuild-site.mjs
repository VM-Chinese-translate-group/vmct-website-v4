import { spawn } from 'node:child_process'
import path from 'node:path'

const root = process.cwd()
const node = process.execPath
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

for (const args of commands) await run(args)
console.log('单服务器静态站点构建完成')
