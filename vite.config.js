import { defineConfig } from 'vite'
import path from 'node:path'
import { constants } from 'node:zlib'
import vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
import UnoCSS from 'unocss/vite'
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
    vue(),
    Components({ dirs: ['src/components', 'src/layout'], extensions: ['vue'], include: [/\.vue$/], dts: false }),
    !isSsrBuild && compression({
      threshold: 10240,
      algorithms: ['gzip', ['brotliCompress', { params: { [constants.BROTLI_PARAM_QUALITY]: 6 } }]],
    }),
  ],
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
