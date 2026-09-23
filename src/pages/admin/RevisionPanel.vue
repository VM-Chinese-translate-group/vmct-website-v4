<template>
  <div
    v-if="open"
    class="fixed inset-0 z-60 flex justify-end bg-black/35"
    @click.self="$emit('close')"
  >
    <aside
      class="h-full w-[min(42rem,100%)] overflow-y-auto border-l border-[var(--switcher-border)] bg-[var(--bg-alt)] p-5 shadow-2xl"
    >
      <header class="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 class="m-0 text-xl">版本历史</h2>
          <p class="mb-0 mt-1 text-sm text-[var(--text-2)]">恢复只会生成草稿，不会自动发布。</p>
        </div>
        <button class="cms-icon-button" type="button" aria-label="关闭" @click="$emit('close')">
          ×
        </button>
      </header>
      <p v-if="loading" class="text-sm text-[var(--text-muted)]">正在读取历史…</p>
      <p
        v-else-if="!revisions.length"
        class="rounded-xl bg-[var(--bg-soft)] p-4 text-sm text-[var(--text-muted)]"
      >
        这个页面还没有发布记录。
      </p>
      <div class="grid gap-2">
        <article
          v-for="item in revisions"
          :key="item.revision"
          class="rounded-xl border border-[var(--switcher-border)] bg-[var(--bg-soft)] p-3"
        >
          <button
            class="flex w-full cursor-pointer items-center gap-3 border-0 bg-transparent p-0 text-left text-[var(--text-1)]"
            @click="load(item.revision)"
          >
            <strong>版本 {{ item.revision }}</strong>
            <span class="text-sm text-[var(--text-2)]">{{ formatDate(item.publishedAt) }}</span>
            <span class="ml-auto">{{ selected?.revision === item.revision ? '⌃' : '⌄' }}</span>
          </button>
          <p v-if="item.message" class="mb-0 mt-2 text-sm text-[var(--text-2)]">
            {{ item.message }}
          </p>
          <div
            v-if="selected?.revision === item.revision"
            class="mt-3 grid gap-3 border-t border-[var(--switcher-border)] pt-3"
          >
            <div class="grid grid-cols-2 gap-2 text-xs max-sm:grid-cols-1">
              <span>历史路径：/{{ selected.path }}</span>
              <span>{{ differenceSummary }}</span>
            </div>
            <details>
              <summary class="cursor-pointer text-sm font-600">查看 Frontmatter</summary>
              <pre class="max-h-52 overflow-auto rounded-lg bg-[var(--bg-alt)] p-3 text-xs">{{
                selected.frontmatter
              }}</pre>
            </details>
            <details>
              <summary class="cursor-pointer text-sm font-600">查看 Markdown</summary>
              <pre
                class="max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-[var(--bg-alt)] p-3 text-xs"
                >{{ selected.body }}</pre>
            </details>
            <button class="cms-button w-fit" type="button" @click="$emit('restore', item.revision)">
              恢复为当前草稿
            </button>
          </div>
        </article>
      </div>
    </aside>
  </div>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { parse } from 'yaml'
import {
  getContentRevision,
  listContentRevisions,
  type ContentRevision,
  type ContentRevisionSummary,
} from '@/api/contentAdmin'
const props = defineProps<{
  open: boolean
  pageId: string
  currentFrontmatter: string
  currentBody: string
}>()
defineEmits<{ close: []; restore: [revision: number] }>()
const loading = ref(false),
  revisions = ref<ContentRevisionSummary[]>([]),
  selected = ref<ContentRevision | null>(null)
watch(
  () => [props.open, props.pageId],
  async () => {
    selected.value = null
    if (!props.open || !props.pageId) return
    loading.value = true
    try {
      revisions.value = (await listContentRevisions(props.pageId)).revisions
    } finally {
      loading.value = false
    }
  },
  { immediate: true },
)
async function load(revision: number) {
  if (selected.value?.revision === revision) {
    selected.value = null
    return
  }
  selected.value = (await getContentRevision(props.pageId, revision)).revision
}
const formatDate = (value: string) =>
  new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  )
const differenceSummary = computed(() => {
  if (!selected.value) return ''
  const historical = (parse(selected.value.frontmatter) || {}) as Record<string, unknown>
  const current = (parse(props.currentFrontmatter) || {}) as Record<string, unknown>
  const keys = new Set([...Object.keys(historical), ...Object.keys(current)])
  const fields = [...keys].filter(
    (key) => JSON.stringify(historical[key]) !== JSON.stringify(current[key]),
  ).length
  const historicalLines = selected.value.body.split('\n'),
    currentLines = props.currentBody.split('\n')
  const lines =
    Math.max(historicalLines.length, currentLines.length) -
    historicalLines.filter((line, index) => line === currentLines[index]).length
  return `与当前草稿相比：${fields} 个字段、${lines} 行正文不同`
})
</script>
