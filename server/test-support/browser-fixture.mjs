// Local browser protocol fixture. Java's real ticket/grant implementation is
// covered by ContentSsoServiceTest; this stub supplies an isolated test account
// without starting the production database, bot or external login providers.
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import http from 'node:http'
import { spawn } from 'node:child_process'
import { randomBytes, randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { SQLiteD1 } from '../db.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const parentDist = path.resolve(process.argv[2])
const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'vmct-browser-'))
const db = new SQLiteD1(path.join(directory, 'content.sqlite'), path.join(root, 'database/content-cms.sql'))
for (const file of ['community.md', 'modpacks/sb4/index.md']) {
  const source = (await fs.readFile(path.join(root, 'src/pages', file), 'utf8')).replace(/\r\n/g, '\n')
  const match = source.match(/^---\n([\s\S]*?)\n---(?:\n|$)/)
  const pagePath = file.replace(/\.md$/, '')
  const body = source.slice(match[0].length)
  await db.prepare("INSERT INTO content_pages(id,path,published_path,draft_frontmatter,draft_body,published_frontmatter,published_body,has_unpublished_changes,state,published_at) VALUES(?,?,?,?,?,?,?,0,'published','2026-10-31')")
    .bind(randomUUID(), pagePath, pagePath, match[1], body, match[1], body).run()
}
db.close()

let signedIn = true
const tickets = new Set(), grants = new Set()
const opaque = () => randomBytes(32).toString('base64url')
const user = { id: 1, displayName: '本地测试管理员', globalRole: 'ADMIN' }
const permissions = { userId: 1, globalRole: 'ADMIN', globalPermissions: [], projectPermissions: [] }
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost:39432')
    const json = (data, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ code: status === 200 ? 0 : status, data })) }
    if (url.pathname === '/__fixture/login') {
      signedIn = true
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.end(`<script>localStorage.setItem('user',${JSON.stringify(JSON.stringify(user))});localStorage.setItem('permissions',${JSON.stringify(JSON.stringify(permissions))});localStorage.setItem('token','fixture-jwt');location.replace('/website-content')</script>`)
    } else if (url.pathname === '/api/auth/permissions') json(permissions)
    else if (url.pathname === '/api/auth/content-sso/ticket') {
      if (!signedIn || req.headers.authorization !== 'Bearer fixture-jwt') return json(null, 401)
      const ticket = opaque(); tickets.add(ticket); json({ ticket, expiresIn: 60 })
    } else if (url.pathname === '/api/auth/content-sso/redeem') {
      let body = ''; for await (const chunk of req) body += chunk
      const { ticket } = JSON.parse(body)
      if (!signedIn || !tickets.delete(ticket)) return json(null, 401)
      const grant = opaque(); grants.add(grant); json({ grant })
    } else if (url.pathname === '/api/auth/content-sso/session') {
      if (!signedIn || !grants.has((req.headers.authorization || '').slice(7))) return json(null, 401)
      json({ userId: 1, displayName: user.displayName })
    } else if (url.pathname === '/api/auth/logout') { signedIn = false; tickets.clear(); grants.clear(); json(null) }
    else if (url.pathname.startsWith('/api/')) json(null, 404)
    else {
      const relative = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname)
      let file = path.resolve(parentDist, '.' + relative)
      if (!file.startsWith(parentDist + path.sep)) return json(null, 404)
      try { if (!(await fs.stat(file)).isFile()) file = path.join(parentDist, 'index.html') }
      catch { file = path.join(parentDist, 'index.html') }
      const type = { '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' }[path.extname(file)] || 'text/html; charset=utf-8'
      res.setHeader('Content-Type', type); res.end(await fs.readFile(file))
    }
  } catch { res.writeHead(500); res.end('Fixture error') }
})
server.listen(39432, 'localhost')
const child = spawn(process.execPath, ['server/index.mjs'], { cwd: root, stdio: 'inherit', env: {
  ...process.env, VMCT_DATABASE_BACKEND: 'sqlite', VMCT_DATA_DIR: directory, PORT: '39430', HOST: 'localhost',
  DICT_DB_PATH: path.join(directory, 'dictionary.sqlite'), VMCT_VITE_DEV: '', SITE_DIST_DIR: path.join(root, 'dist'),
  AFDIAN_USER_ID: '', AFDIAN_TOKEN: '', CMS_ADMIN_VERIFIER: '', CMS_ADMIN_SALT: '',
  VMPM_SSO_ORIGIN: 'http://localhost:39432', VMPM_API_ORIGIN: 'http://localhost:39432',
} })
console.log('Isolated browser fixture: http://localhost:39432/__fixture/login')
async function close() { child.kill(); server.closeAllConnections(); server.close(); await new Promise(resolve => child.once('exit', resolve)); await fs.rm(directory, { recursive: true, force: true }); process.exit() }
process.on('SIGINT', close); process.on('SIGTERM', close)
