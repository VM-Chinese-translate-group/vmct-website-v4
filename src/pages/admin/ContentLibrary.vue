<template>
  <aside class="cms-library p-2.5">
    <div class="shrink-0">
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
            <small class="shrink-0" :class="stateClass(page.state)">
              {{ stateLabel(page.state) }}
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

const props = defineProps<{ pages: ContentPageSummary[]; selectedId: string }>()
const emit = defineEmits<{ open: [id: string]; new: [kind: PageKind] }>()
const search = ref('')
const newMenuOpen = ref(false)
const filtered = computed(() => {
  const keyword = search.value.trim().toLocaleLowerCase()
  if (!keyword) return props.pages
  return props.pages.filter(
    (page) =>
      page.path.toLocaleLowerCase().includes(keyword) ||
      title(page).toLocaleLowerCase().includes(keyword),
  )
})
const groups = computed(() =>
  PAGE_TYPES.map((type) => ({
    type,
    pages: filtered.value.filter((page) => pageKindFromPath(page.path) === type.value),
  })),
)
function create(kind: PageKind) {
  newMenuOpen.value = false
  emit('new', kind)
}
const title = (page: ContentPageSummary) =>
  parseMetadata(page.draftFrontmatter).title.replace(/\s*汉化下载\s*$/, '') || page.path
const stateLabel = (value: string) =>
  ({ draft: '草稿', published: '已发布', archived: '已下线' })[value] || value
const stateClass = (value: string) =>
  ({
    draft: 'text-amber-700 dark:text-amber-300',
    published: 'text-emerald-700 dark:text-emerald-300',
    archived: 'text-[var(--text-muted)]',
  })[value] || 'text-[var(--text-muted)]'
</script>

<style scoped>
.cms-category-summary::marker {
  display: none;
}
</style>
