import fs from 'node:fs/promises'
import path from 'node:path'
import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'

const SITE_ORIGIN = 'https://vmct-cn.top'
const outputArgument = process.argv.indexOf('--output')
const OUTPUT_DIR = path.resolve(
  process.cwd(),
  outputArgument >= 0 && process.argv[outputArgument + 1]
    ? process.argv[outputArgument + 1]
    : 'content-export',
)

function normalizePath(value) {
  const pagePath = String(value || '')
    .replace(/\\/g, '/')
    .replace(/^\/+|\/+$/g, '')
    .replace(/\.md$/i, '')
  if (!pagePath || pagePath.includes('..') || !/^[\p{L}\p{N}._/-]+$/u.test(pagePath))
    throw new Error('无效页面路径：' + value)
  return pagePath
}

const existing = await fs.readdir(OUTPUT_DIR).catch(() => [])
if (existing.length) throw new Error('导出目录非空：' + OUTPUT_DIR + '。请指定新的 --output 目录。')

const prompt = createInterface({ input: stdin, output: stdout })
const password = await prompt.question('请输入后台密码：')
prompt.close()

const login = await fetch(SITE_ORIGIN + '/api/content/admin/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: SITE_ORIGIN },
  body: JSON.stringify({ password }),
})
const cookie = login.headers.get('set-cookie')?.split(';')[0]
if (!login.ok || !cookie) throw new Error('登录失败，请检查后台密码。')

const response = await fetch(SITE_ORIGIN + '/api/content/admin/export', {
  headers: { Cookie: cookie },
})
const payload = await response.json().catch(() => null)
if (!response.ok || !Array.isArray(payload?.pages)) throw new Error(payload?.error || '导出失败。')

await fs.mkdir(OUTPUT_DIR, { recursive: true })
for (const page of payload.pages) {
  const pagePath = normalizePath(page.path)
  const frontmatter = String(page.draftFrontmatter || page.publishedFrontmatter || '').trim()
  const body = String(page.draftBody || page.publishedBody || '')
  const outputFile = path.join(OUTPUT_DIR, pagePath + '.md')
  if (!path.resolve(outputFile).startsWith(OUTPUT_DIR + path.sep)) throw new Error('无效输出路径')
  await fs.mkdir(path.dirname(outputFile), { recursive: true })
  await fs.writeFile(outputFile, frontmatter ? `---\n${frontmatter}\n---\n\n${body}` : body, 'utf8')
}
console.log(`已导出 ${payload.pages.length} 个页面到 ${OUTPUT_DIR}`)
