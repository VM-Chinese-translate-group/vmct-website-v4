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

    <div
      class="admin-preview-viewport max-h-[42rem] overflow-auto [background:var(--bg-off-white)] [&_.pack-page-container]:min-h-0 [&_.pack-page-container]:p-[1.25rem] [&_.doc-page-container]:min-h-0 [&_.doc-page-container]:p-[1.25rem] [&_.doc-main]:block [&_.doc-sidebar]:hidden [&_.pack-header]:mb-[1.25rem] [&_.pack-header]:pb-[1.25rem] [&_.header-content]:gap-[1.25rem] [&_.pack-icon]:w-[5rem] [&_.pack-icon]:h-[5rem] [&_.pack-icon]:rounded-[0.875rem] [&_.pack-icon-placeholder]:w-[5rem] [&_.pack-icon-placeholder]:h-[5rem] [&_.pack-icon-placeholder]:rounded-[0.875rem] [&_.title-row_h1]:text-[1.65rem] [&_.pack-main_>_aside]:hidden [&_.pack-content-body]:p-[1.5rem] max-[640px]:[&_.pack-page-container]:p-[1rem] max-[640px]:[&_.header-content]:items-start max-[640px]:[&_.header-content]:flex-row max-[640px]:[&_.header-content]:text-left max-[640px]:[&_.title-row]:items-start max-[640px]:[&_.title-row]:flex-col max-[640px]:[&_.author-row]:items-start max-[640px]:[&_.author-row]:justify-start max-[640px]:[&_.download-button-wrapper]:items-start max-[640px]:[&_.download-button-wrapper]:justify-start"
    >
      <DocLayout v-if="pageKind === 'document'" :meta="previewMeta">
        <article
          class="admin-preview-content [&_img]:max-w-full [&_img]:h-[auto]"
          v-html="rendered"
        />
      </DocLayout>
      <DownloadLayout v-else :meta="previewMeta">
        <article
          class="admin-preview-content [&_img]:max-w-full [&_img]:h-[auto]"
          v-html="rendered"
        />
      </DownloadLayout>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import MarkdownIt from 'markdown-it'
import { container } from '@mdit/plugin-container'
import DownloadLayout from '@/layout/DownloadLayout.vue'
import DocLayout from '@/layout/DocLayout.vue'
import type { ContentMetadata, PageKind } from './types'

const props = defineProps<{ body: string; metadata: ContentMetadata; pageKind: PageKind }>()
const { t } = useI18n()
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
  if (!methods.length)
    return '\n> **下载组件**\n> 下载链接在「下载链接」编辑区配置，保存后在页面显示。\n'

  return `\n### ${t('downloadModal.driveTitle')}\n${methods
    .map((method) => {
      const name =
        method.text || (method.id === 'lazy' ? t('downloadModal.lazyTitle') : method.id || '下载')
      const detail = method.subText ? ` — ${method.subText}` : ''
      return method.link ? `- [**${name}**](${method.link})${detail}` : `- **${name}**${detail}`
    })
    .join('\n')}\n`
}

function previewSource(body: string) {
  return body
    .replace(/<DownloadLayout\b[^>]*>/g, '')
    .replace(/<\/DownloadLayout>/g, '')
    .replace(/<DocLayout\b[^>]*>/g, '')
    .replace(/<\/DocLayout>/g, '')
    .replace(
      /<DocSupport\s*\/>/g,
      () => `
## ${t('supportUs.supportTitle')}

${t('supportUs.supportParagraph1')}

${t('supportUs.supportParagraph2', { afd: t('supportUs.afdText') })}

## ${t('supportUs.joinTitle')}

${t('supportUs.joinParagraph1', { community: t('supportUs.communityText') })}

${t('supportUs.joinParagraph2', { review: t('supportUs.reviewText') })}`,
    )
    .replace(/<DownloadLinks[\s\S]*?\/>/g, (source) => downloadPreview(source))
}

const rendered = computed(() => md.render(previewSource(props.body)))
</script>

<style scoped>
.admin-preview-viewport :deep(.pack-main) {
  grid-template-columns: minmax(0, 1fr);
}
</style>
