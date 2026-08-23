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

    <header class="border-b border-[var(--switcher-border)] p-5">
      <div class="flex items-start gap-4">
        <img
          v-if="metadata.icon"
          :src="metadata.icon"
          :alt="metadata.title"
          class="size-16 shrink-0 rounded-xl border border-[var(--switcher-border)] object-cover"
        />
        <div
          v-else
          class="grid size-16 shrink-0 place-items-center rounded-xl bg-[var(--bg-soft)] text-2xl text-[var(--text-muted)]"
        >
          ◇
        </div>
        <div class="min-w-0">
          <h1 class="m-0 break-words text-xl">{{ metadata.title || '未命名页面' }}</h1>
          <p v-if="metadata.originalName" class="mb-0 mt-1 text-sm text-[var(--text-2)]">
            {{ metadata.originalName }}
          </p>
          <div class="mt-2 flex flex-wrap gap-1.5 text-xs text-[var(--text-2)]">
            <span v-if="metadata.minecraft" class="rounded-md bg-[var(--bg-soft)] px-2 py-1">
              MC {{ metadata.minecraft }}
            </span>
            <span v-if="metadata.loader" class="rounded-md bg-[var(--bg-soft)] px-2 py-1">
              {{ metadata.loader }}
            </span>
            <span v-if="metadata.pack" class="rounded-md bg-[var(--bg-soft)] px-2 py-1">
              版本 {{ metadata.pack }}
            </span>
          </div>
        </div>
      </div>
      <p
        v-if="metadata.description"
        class="mb-0 mt-4 whitespace-pre-line text-sm leading-relaxed text-[var(--text-2)]"
      >
        {{ metadata.description }}
      </p>
      <p
        v-if="metadata.authors.filter(Boolean).length"
        class="mb-0 mt-3 text-xs text-[var(--text-muted)]"
      >
        by {{ metadata.authors.filter(Boolean).join(' · ') }}
      </p>
      <div v-if="relatedLinks.length" class="mt-4 flex flex-wrap gap-2">
        <a
          v-for="(link, index) in relatedLinks"
          :key="`${link.id}-${index}`"
          :href="link.link"
          target="_blank"
          rel="noopener noreferrer"
          class="rounded-lg border border-[var(--switcher-border)] bg-[var(--bg-soft)] px-2.5 py-1.5 text-xs font-600 text-[var(--info-1)] no-underline"
        >
          {{ link.text }}
        </a>
      </div>
    </header>

    <article
      class="max-h-[42rem] overflow-auto p-5 text-sm leading-7 text-[var(--text-1)] [&_a]:text-[var(--info-1)] [&_blockquote]:my-4 [&_blockquote]:border-l-4 [&_blockquote]:border-[var(--warning-1)] [&_blockquote]:bg-[var(--warning-soft)] [&_blockquote]:px-4 [&_blockquote]:py-2 [&_code]:rounded [&_code]:bg-[var(--bg-soft)] [&_code]:px-1.5 [&_h1]:text-2xl [&_h2]:mb-2 [&_h2]:mt-7 [&_h2]:text-xl [&_h3]:mt-5 [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-lg [&_pre]:overflow-auto [&_pre]:rounded-lg [&_pre]:bg-[var(--bg-soft)] [&_pre]:p-3"
      v-html="rendered"
    />
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import MarkdownIt from 'markdown-it'
import { resolveRelatedLink } from '@/data/relatedLinks'
import type { ContentMetadata } from './types'

const props = defineProps<{ body: string; metadata: ContentMetadata }>()
const md = new MarkdownIt({ html: false, breaks: true, linkify: true })

const relatedLinks = computed(() =>
  props.metadata.links
    .map((item) =>
      resolveRelatedLink(item, (key) =>
        key === 'pack.links.i18n' ? 'i18n 下载' : key === 'pack.links.github' ? 'GitHub 仓库' : key,
      ),
    )
    .filter((item) => item.text && item.link),
)

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
