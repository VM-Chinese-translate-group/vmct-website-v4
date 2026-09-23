import fs from 'node:fs'
import path from 'node:path'

export interface MarkdownPage {
  body: string
  fileName: string
  fullPath: string
  modulePath: string
  relativePath: string
  route: string
  yamlRaw: string
}

const PAGES_DIR = path.resolve(process.cwd(), 'src/pages')
const GENERATED_PAGES_DIR = path.resolve(process.cwd(), 'src/generated-pages')

let cachedPages: MarkdownPage[] | null = null

function normalizePath(value: string) {
  return value.replace(/\\/g, '/')
}

function routeFromRelativePath(relativePath: string) {
  let route = normalizePath(relativePath).replace(/\.md$/, '')
  route = route.endsWith('/index') ? route.replace(/\/index$/, '') : route
  return route.startsWith('/') ? route : `/${route}`
}

function splitFrontmatter(content: string) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)

  return {
    yamlRaw: match?.[1] || '',
    body: match ? content.slice(match[0].length) : content,
  }
}

function walkMarkdownPages(dir: string, moduleRoot: string, pages: MarkdownPage[]) {
  if (!fs.existsSync(dir)) return

  for (const fileName of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, fileName)
    const stat = fs.statSync(fullPath)

    if (stat.isDirectory()) {
      if (!fileName.startsWith('.')) walkMarkdownPages(fullPath, moduleRoot, pages)
      continue
    }

    if (!fileName.endsWith('.md')) continue

    const relativePath = normalizePath(path.relative(moduleRoot, fullPath))
    const content = fs.readFileSync(fullPath, 'utf-8')
    const { yamlRaw, body } = splitFrontmatter(content)

    pages.push({
      body,
      fileName,
      fullPath,
      modulePath: `../${path.basename(moduleRoot)}/${relativePath}`,
      relativePath,
      route: routeFromRelativePath(relativePath),
      yamlRaw,
    })
  }
}

export function stripYamlQuotes(value: string) {
  return value.trim().replace(/^['"]|['"]$/g, '')
}

export function getFrontmatterValue(yamlRaw: string, key: string) {
  const match = yamlRaw.match(new RegExp(`^${key}:[ \\t]*(.*)`, 'm'))
  return match?.[1] ? stripYamlQuotes(match[1]) : ''
}

export function getFrontmatterText(yamlRaw: string, key: string) {
  const inlineValue = getFrontmatterValue(yamlRaw, key)

  // YAML serializers append a chomping indicator to multiline scalars (for
  // example `|-` or `>+`). These markers describe trailing-newline handling;
  // they are not the field value itself.
  if (inlineValue && !/^(?:[|>][+-]?|-)$/.test(inlineValue)) {
    return inlineValue
  }

  const block = yamlRaw.match(
    new RegExp(
      `(?:^|\\r?\\n)${key}:[ \\t]*(?:[|>][+-]?|-)?[ \\t]*(?:\\r?\\n)?([\\s\\S]*?)(?=\\r?\\n\\S+:|$)`,
    ),
  )
  return block?.[1]?.replace(/\r?\n/g, ' ').trim() || ''
}

export function getFrontmatterBlock(yamlRaw: string, key: string) {
  return (
    yamlRaw.match(
      new RegExp(`(?:^|\\r?\\n)${key}:[ \\t]*\\r?\\n([\\s\\S]*?)(?=\\r?\\n\\S|$)`),
    )?.[1] || ''
  )
}

export function getFrontmatterBlockValue(yamlRaw: string, blockKey: string, key: string) {
  const block = getFrontmatterBlock(yamlRaw, blockKey)
  const match = block.match(new RegExp(`^[ \\t]*${key}:[ \\t]*(.*)`, 'm'))
  return match?.[1] ? stripYamlQuotes(match[1]) : ''
}

export function getFrontmatterFirstListValue(yamlRaw: string, key: string) {
  const block = getFrontmatterBlock(yamlRaw, key)
  const match = block.match(/^\s*-\s*['"]?([^(\n'"]+)/m)
  return match?.[1]?.trim() || ''
}

export function getMarkdownPages() {
  if (cachedPages) return cachedPages

  const pages: MarkdownPage[] = []
  walkMarkdownPages(PAGES_DIR, PAGES_DIR, pages)
  walkMarkdownPages(GENERATED_PAGES_DIR, GENERATED_PAGES_DIR, pages)

  // Generated pages are the D1 publication snapshot and override legacy
  // repository Markdown during the staged migration.
  cachedPages = [...new Map(pages.map((page) => [page.route, page])).values()]
  return pages
}

export function getMarkdownRoutes() {
  return getMarkdownPages().map((page) => page.route)
}

export function invalidateMarkdownPages() {
  cachedPages = null
}

export function isMarkdownPage(file: string) {
  const normalized = normalizePath(file)
  return (
    normalized.endsWith('.md') &&
    (normalized.includes('/src/pages/') || normalized.includes('/src/generated-pages/'))
  )
}
