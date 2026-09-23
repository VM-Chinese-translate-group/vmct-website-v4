import {
  getFrontmatterText,
  getFrontmatterValue,
  getMarkdownPages,
  invalidateMarkdownPages,
  isMarkdownPage,
  type MarkdownPage,
} from './contentScanner.ts'

interface RouteMetaEntry {
  description?: string
  icon?: string
  image?: string
  originalName?: string
  title?: string
}

const VIRTUAL_MODULE_ID = 'virtual:route-meta'
const RESOLVED_VIRTUAL_MODULE_ID = '\0' + VIRTUAL_MODULE_ID

function toRouteMeta(page: MarkdownPage) {
  const { yamlRaw } = page

  if (!yamlRaw) return {}

  return {
    title: getFrontmatterText(yamlRaw, 'title'),
    originalName: getFrontmatterText(yamlRaw, 'originalName'),
    description: getFrontmatterText(yamlRaw, 'description'),
    icon: getFrontmatterValue(yamlRaw, 'icon'),
    image: getFrontmatterValue(yamlRaw, 'image'),
  }
}

export function routeMetaPlugin() {
  function getRouteMeta() {
    const meta: Record<string, RouteMetaEntry> = {}

    for (const page of getMarkdownPages()) {
      meta[page.modulePath] = toRouteMeta(page)
    }

    return meta
  }

  return {
    name: 'vite-plugin-route-meta',

    resolveId(id: string) {
      if (id === VIRTUAL_MODULE_ID) return RESOLVED_VIRTUAL_MODULE_ID
    },

    load(id: string) {
      if (id === RESOLVED_VIRTUAL_MODULE_ID) {
        return `export const routeMeta = ${JSON.stringify(getRouteMeta())};`
      }
    },

    handleHotUpdate({ file, server }: any) {
      if (isMarkdownPage(file)) {
        invalidateMarkdownPages()
        const mod = server.moduleGraph.getModuleById(RESOLVED_VIRTUAL_MODULE_ID)
        if (mod) server.moduleGraph.invalidateModule(mod)
      }
    },
  }
}
