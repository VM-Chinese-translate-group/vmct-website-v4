import { defineConfig } from 'vite'
import path from 'node:path'
import { constants } from 'node:zlib'
import vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
import UnoCSS from 'unocss/vite'
import Markdown from 'unplugin-vue-markdown/vite'
import compression from 'vite-plugin-compression2'
import { getGitBranch, getGitCommitHash, getGitEnv, getGitCommitDate } from './src/plugins/git.ts'

const gitEnv = getGitEnv()
const repoPath = gitEnv.owner && gitEnv.name ? `${gitEnv.owner}/${gitEnv.name}` : 'VM-Chinese-translate-group/vmct-website-v4'

export default defineConfig(({ isSsrBuild }) => ({
  define: {
    'import.meta.env.VITE_GIT_COMMIT': JSON.stringify(getGitCommitHash()),
    'import.meta.env.VITE_GIT_BRANCH': JSON.stringify(getGitBranch()),
    'import.meta.env.VITE_GIT_REPO': JSON.stringify(repoPath),
    'import.meta.env.VITE_GIT_DATE': JSON.stringify(getGitCommitDate()),
  },
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  plugins: [
    UnoCSS(),
    vue({ include: [/\.vue$/, /\.md$/] }),
    Markdown({
      headEnabled: false,
      markdownOptions: { html: true, linkify: true },
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
    proxy: {
      '/api/content': {
        target: process.env.CONTENT_API_ORIGIN || 'https://www.vmct.top',
        changeOrigin: true,
        headers: { Origin: process.env.CONTENT_API_ORIGIN || 'https://www.vmct.top' },
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
          if (id.includes('opencc')) return 'opencc'
        },
      },
    },
  },
}))
