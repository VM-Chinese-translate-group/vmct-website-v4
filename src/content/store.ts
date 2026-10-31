import { computed, inject, shallowRef, type InjectionKey } from 'vue'
import { ConverterFactory } from 'opencc-js/core'
import { from, to } from 'opencc-js/preset'
import type { ResourceItem } from '@/types/resource'
import type { SearchIndexItem } from '@/types/search'

export interface ContentNode {
  tag: string
  props: Record<string, any>
  children?: Array<ContentNode | string>
}
export interface SiteContent {
  version: string
  path: string
  embedded?: boolean
  catalog: Array<{ path: string; meta: Record<string, any>; title: string; excerpt: string; publishedAt: string | null }>
  page: { path: string; meta: Record<string, any>; document: Array<ContentNode | string> } | null
}

const convertToTW = ConverterFactory(from.cn, to.twp)
const text = (value: unknown) => typeof value === 'string' ? value : ''
const isHidden = (entry: SiteContent['catalog'][number]) => entry.meta.noindex === true || /\/(?:secret|example)$/.test(entry.path)

export function createContentStore(initial?: SiteContent) {
  const state = shallowRef<SiteContent>(initial || { version: '', path: '', catalog: [], page: null })
  let initialPath = initial?.path
  let sequence = 0
  async function load(path: string, force = false) {
    if (!force && initialPath === path) { initialPath = undefined; return }
    initialPath = undefined
    const request = ++sequence
    const response = await fetch('/api/content/internal/export?view=site&path=' + encodeURIComponent(path), { cache: 'no-store', headers: { Accept: 'application/json' } })
    if (!response.ok) throw new Error('页面内容加载失败，请稍后重试。')
    const next = await response.json() as SiteContent
    if (!Array.isArray(next.catalog) || typeof next.path !== 'string') throw new Error('内容服务尚未升级，请稍后重试。')
    if (request === sequence) state.value = { ...next, embedded: state.value.embedded }
  }
  function resources(root: string) {
    return computed<ResourceItem[]>(() => state.value.catalog.filter(entry =>
      entry.path.startsWith(root) && !entry.path.startsWith('/modpacks/fc5-wiki') && !isHidden(entry),
    ).map(({ path, meta }) => {
      const match = text(meta.updateDate).match(/^(\d{4})(?:年|-)(\d{1,2})(?:月|-)(\d{1,2})日?$/)
      return { name: text(meta.title).replace('汉化下载', '').trim() || path.split('/').pop() || '',
        originalName: text(meta.originalName), icon: text(meta.icon), image: text(meta.image),
        author: text(meta.authors?.[0] || meta.author), description: text(meta.description),
        featured: [true, 'true', 'yes', 1, '1'].includes(meta.featured), link: path,
        displayDate: text(meta.updateDate), date: match ? new Date(+match[1], +match[2] - 1, +match[3]).getTime() : 0,
        status: meta.status?.type ? { type: text(meta.status.type) } : undefined,
        versions: { loader: text(meta.compatibility?.loader), mc: text(meta.compatibility?.minecraft), pack: text(meta.compatibility?.pack) },
      }
    }).sort((a, b) => (b.date || 0) - (a.date || 0)))
  }
  const searchIndex = computed<SearchIndexItem[]>(() => state.value.catalog.filter(entry => !isHidden(entry) && entry.meta.search !== false).map(entry => ({
    url: entry.path, title: text(entry.title), originalName: text(entry.meta.originalName),
    titleTW: convertToTW(text(entry.title)), text: entry.excerpt, textTW: convertToTW(entry.excerpt),
  })))
  const embedded = computed(() => Boolean(state.value.embedded))
  return { state, load, embedded, modpacks: resources('/modpacks/'), maps: resources('/map/'), searchIndex }
}

export const CONTENT_STORE: InjectionKey<ReturnType<typeof createContentStore>> = Symbol('site-content')
export function useSiteContent() {
  const store = inject(CONTENT_STORE)
  if (!store) throw new Error('Missing site content provider')
  return store
}
