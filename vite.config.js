import { defineConfig } from 'vite'
import { loadSiteConfig } from './config/load-site.mjs'
import path from 'node:path'

import vue from '@vitejs/plugin-vue'
import Markdown from 'unplugin-vue-markdown/vite'
import Components from 'unplugin-vue-components/vite'
import UnoCSS from 'unocss/vite'

import Sitemap from 'vite-plugin-sitemap'
import compression from 'vite-plugin-compression2'

import { imgSize } from '@mdit/plugin-img-size'
import { container } from '@mdit/plugin-container'

import anchor from 'markdown-it-anchor'
import toc from 'markdown-it-table-of-contents'
import Shiki from '@shikijs/markdown-it'

import Card from './src/components/Card/card.js'

import { getGitBranch, getGitCommitHash, getGitEnv, getGitCommitDate } from './src/plugins/git.ts'
import { getMarkdownRoutes } from './src/plugins/contentScanner.ts'
import { resourcesPlugin } from './src/plugins/resourcesList.ts'
import { routeMetaPlugin } from './src/plugins/routeMeta.ts'
import { searchIndexPlugin } from './src/plugins/searchIndex.ts'
import { prerenderRoutesPlugin } from './src/plugins/prerenderRoutes.ts'

const gitEnv = getGitEnv()

const repoPath =
  gitEnv.owner && gitEnv.name
    ? `${gitEnv.owner}/${gitEnv.name}`
    : 'VM-Chinese-translate-group/vmct-website-v4'

export default defineConfig(({ mode, isSsrBuild }) => {
  const siteConfig = loadSiteConfig(mode)
  return {
    define: {
      __SITE_CONFIG__: JSON.stringify(siteConfig),
      'import.meta.env.VITE_GIT_COMMIT': JSON.stringify(getGitCommitHash()),
      'import.meta.env.VITE_GIT_BRANCH': JSON.stringify(getGitBranch()),
      'import.meta.env.VITE_GIT_REPO': JSON.stringify(repoPath),
      'import.meta.env.VITE_GIT_DATE': JSON.stringify(getGitCommitDate()),
    },

    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, 'src'),
      },
    },

    plugins: [
      UnoCSS(),

      Markdown({
        async markdownItSetup(md) {
          const defaultImageRenderer =
            md.renderer.rules.image ||
            ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options))

          // 链接优化
          md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
            const token = tokens[idx]
            const aIndex = token.attrIndex('href')

            if (aIndex >= 0 && token.attrs) {
              const href = token.attrs[aIndex]?.[1]

              if (href && /^https?:\/\//.test(href)) {
                token.attrSet('target', '_blank')
                token.attrSet('rel', 'noopener')
              }
            }

            return self.renderToken(tokens, idx, options)
          }

          md.renderer.rules.image = (tokens, idx, options, env, self) => {
            tokens[idx].attrSet('data-md-image-preview', 'true')
            const image = defaultImageRenderer(tokens, idx, options, env, self)
            return `<span class="image-loading-frame markdown-image-loading-frame">${image}</span>`
          }

          md.use(anchor, {
            permalink: anchor.permalink.ariaHidden({
              placement: 'before',
              symbol: '#',
              class: 'header-anchor',
            }),
          })

          md.use(toc, {
            includeLevel: [2, 3],
            containerClass: 'markdown-toc',
          })

          md.use(
            await Shiki({
              themes: {
                light: 'github-light',
                dark: 'github-dark',
              },
              defaultColor: false,
              langs: ['json', 'toml'],
            }),
          )

          md.use(Card)
          md.use(imgSize)

          const types = ['tip', 'warning', 'info', 'details']

          types.forEach((type) => {
            md.use(container, {
              name: type,

              openRenderer: (tokens, index) => {
                const info = tokens[index].info
                const title =
                  info.length > type.length ? info.slice(type.length + 1) : type.toUpperCase()

                if (type === 'details') {
                  return `<details class="custom-block details"><summary>${md.utils.escapeHtml(title)}</summary>\n`
                }

                return `<div class="custom-block ${type}"><p class="custom-block-title">${md.utils.escapeHtml(title)}</p>\n`
              },

              closeRenderer: () => (type === 'details' ? '</details>\n' : '</div>\n'),
            })
          })
        },
      }),

      vue({
        include: [/\.vue$/, /\.md$/],
      }),

      Components({
        dirs: ['src/components', 'src/layout'],
        extensions: ['vue', 'md'],
        include: [/\.vue$/, /\.md$/],
        dts: false,
      }),

      resourcesPlugin(),

      routeMetaPlugin(),

      searchIndexPlugin(),

      prerenderRoutesPlugin(),

      !isSsrBuild &&
        Sitemap({
          hostname: siteConfig.siteUrl,
          generateRobotsTxt: true,
          dynamicRoutes: [...getMarkdownRoutes(), '/translation-feedback'],
        }),

      compression({
        threshold: 10240,
      }),
    ],

    // Pages Functions do not run inside Vite. In development, keep the browser
    // on localhost while proxying API requests to the deployed services.
    server: {
      proxy: {
        '/api/content': {
          target: siteConfig.contentOrigin,
          changeOrigin: true,
          headers: { Origin: siteConfig.contentOrigin },
          cookieDomainRewrite: '',
        },
        '/api': {
          target: siteConfig.apiBaseUrl,
          changeOrigin: true,
          headers: { Origin: siteConfig.apiBaseUrl },
          cookieDomainRewrite: '',
        },
      },
    },

    build: {
      rolldownOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('/node_modules/vue/')) return 'vue'
            if (id.includes('markdown-it')) return 'markdown'
            if (id.includes('@shikijs')) return 'shiki'
            if (id.includes('opencc')) return 'opencc'
          },
        },
      },
    },
  }
})
