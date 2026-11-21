import { computed, inject, shallowRef, type InjectionKey } from 'vue'
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
  resources?: ResourceItem[]
  home?: {
    modpackCount: number
    mapCount: number
    hot: ResourceItem[]
    updated: ResourceItem[]
    carousel: ResourceItem[]
    maps: ResourceItem[]
  }
  page: { path: string; meta: Record<string, any>; document: Array<ContentNode | string> } | null
}

export function createContentStore(initial?: SiteContent) {
  const state = shallowRef<SiteContent>(initial || { version: '', path: '', page: null })
  let initialPath = initial?.path
  let sequence = 0
  let searchItems: SearchIndexItem[] | undefined
  let searchRequest: Promise<SearchIndexItem[]> | undefined

  async function load(path: string) {
    if (initialPath === path) {
      initialPath = undefined
      return
    }
    initialPath = undefined
    const request = ++sequence
    const response = await fetch(
      '/api/content/internal/export?view=route&path=' + encodeURIComponent(path),
      { cache: 'no-store', headers: { Accept: 'application/json' } },
    )
    if (!response.ok) throw new Error('页面内容加载失败，请稍后重试。')
    const next = (await response.json()) as SiteContent
    if (typeof next.path !== 'string' || typeof next.version !== 'string')
      throw new Error('内容服务尚未升级，请稍后重试。')
    if (request === sequence) state.value = { ...next, embedded: state.value.embedded }
  }

  function loadSearchIndex() {
    searchRequest ??= (async () => {
      try {
        const response = await fetch('/api/content/internal/export?view=search', {
          cache: 'no-cache',
        })
        if (!response.ok) throw new Error('搜索索引加载失败')
        const { items } = await response.json()
        if (!Array.isArray(items)) throw new Error('搜索索引格式无效')
        searchItems = items
        return searchItems
      } catch (error) {
        if (searchItems) return searchItems
        throw error
      } finally {
        searchRequest = undefined
      }
    })()
    return searchRequest
  }

  return {
    state,
    load,
    loadSearchIndex,
    embedded: computed(() => Boolean(state.value.embedded)),
    home: computed(() => state.value.home),
    resources: computed(() => state.value.resources || []),
  }
}

export const CONTENT_STORE: InjectionKey<ReturnType<typeof createContentStore>> =
  Symbol('site-content')
export function useSiteContent() {
  const store = inject(CONTENT_STORE)
  if (!store) throw new Error('Missing site content provider')
  return store
}
