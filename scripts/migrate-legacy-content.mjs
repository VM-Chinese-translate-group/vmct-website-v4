import fs from 'node:fs/promises'
import path from 'node:path'
import { loginContentAdmin } from './content-auth.mjs'

const PAGES_DIR = path.join(process.cwd(), 'src', 'pages')
const SITE_ORIGIN = process.env.SITE_ORIGIN || 'https://www.vmct.top'

function splitFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/)
  return { frontmatter: match?.[1] || '', body: match ? content.slice(match[0].length) : content }
}

async function walk(dir, pages = []) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue
    const file = path.join(dir, entry.name)
    if (entry.isDirectory()) await walk(file, pages)
    if (entry.isFile() && entry.name.endsWith('.md')) {
      const source = await fs.readFile(file, 'utf8')
      const content = splitFrontmatter(source)
      pages.push({
        path: path.relative(PAGES_DIR, file).replace(/\\/g, '/').replace(/\.md$/, ''),
        ...content,
      })
    }
  }
  return pages
}

let cookie
try {
  cookie = await loginContentAdmin(SITE_ORIGIN)
} catch (error) {
  console.error(error instanceof Error ? error.message : '登录失败。')
  process.exitCode = 1
}
if (cookie) {
  const response = await fetch(SITE_ORIGIN + '/api/content/admin/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: SITE_ORIGIN, Cookie: cookie },
    body: JSON.stringify({ pages: await walk(PAGES_DIR) }),
  })
  const result = await response.json().catch(() => null)
  if (!response.ok) {
    console.error(result?.error || '导入失败：HTTP ' + response.status)
    process.exitCode = 1
  } else {
    console.log('已导入 ' + result.imported + ' 个页面。')
    console.log(
      result.deployment?.requested ? '已刷新站点内容，无需重建。' : '内容导入成功，请检查站点缓存状态。',
    )
  }
}
