import { spawn } from 'node:child_process'
import path from 'node:path'
import { publishStatic } from './publish-static.mjs'

const root = process.cwd()
const node = process.execPath
const nginxStaticRoot = process.env.NGINX_STATIC_ROOT || '/home/vmct/vmpm/dist/www.vmct.top'
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
        NODE_OPTIONS: process.env.NODE_OPTIONS || '--max-old-space-size=768',
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

// The CMS rebuild and code deployment share the same OS lock. flock releases
// it on a crash; both build processes write to the same dist directory.
if (!process.argv.includes('--locked')) {
  const child = spawn('flock', ['-w', '1800', path.join(root, '.vmct-deploy.lock'),
    node, process.argv[1], '--locked'], { cwd: root, stdio: 'inherit', env: process.env })
  child.on('error', (error) => { console.error(error); process.exitCode = 1 })
  child.on('exit', (code, signal) => { process.exitCode = signal ? 1 : (code ?? 1) })
} else {
  for (const args of commands) await run(args)
  await publishStatic({ source: path.join(root, 'dist'), target: nginxStaticRoot })
  console.log('本地数据库内容构建并发布到宿主机持久化目录完成')
}
