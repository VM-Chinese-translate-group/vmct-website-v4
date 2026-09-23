<template>
  <aside class="cms-library p-2.5">
    <div class="shrink-0">
      <section
        class="mb-2 rounded-xl border border-[var(--switcher-border)] bg-[var(--bg-alt)] p-2"
      >
        <div class="flex items-center gap-2 px-1 py-1.5">
          <strong class="text-sm">更改</strong>
          <span
            class="rounded-full bg-amber-500/12 px-2 py-0.5 text-xs font-700 text-amber-700 dark:text-amber-300"
          >
            {{ changedPages.length }}
          </span>
          <button
            v-if="changedPages.length"
            class="ml-auto border-0 bg-transparent p-0 text-xs text-[var(--info-1)]"
            type="button"
            @click="toggleAllChanges"
          >
            {{ allChangesSelected ? '全部取消' : '全选' }}
          </button>
        </div>
        <div v-if="changedPages.length" class="grid max-h-52 gap-0.5 overflow-y-auto">
          <div
            v-for="page in changedPages"
            :key="page.id"
            class="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-[var(--info-soft)]"
            :class="{ 'bg-[var(--info-soft)]': page.id === selectedId }"
          >
            <input
              type="checkbox"
              :checked="selectedChanges.includes(page.id)"
              :aria-label="`选择 ${title(page)}`"
              @change="toggleChange(page.id)"
            />
            <button
              class="min-w-0 flex-1 border-0 bg-transparent p-0 text-left text-[inherit]"
              type="button"
              @click.prevent="$emit('open', page.id)"
            >
              <span class="block truncate text-sm">{{ title(page) }}</span>
              <small class="block truncate font-mono text-[var(--text-muted)]">
                /{{ page.path }}
              </small>
            </button>
            <small class="shrink-0 font-700 text-amber-700 dark:text-amber-300">
              {{ page.state === 'draft' ? '新页面 · 未发布' : '草稿已同步 · 未发布' }}
            </small>
            <button
              v-if="page.state === 'published'"
              class="grid size-7 shrink-0 place-items-center rounded-md border-0 bg-transparent text-base text-[var(--text-muted)] hover:bg-red-500/10 hover:text-red-600"
              type="button"
              title="撤回草稿，恢复线上版本"
              :aria-label="`撤回 ${title(page)} 的草稿`"
              @click="$emit('discard', page.id)"
            >
              ↶
            </button>
          </div>
          <button
            class="cms-primary-button mt-1 w-full justify-center"
            type="button"
            :disabled="busy || !selectedChanges.length"
            @click="$emit('publish-selected')"
          >
            {{ busy ? '发布中…' : `发布所选 (${selectedChanges.length})` }}
          </button>
        </div>
        <p v-else class="m-0 px-1 py-1.5 text-xs text-[var(--text-muted)]">没有待发布的更改</p>
      </section>
      <button
        class="cms-page-row"
        :class="{ 'bg-[var(--info-soft)] text-[var(--info-1)]': !selectedId }"
        type="button"
        @click="newMenuOpen = !newMenuOpen"
      >
        ＋ 新页面
      </button>
      <div v-if="newMenuOpen" class="grid gap-1 px-1 py-1">
        <button
          v-for="type in PAGE_TYPES"
          :key="type.value"
          class="cms-page-row"
          type="button"
          @click="create(type.value)"
        >
          <span>{{ type.label }}</span>
          <small class="text-[var(--text-muted)]">{{ type.hint }}</small>
        </button>
      </div>
      <label class="sr-only" for="content-search">搜索页面</label>
      <input
        id="content-search"
        v-model="search"
        class="cms-field my-2 w-full text-sm"
        type="search"
        placeholder="搜索页面路径"
      />
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
      <details
        v-for="group in groups"
        :key="group.type.value"
        class="group/category my-1"
        :open="group.type.value !== 'document' && Boolean(group.pages.length)"
      >
        <summary
          class="cms-category-summary flex cursor-pointer list-none items-center gap-2 rounded-lg px-3 py-2 font-700 hover:bg-[var(--bg-alt)]"
        >
          <span class="w-4 shrink-0 text-center transition-transform group-open/category:rotate-90">
            ›
          </span>
          <span>{{ group.type.label }}</span>
          <small class="ml-auto text-[var(--text-muted)]">{{ group.pages.length }}</small>
        </summary>
        <div class="grid gap-0.5 pl-3">
          <button
            v-for="page in group.pages"
            :key="page.id"
            class="cms-page-row"
            :class="{ 'bg-[var(--info-soft)] text-[var(--info-1)]': page.id === selectedId }"
            type="button"
            @click="$emit('open', page.id)"
          >
            <span class="truncate">{{ title(page) }}</span>
            <small class="shrink-0" :class="stateClass(page)">
              {{ stateLabel(page) }}
            </small>
          </button>
          <p v-if="!group.pages.length" class="m-0 px-3 py-2 text-xs text-[var(--text-muted)]">
            暂无内容
          </p>
        </div>
      </details>
      <p v-if="search && !filtered.length" class="px-3 py-2 text-sm text-[var(--text-muted)]">
        未找到匹配页面
      </p>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ContentPageSummary } from '@/api/contentAdmin'
