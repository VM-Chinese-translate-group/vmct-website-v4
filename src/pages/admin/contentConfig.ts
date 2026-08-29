import type { ContentMetadata, PageKind, ValidationIssue } from './types'

export const PAGE_TYPES: {
  value: PageKind
  label: string
  hint: string
  prefix: string
  icon: string
}[] = [
  { value: 'document', label: '文档', hint: '普通说明页面', prefix: '', icon: 'lucide:file-text' },
  {
    value: 'modpack',
    label: '整合包',
    hint: '/modpacks/',
    prefix: 'modpacks/',
    icon: 'lucide:package',
  },
  { value: 'map', label: '地图', hint: '/map/', prefix: 'map/', icon: 'lucide:map' },
]
export const STATUS_OPTIONS = [
  { value: '', label: '未设置', icon: 'lucide:circle-dashed' },
  { value: 'maintaining', label: '维护中', icon: 'lucide:circle-check' },
  { value: 'translating', label: '翻译中', icon: 'lucide:languages' },
  { value: 'stopped', label: '暂不跟进', icon: 'lucide:circle-pause' },
]
export const LOADER_OPTIONS = [
  { value: '', label: '未设置', icon: 'lucide:circle-dashed' },
  { value: 'vanilla', label: '原版', icon: '/imgs/svg/vanilla.svg' },
  { value: 'forge', label: 'Forge', icon: '/imgs/svg/forge.svg' },
  { value: 'neoforge', label: 'NeoForge', icon: '/imgs/svg/neoforge.svg' },
  { value: 'fabric', label: 'Fabric', icon: '/imgs/svg/fabric.svg' },
]
export const LINK_OPTIONS = [
  { value: 'curseforge', label: 'CurseForge' },
  { value: 'modrinth', label: 'Modrinth' },
  { value: 'github', label: 'GitHub' },
  { value: 'bilibili', label: 'Bilibili' },
  { value: 'planetminecraft', label: 'PlanetMinecraft' },
  { value: 'minecraftmaps', label: 'Minecraft Maps' },
  { value: 'paratranz', label: 'Paratranz' },
  { value: 'i18n', label: 'i18n 下载（自动）' },
  { value: '__custom__', label: '自定义平台' },
]

const today = () => {
  const date = new Date()
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
}

export function templateFor(kind: PageKind) {
  if (kind === 'document')
    return {
      metadata: { sidebar: true, search: true },
      body: `<DocLayout :meta="frontmatter">\n\n## 页面简介\n\n在这里填写页面内容。\n\n## 详细说明\n\n在这里补充说明。\n\n</DocLayout>`,
    }
  if (kind === 'modpack')
    return {
      metadata: { sidebar: false, search: true, updateDate: today() },
      body: `<DownloadLayout :meta="frontmatter">\n\n::: warning 下载前请确认\n请确认 Minecraft、加载器与整合包版本。\n:::\n\n## 整合包简介\n\n在这里介绍玩法与汉化范围。\n\n<DownloadLinks :methods="[\n  { id: 'patch', text: '下载汉化补丁', link: 'https://example.com/replace-me' }\n]" />\n\n## 安装说明\n\n1. 下载对应版本的整合包和汉化补丁。\n2. 按说明安装补丁。\n\n<DocSupport />\n\n</DownloadLayout>`,
    }
  return {
    metadata: { sidebar: false, search: true, updateDate: today() },
    body: `<DownloadLayout :meta="frontmatter">\n\n## 地图信息\n\n在这里介绍地图玩法、人数与规则。\n\n::: warning 安装前确认\n请确认游戏版本，并将存档放入 saves 目录。\n:::\n\n<DownloadLinks :methods="[\n  { id: 'lanzou-quark-mapdl', text: '下载地图和汉化', link: 'https://example.com/replace-me' }\n]" />\n\n## 游玩方式\n\n1. 解压地图文件。\n2. 将存档文件夹放入 Minecraft 的 saves 目录。\n\n<DocSupport />\n\n</DownloadLayout>`,
  }
}

export function pageKindFromPath(path: string): PageKind {
  return PAGE_TYPES.find((type) => type.prefix && path.startsWith(type.prefix))?.value || 'document'
}

const validUrl = (value: string) => {
  if (!value) return true
  try {
    const origin = typeof window === 'undefined' ? 'https://vmct-cn.top' : window.location.origin
    const url = new URL(value, origin)
    return url.protocol === 'https:' || (url.origin === origin && value.startsWith('/'))
  } catch {
    return false
  }
}

export function validateContent(
  path: string,
  metadata: ContentMetadata,
  body: string,
  kind: PageKind,
  existingPaths: string[] = [],
): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const error = (field: string, message: string) => issues.push({ field, message, level: 'error' })
  const warning = (field: string, message: string) =>
    issues.push({ field, message, level: 'warning' })
  const normalized = path.trim().replace(/^\/+|\/+$/g, '')
  if (!normalized) error('path', '请填写页面路径。')
  else if (normalized.includes('..') || !/^[\p{L}\p{N}._/-]+$/u.test(normalized))
    error('path', '页面路径格式无效。')
  else if (/^(admin|api)(?:\/|$)/.test(normalized)) error('path', '该路径为系统保留路径。')
  if (existingPaths.includes(normalized)) error('path', '该页面路径已存在。')
  if (!metadata.title.trim()) error('title', '请填写页面标题。')
  if (!body.trim()) error('body', '请填写 Markdown 正文。')
  if (metadata.icon && !validUrl(metadata.icon)) error('icon', '封面必须是站内路径或 HTTPS 地址。')
  metadata.links.forEach((link, index) => {
    if (link.link && !validUrl(link.link))
      error(`links.${index}`, `第 ${index + 1} 个相关链接无效。`)
  })
  if (kind === 'document') {
    if (body.trim() && !/<DocLayout\b/.test(body)) error('body', '文档正文需要使用 DocLayout。')
  } else {
    if (body.trim() && !/<DownloadLayout\b/.test(body))
      error('body', '资源正文需要使用 DownloadLayout。')
    if (body.trim() && !/<DownloadLinks\b/.test(body))
      error('body', '资源页面至少需要一个下载组件。')
    if (/example\.com\/replace-me/.test(body)) error('body', '请替换模板中的示例下载地址。')
    if (!metadata.icon) warning('icon', '建议填写封面。')
    if (!metadata.description) warning('description', '建议填写简介。')
    if (!metadata.updateDate) warning('updateDate', '建议填写更新日期。')
    if (!metadata.minecraft) warning('minecraft', '建议填写 Minecraft 版本。')
    if (!metadata.authors.filter(Boolean).length)
      warning('authors', '建议至少填写一位作者或翻译者。')
  }
  return issues
}
