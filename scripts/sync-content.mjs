import fs from 'node:fs/promises'
import { loadSiteConfig } from '../config/load-site.mjs'
import path from 'node:path'

const OUTPUT_DIR = path.join(process.cwd(), 'src', 'generated-pages')
const modeIndex = process.argv.indexOf('--mode')
const mode = modeIndex >= 0 ? process.argv[modeIndex + 1] : 'production'
const CONTENT_EXPORT_URL = loadSiteConfig(mode).contentOrigin + '/api/content/internal/export'

function normalizePath(value) {
  const pagePath = String(value || '')
    .replace(/\\/g, '/')
    .replace(/^\/+|\/+$/g, '')
    .replace(/\.md$/i, '')
  if (!pagePath || pagePath.includes('..') || !/^[\p{L}\p{N}._/-]+$/u.test(pagePath)) {
    throw new Error('invalid page path: ' + value)
  }
  return pagePath
}

try {
  const response = await fetch(CONTENT_EXPORT_URL, { headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error('content endpoint returned HTTP ' + response.status)
  const payload = await response.json()
  if (!Array.isArray(payload.pages)) throw new Error('content response did not contain pages')

  await fs.rm(OUTPUT_DIR, { recursive: true, force: true })
  await fs.mkdir(OUTPUT_DIR, { recursive: true })
  for (const page of payload.pages) {
    const outputFile = path.join(OUTPUT_DIR, normalizePath(page.path) + '.md')
    if (!path.resolve(outputFile).startsWith(path.resolve(OUTPUT_DIR) + path.sep))
      throw new Error('invalid output path')
    const frontmatter = String(page.frontmatter || '').trim()
    const body = String(page.body || '').replace(/^\s+/, '')
    await fs.mkdir(path.dirname(outputFile), { recursive: true })
    await fs.writeFile(
      outputFile,
      frontmatter ? '---\n' + frontmatter + '\n---\n\n' + body : body,
      'utf8',
    )
  }
  console.log('content:pull generated ' + payload.pages.length + ' published page(s)')
} catch (error) {
  // The first deployment happens before this project's API route exists. Keep
  // repository Markdown as the fallback, then use D1 from later builds onward.
  console.warn('content:pull skipped: ' + (error instanceof Error ? error.message : String(error)))
}
