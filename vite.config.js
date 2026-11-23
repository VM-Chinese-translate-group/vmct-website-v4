import { defineConfig } from 'vite'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { constants } from 'node:zlib'
import vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
import UnoCSS from 'unocss/vite'
import Markdown from 'unplugin-vue-markdown/vite'
import compression from 'vite-plugin-compression2'
import { getGitBranch, getGitCommitHash, getGitEnv, getGitCommitDate } from './src/plugins/git.ts'

const gitEnv = getGitEnv()
const repoPath = gitEnv.owner && gitEnv.name ? `${gitEnv.owner}/${gitEnv.name}` : 'VM-Chinese-translate-group/vmct-website-v4'
const announcementMarkdownRE = /(?:^|[\\/])src[\\/]content[\\/]announcements[\\/].*\.md$/

export default defineConfig(({ command, isPreview, isSsrBuild }) => ({
  appType: command === 'serve' && !isPreview ? 'custom' : 'spa',
  define: {
    'import.meta.env.VITE_GIT_COMMIT': JSON.stringify(getGitCommitHash()),
    'import.meta.env.VITE_GIT_BRANCH': JSON.stringify(getGitBranch()),
    'import.meta.env.VITE_GIT_REPO': JSON.stringify(repoPath),
    'import.meta.env.VITE_GIT_DATE': JSON.stringify(getGitCommitDate()),
  },
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  ssr: { noExternal: ['@iconify-icons/lucide', '@iconify-icons/mdi'] },
  plugins: [
    {
      name: 'vmct-development-server',
      apply: 'serve',
      async configureServer(vite) {
        const { createApplication } = await import(
          pathToFileURL(path.resolve(import.meta.dirname, 'server/index.mjs')).href
        )
        const app = await createApplication({ vite })
        vite.httpServer.once('close', () => {
          void app.close().catch((error) => vite.config.logger.error(String(error)))
        })
        return () => vite.middlewares.use(app.handle)
      },
    },
    UnoCSS(),
    vue({ include: [/\.vue$/, announcementMarkdownRE] }),
    Markdown({
      include: [announcementMarkdownRE],
      headEnabled: false,
      markdownOptions: { html: true, linkify: true },
      frontmatterPreprocess(frontmatter, options, _id, defaultHeadProcess) {
        const data = { sourceButton: null, ...frontmatter }
        return { head: defaultHeadProcess(data, options), frontmatter: data }
      },
      markdownSetup(md) {
        const link = md.renderer.rules.link_open
        md.renderer.rules.link_open = (tokens, index, options, env, self) => {
          const href = tokens[index].attrGet('href')
          if (typeof href === 'string' && /^https?:\/\//.test(href)) {
            tokens[index].attrSet('target', '_blank')
            tokens[index].attrSet('rel', 'noopener noreferrer')
          }
          return link ? link(tokens, index, options, env, self) : self.renderToken(tokens, index, options)
        }
      },
    }),
    Components({ dirs: ['src/components', 'src/layout'], extensions: ['vue'], include: [/\.vue$/], dts: false }),
    !isSsrBuild && compression({
      threshold: 10240,
      algorithms: ['gzip', ['brotliCompress', { params: { [constants.BROTLI_PARAM_QUALITY]: 6 } }]],
    }),
  ],

  // Keep development requests same-origin while proxying to the public ECS API.
  // Set FEEDBACK_API_ORIGIN to a local API when testing feedback mutations.
  server: {
    host: process.env.HOST || '127.0.0.1',
    port: Number(process.env.PORT || 5173),
    proxy: {
      '/api/content': {
        target: process.env.CONTENT_API_ORIGIN || 'https://www.vmct.top',
        changeOrigin: true,
        headers: { Origin: process.env.CONTENT_API_ORIGIN || 'https://www.vmct.top' },
      bypass(req) {
        const url = new URL(req.url || '/', 'http://localhost')
        const view = url.searchParams.get('view')
        if (url.pathname === '/api/content/internal/export' && (view === 'route' || view === 'search'))
          return req.url
      },
      },
      '/api/translation-feedback': {
        target: process.env.FEEDBACK_API_ORIGIN || 'https://www.vmct.top',
        changeOrigin: true,
        headers: { Origin: process.env.FEEDBACK_API_ORIGIN || 'https://www.vmct.top' },
      },
    },
  },

  build: {
    outDir: path.resolve(import.meta.dirname, process.env.SITE_BUILD_DIR || 'dist', isSsrBuild ? 'server' : ''),
    ssrManifest: !isSsrBuild,
    copyPublicDir: !isSsrBuild,
    reportCompressedSize: !isSsrBuild,
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/vue/')) return 'vue'
          if (id.includes('markdown-it')) return 'markdown'
        },
      },
    },
  },
}))
