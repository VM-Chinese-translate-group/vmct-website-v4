import type { Plugin } from 'vite'
import { getMarkdownPages, invalidateMarkdownPages, isMarkdownPage } from './contentScanner.ts'

const MODULE_ID = 'virtual:markdown-pages'
const RESOLVED_MODULE_ID = '\0' + MODULE_ID

export function markdownPagesPlugin(): Plugin {
  return {
    name: 'vite-plugin-markdown-pages',
    resolveId(id) {
      if (id === MODULE_ID) return RESOLVED_MODULE_ID
    },
    load(id) {
      if (id !== RESOLVED_MODULE_ID) return

      // Only import the winning page for each route. Globbing both directories
      // compiles and emits repository pages even when the CMS overrides them.
      const entries = getMarkdownPages().map((page) => {
        const source = '/src/' + page.modulePath.replace(/^\.\.\//, '')
        this.addWatchFile(page.fullPath)
        return `${JSON.stringify(page.modulePath)}: () => import(${JSON.stringify(source)})`
      })
      return `export const mdComponents = {${entries.join(',\n')}};`
    },
    configureServer(server) {
      // Content edits use normal Markdown HMR; additions and removals change
      // the loader map and may switch between a CMS page and its fallback.
      const updateRoutes = (file: string) => {
        if (!isMarkdownPage(file)) return
        invalidateMarkdownPages()
        server.moduleGraph.invalidateAll()
        server.ws.send({ type: 'full-reload' })
      }
      server.watcher.on('add', updateRoutes)
      server.watcher.on('unlink', updateRoutes)
      server.httpServer?.once('close', () => {
        server.watcher.off('add', updateRoutes)
        server.watcher.off('unlink', updateRoutes)
      })
    },
  }
}
