import { parse, stringify } from 'yaml'

export type PageKind = 'document' | 'modpack' | 'map'
export type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error' | 'conflict'

export interface ContentLink {
  id: string
  text: string
  link: string
  icon: string
  project: string
  _extra?: Record<string, unknown>
}

export interface ContentMetadata {
  title: string
  originalName: string
  description: string
  icon: string
  updateDate: string
  featured: boolean
  search: boolean
  sidebar: boolean
  statusType: string
  loader: string
  minecraft: string
  pack: string
  authors: string[]
  links: ContentLink[]
  _raw: Record<string, unknown>
}

export interface ValidationIssue {
  field: string
  message: string
  level: 'error' | 'warning'
}

export const emptyMetadata = (): ContentMetadata => ({
  title: '',
  originalName: '',
  description: '',
  icon: '',
  updateDate: '',
  featured: false,
  search: true,
  sidebar: false,
  statusType: '',
  loader: '',
  minecraft: '',
  pack: '',
  authors: [],
  links: [],
  _raw: {},
})

const record = (value: unknown): Record<string, any> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, any>) : {}
const text = (value: unknown) => (value == null ? '' : String(value))

export function parseMetadata(source: string): ContentMetadata {
  const meta = emptyMetadata()
  let raw: Record<string, any> = {}
  try {
    raw = record(parse(source || '') || {})
  } catch {
    raw = {}
  }
  const status = record(raw.status)
  const compatibility = record(raw.compatibility)
  meta.title = text(raw.title)
  meta.originalName = text(raw.originalName)
  meta.description = text(raw.description)
  meta.icon = text(raw.icon)
  meta.updateDate = text(raw.updateDate)
  meta.featured = raw.featured === true
  meta.search = raw.search !== false
  meta.sidebar = raw.sidebar === true
  meta.statusType = text(status.type)
  meta.loader = text(compatibility.loader)
  meta.minecraft = text(compatibility.minecraft)
  meta.pack = text(compatibility.pack)
  meta.authors = Array.isArray(raw.authors) ? raw.authors.map(text).filter(Boolean) : []
  meta.links = Array.isArray(raw.links)
    ? raw.links.map((value: unknown) => {
        const link = record(value)
        const { id, text: label, link: url, icon, project, ...extra } = link
        return {
          id: text(id),
          text: text(label),
          link: text(url),
          icon: text(icon),
          project: text(project),
          _extra: extra,
        }
      })
    : []
  meta._raw = raw
  return meta
}

function setOrDelete(target: Record<string, any>, key: string, value: unknown, keep = false) {
  if (keep || (typeof value === 'string' ? value.trim() : value != null)) target[key] = value
  else delete target[key]
}

export function stringifyMetadata(meta: ContentMetadata) {
  const raw = record(parse(stringify(record(meta._raw))) || {})
  setOrDelete(raw, 'title', meta.title.trim())
  setOrDelete(raw, 'originalName', meta.originalName.trim())
  setOrDelete(raw, 'icon', meta.icon.trim())
  setOrDelete(raw, 'description', meta.description.trim())
  setOrDelete(raw, 'updateDate', meta.updateDate.trim())
  raw.featured = meta.featured
  raw.search = meta.search
  raw.sidebar = meta.sidebar
  const status = record(raw.status)
  setOrDelete(status, 'type', meta.statusType.trim())
  setOrDelete(raw, 'status', status, Object.keys(status).length > 0)
  const compatibility = record(raw.compatibility)
  setOrDelete(compatibility, 'loader', meta.loader.trim())
  setOrDelete(compatibility, 'minecraft', meta.minecraft.trim())
  setOrDelete(compatibility, 'pack', meta.pack.trim())
  setOrDelete(raw, 'compatibility', compatibility, Object.keys(compatibility).length > 0)
  if (meta.authors.filter((author) => author.trim()).length)
    raw.authors = meta.authors.map((author) => author.trim()).filter(Boolean)
  else delete raw.authors
  if (meta.links.length)
    raw.links = meta.links.map((link) => ({
      ...record(link._extra),
      id: link.id,
      ...(link.text ? { text: link.text } : {}),
      ...(link.link ? { link: link.link } : {}),
      ...(link.icon ? { icon: link.icon } : {}),
      ...(link.project ? { project: link.project } : {}),
    }))
  else delete raw.links
  return stringify(raw, { indent: 2, lineWidth: 0 }).trim()
}