import { PAGE_TYPES, pageKindFromPath } from './contentConfig'
import { parseMetadata, type PageKind } from './types'

const props = defineProps<{
  pages: ContentPageSummary[]
  selectedId: string
  selectedChanges: string[]
  busy: boolean
}>()
const emit = defineEmits<{
  open: [id: string]
  new: [kind: PageKind]
  'update:selectedChanges': [ids: string[]]
  'publish-selected': []
  discard: [id: string]
}>()
const search = ref('')
const newMenuOpen = ref(false)
const filtered = computed(() => {
  const keyword = search.value.trim().toLocaleLowerCase()
  const pages = keyword
    ? props.pages.filter(
        (page) =>
          page.path.toLocaleLowerCase().includes(keyword) ||
          title(page).toLocaleLowerCase().includes(keyword),
      )
    : props.pages
  return [...pages].sort((left, right) => {
    const pending =
      Number(Boolean(right.hasUnpublishedChanges)) - Number(Boolean(left.hasUnpublishedChanges))
    if (pending) return pending
    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
  })
})
const groups = computed(() =>
  PAGE_TYPES.map((type) => ({
    type,
    pages: filtered.value.filter((page) => pageKindFromPath(page.path) === type.value),
  })),
)
const changedPages = computed(() =>
  props.pages.filter((page) => Boolean(page.hasUnpublishedChanges) && page.state !== 'archived'),
)
const allChangesSelected = computed(
  () =>
    changedPages.value.length > 0 &&
    changedPages.value.every((page) => props.selectedChanges.includes(page.id)),
)
function toggleChange(id: string) {
  const selected = new Set(props.selectedChanges)
  if (selected.has(id)) selected.delete(id)
  else selected.add(id)
  emit('update:selectedChanges', [...selected])
}
function toggleAllChanges() {
  const changedIds = changedPages.value.map((page) => page.id)
  emit('update:selectedChanges', allChangesSelected.value ? [] : changedIds)
}
function create(kind: PageKind) {
  newMenuOpen.value = false
  emit('new', kind)
}
const title = (page: ContentPageSummary) =>
  parseMetadata(page.draftFrontmatter).title.replace(/\s*汉化下载\s*$/, '') || page.path
const stateLabel = (page: ContentPageSummary) => {
  if (page.state === 'archived') return '已下线'
  if (page.state === 'draft') return '未发布'
  if (page.hasUnpublishedChanges) return '有修改'
  return '已发布'
}
const stateClass = (page: ContentPageSummary) => {
  if (page.state === 'archived') return 'text-[var(--text-muted)]'
  if (page.state === 'draft' || page.hasUnpublishedChanges)
    return 'text-amber-700 dark:text-amber-300'
  return 'text-emerald-700 dark:text-emerald-300'
}
</script>

<style scoped>
.cms-category-summary::marker {
  display: none;
}
</style>
