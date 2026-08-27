<template>
  <section
    class="min-w-0 overflow-hidden rounded-2xl border border-[var(--switcher-border)] bg-[var(--bg-alt)] shadow-[var(--vp-shadow-1)]"
  >
    <div
      class="flex items-center justify-between border-b border-[var(--switcher-border)] bg-[var(--bg-soft)] px-4 py-3"
    >
      <h3 class="m-0 text-base">页面预览</h3>
      <span
        class="rounded-full bg-[var(--info-soft)] px-2 py-1 text-xs font-600 text-[var(--info-1)]"
      >
        实时
      </span>
    </div>

    <div class="admin-preview-viewport">
      <DownloadLayout :meta="previewMeta">
        <article class="admin-preview-content" v-html="rendered" />
      </DownloadLayout>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import MarkdownIt from 'markdown-it'
import { container } from '@mdit/plugin-container'
import DownloadLayout from '@/layout/DownloadLayout.vue'
import type { ContentMetadata } from './types'

const props = defineProps<{ body: string; metadata: ContentMetadata }>()
const md = new MarkdownIt({ html: false, linkify: true })

for (const type of ['tip', 'warning', 'info', 'details']) {
  md.use(container, {
    name: type,
    openRenderer: (tokens, index) => {
      const info = tokens[index].info
      const title = info.length > type.length ? info.slice(type.length + 1) : type.toUpperCase()
      if (type === 'details')
        return `<details class="custom-block details"><summary>${md.utils.escapeHtml(title)}</summary>\n`
      return `<div class="custom-block ${type}"><p class="custom-block-title">${md.utils.escapeHtml(title)}</p>\n`
    },
    closeRenderer: () => (type === 'details' ? '</details>\n' : '</div>\n'),
  })
}

const previewMeta = computed(() => ({
  title: props.metadata.title,
  originalName: props.metadata.originalName,
  icon: props.metadata.icon,
  description: props.metadata.description,
  updateDate: props.metadata.updateDate,
  authors: props.metadata.authors.filter(Boolean),
  links: props.metadata.links,
  status: props.metadata.statusType ? { type: props.metadata.statusType } : undefined,
  compatibility: {
    minecraft: props.metadata.minecraft,
    loader: props.metadata.loader,
    pack: props.metadata.pack,
  },
}))

function stringProperty(source: string, key: string) {
  return source.match(new RegExp(`${key}\\s*:\\s*(['"])(.*?)\\1`))?.[2] || ''
}

function downloadPreview(source: string) {
  const methods = [...source.matchAll(/\{([\s\S]*?)\}/g)].map((match) => ({
    id: stringProperty(match[1], 'id'),
    text: stringProperty(match[1], 'text'),
    subText: stringProperty(match[1], 'subText'),
    link:
      stringProperty(match[1], 'link') ||
      stringProperty(match[1], 'quarkLink') ||
      stringProperty(match[1], 'lanzouLink'),
  }))
  if (!methods.length) return '\n> **下载组件**\n> 暂未配置下载方式。\n'

  return `\n### 下载方式\n${methods
    .map((method) => {
      const name = method.text || (method.id === 'lazy' ? '懒汉下载' : method.id || '下载')
      const detail = method.subText ? ` — ${method.subText}` : ''
      return method.link ? `- [**${name}**](${method.link})${detail}` : `- **${name}**${detail}`
    })
    .join('\n')}\n`
}

function previewSource(body: string) {
  return body
    .replace(/<DownloadLayout\b[^>]*>/g, '')
    .replace(/<\/DownloadLayout>/g, '')
    .replace(
      /<DocSupport\s*\/>/g,
      `
## 支持我们

您的支持与鼓励是我们前进的动力！如果可以，请向他人推荐我们的汉化作品，十分感谢！

我们一直在用爱发电。您也可以在爱发电支持我们，或在 B 站关注我们的账号。

## 加入社区

加入我们的 QQ 交流群，可以进一步了解翻译进度等最新消息。也欢迎参与贡献并加入 VM 汉化组！`,
    )
    .replace(/<DownloadLinks[\s\S]*?\/>/g, (source) => downloadPreview(source))
    .replace(/::: (warning|info|tip|details) (.*)\n([\s\S]*?)\n:::/g, '> **$2**\n>\n> $3')
}

const rendered = computed(() => md.render(previewSource(props.body)))
</script>

<style scoped>
.admin-preview-viewport {
  max-height: 42rem;
  overflow: auto;
  background: var(--bg-off-white);
}

.admin-preview-viewport :deep(.pack-page-container) {
  min-height: 0;
  padding: 1.25rem;
}

.admin-preview-viewport :deep(.pack-header) {
  margin-bottom: 1.25rem;
  padding-bottom: 1.25rem;
}

.admin-preview-viewport :deep(.header-content) {
  gap: 1.25rem;
}

.admin-preview-viewport :deep(.pack-icon),
.admin-preview-viewport :deep(.pack-icon-placeholder) {
  width: 5rem;
  height: 5rem;
  border-radius: 0.875rem;
}

.admin-preview-viewport :deep(.title-row h1) {
  font-size: 1.65rem;
}

.admin-preview-viewport :deep(.pack-main) {
  grid-template-columns: minmax(0, 1fr);
}

.admin-preview-viewport :deep(.pack-main > aside) {
  display: none;
}

.admin-preview-viewport :deep(.pack-content-body) {
  padding: 1.5rem;
}

.admin-preview-content :deep(img) {
  max-width: 100%;
  height: auto;
}

@media (max-width: 640px) {
  .admin-preview-viewport :deep(.pack-page-container) {
    padding: 1rem;
  }

  .admin-preview-viewport :deep(.header-content) {
    align-items: flex-start;
    flex-direction: row;
    text-align: left;
  }

  .admin-preview-viewport :deep(.title-row) {
    align-items: flex-start;
    flex-direction: column;
  }

  .admin-preview-viewport :deep(.author-row),
  .admin-preview-viewport :deep(.download-button-wrapper) {
    align-items: flex-start;
    justify-content: flex-start;
  }
}
</style>
