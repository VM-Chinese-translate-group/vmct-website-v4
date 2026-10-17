<template>
  <teleport to="body">
    <transition name="search-fade" @after-enter="prepareSearch" @after-leave="resetSearch">
      <div
        v-if="visible"
        class="fixed inset-0 z-2000 flex justify-center overscroll-contain bg-[var(--search-overlay)] pt-[12vh]"
        @click.self="close"
      >
        <div
          class="search-panel flex max-h-[70vh] w-160 max-w-[95%] flex-col overflow-hidden border border-[var(--search-border)] rounded-3 bg-[var(--bg-white)] shadow-[var(--card-shadow)]"
        >
          <div class="flex items-center border-b border-b-[var(--search-border)] px-5">
            <div>
              <Icon icon="lucide:search" class="text-5 text-[var(--text-muted)]" />
            </div>
            <input
              ref="inputRef"
              v-model="keyword"
              class="flex-1 border-none bg-transparent px-3 py-5 text-[1.1rem] text-[var(--search-input-text)] outline-none"
              :placeholder="$t('search.placeholder')"
              aria-controls="site-search-results"
              aria-autocomplete="list"
              aria-keyshortcuts="Escape"
              role="combobox"
              @input="onInput"
            />
            <kbd class="search-shortcut" aria-hidden="true">
              {{ $t('search.esc') }}
            </kbd>
          </div>

          <div
            id="site-search-results"
            ref="resultsAreaRef"
            class="results-area overflow-y-auto overscroll-contain p-2"
            role="listbox"
          >
            <div v-if="results.length" class="results-list">
              <div
                v-for="(item, index) in results"
                :key="item.url"
                :data-result-index="index"
                :class="[
                  'group mb-0.5 flex cursor-pointer items-center rounded-2 px-4 py-[0.85rem] transition-colors duration-150 hover:bg-[var(--search-row-hover)]',
                  index === activeIndex ? 'is-active' : '',
                ]"
                role="option"
                :aria-selected="index === activeIndex"
                @mouseenter="activeIndex = index"
                @click="goTo(item.url)"
              >
                <div class="min-w-0 flex-1">
                  <h4 class="mb-1 mt-0 text-[0.95rem] text-[var(--link-title)] font-600">
                    <template v-for="(part, partIndex) in highlight(item.title)" :key="partIndex">
                      <mark v-if="part.highlighted">{{ part.text }}</mark>
                      <template v-else>{{ part.text }}</template>
                    </template>
                  </h4>
                  <p
                    class="m-0 overflow-hidden text-ellipsis whitespace-nowrap text-[0.85rem] text-[var(--text-light)]"
                  >
                    <template v-for="(part, partIndex) in highlight(item.snippet)" :key="partIndex">
                      <mark v-if="part.highlighted">{{ part.text }}</mark>
                      <template v-else>{{ part.text }}</template>
                    </template>
                  </p>
                </div>
                <div
                  :class="[
                    'result-arrow -translate-x-1.25 text-[1.2rem] text-[var(--brand-primary)] opacity-50 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100',
                  ]"
                >
                  <Icon icon="lucide:chevron-right" />
                </div>
              </div>
            </div>

            <div
              v-else-if="keyword"
              class="search-empty m-0 px-4 py-16 text-center text-[var(--text-muted)]"
            >
              <Icon icon="lucide:search-x" class="mx-auto mb-4 block text-12 opacity-20" />
              <p>{{ $t('search.empty', { query: keyword }) }}</p>
            </div>

            <div v-else class="m-0 px-4 py-16 text-center text-[var(--text-muted)]">
              <p>{{ $t('search.startSearch') }}</p>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Icon } from '@iconify/vue'
import { isEnglishLocale } from '@/utils/resourceDisplay'
import { convertInlineText } from '@/utils/zhconv'
import { createSearchSnippet, normalizeSearchText, rankSearchIndex } from '@/utils/search'
import { usePageScrollLock } from '@/composables/usePageScrollLock'

interface SearchResult {
  snippet: string
  title: string
  url: string
}

interface HighlightPart {
  highlighted: boolean
  text: string
}

const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{ close: [] }>()
const router = useRouter()
const { locale } = useI18n()
const { lock: lockBodyScroll, unlock: unlockBodyScroll } = usePageScrollLock()

const keyword = ref('')
const results = ref<SearchResult[]>([])
const inputRef = ref<HTMLInputElement | null>(null)
const resultsAreaRef = ref<HTMLElement | null>(null)
const activeIndex = ref(-1)
let timer: ReturnType<typeof setTimeout> | undefined
let searchRequestId = 0

const currentLocale = computed(() => locale.value)

const performSearch = async () => {
  const query = keyword.value.trim()
  const normalizedQuery = normalizeSearchText(query)
  const targetLocale = currentLocale.value
  const requestId = ++searchRequestId

  if (!normalizedQuery) {
    results.value = []
    activeIndex.value = -1
    return
  }

  const { searchIndex } = await import('virtual:search-index')
  if (requestId !== searchRequestId || !props.visible) return
  const rankedResults = rankSearchIndex(searchIndex, query, targetLocale)

  const translatedResults = await Promise.all(
    rankedResults.map(async ({ item }) => {
      const [displayTitle, displayText] = await Promise.all([
        convertInlineText(item.title, targetLocale),
        convertInlineText(item.text, targetLocale),
      ])
      const title = formatResultTitle(displayTitle || 'Untitled', item.originalName, targetLocale)

      return {
        url: item.url,
        title,
        snippet: createSearchSnippet(displayText, query),
      }
    }),
  )

  if (
    requestId !== searchRequestId ||
    normalizedQuery !== normalizeSearchText(keyword.value) ||
    targetLocale !== currentLocale.value
  ) {
    return
  }

  results.value = translatedResults
  activeIndex.value = translatedResults.length ? 0 : -1
}

const onInput = () => {
  clearTimeout(timer)
  timer = setTimeout(performSearch, 150)
}

const highlight = (text: string): HighlightPart[] => {
  const terms = [...new Set(keyword.value.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean))]
  if (!terms.length) return [{ highlighted: false, text }]

  const ranges: Array<{ start: number; end: number }> = []
  const normalizedText = text.toLocaleLowerCase()

  for (const term of terms) {
    let matchIndex = normalizedText.indexOf(term)

    while (matchIndex >= 0) {
      ranges.push({ start: matchIndex, end: matchIndex + term.length })
      matchIndex = normalizedText.indexOf(term, matchIndex + term.length)
    }
  }

  if (!ranges.length) return [{ highlighted: false, text }]

  ranges.sort((left, right) => left.start - right.start || right.end - left.end)
  const mergedRanges = ranges.reduce<Array<{ start: number; end: number }>>((merged, range) => {
    const previous = merged.at(-1)
    if (previous && range.start <= previous.end) {
      previous.end = Math.max(previous.end, range.end)
    } else {
      merged.push({ ...range })
    }
    return merged
  }, [])
  const parts: HighlightPart[] = []
  let cursor = 0

  for (const range of mergedRanges) {
    if (range.start > cursor) {
      parts.push({ highlighted: false, text: text.slice(cursor, range.start) })
    }

    parts.push({ highlighted: true, text: text.slice(range.start, range.end) })
    cursor = range.end
  }

  if (cursor < text.length) {
    parts.push({ highlighted: false, text: text.slice(cursor) })
  }

  return parts.length ? parts : [{ highlighted: false, text }]
}

const formatResultTitle = (title: string, originalName?: string, locale = currentLocale.value) => {
  if (isEnglishLocale(locale) && originalName) return originalName
  if (!originalName || title.includes(originalName)) return title
  return `${title}（${originalName}）`
}

const goTo = (url: string) => {
  emit('close')
  router.push(url)
}

const close = () => emit('close')

const prepareSearch = () => {
  inputRef.value?.focus({ preventScroll: true })
  // Parse the index after the opening animation, keeping the shell lightweight.
  void import('virtual:search-index').catch(() => {
    // A later query retries loading if prefetching fails.
  })
}

const resetSearch = () => {
  if (props.visible) return
  unlockBodyScroll()
  keyword.value = ''
  results.value = []
  activeIndex.value = -1
}

const scrollActiveIntoView = () => {
  nextTick(() => {
    const area = resultsAreaRef.value
    if (!area || activeIndex.value < 0) return

    const active = area.querySelector<HTMLElement>(`[data-result-index="${activeIndex.value}"]`)
    active?.scrollIntoView({ block: 'nearest' })
  })
}

const onKeyDown = (e: KeyboardEvent) => {
  if (!props.visible) return

  if (e.key === 'Escape') {
    e.preventDefault()
    close()
    return
  }

  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault()
    e.stopPropagation()

    if (!results.value.length) return

    const direction = e.key === 'ArrowDown' ? 1 : -1
    activeIndex.value =
      (activeIndex.value + direction + results.value.length) % results.value.length
    scrollActiveIntoView()
    return
  }

  if (e.key === 'Enter' && activeIndex.value >= 0) {
    e.preventDefault()
    const activeResult = results.value[activeIndex.value]
    if (activeResult) goTo(activeResult.url)
  }
}

watch(
  () => props.visible,
  (newVal) => {
    if (newVal) {
      lockBodyScroll()
    } else {
      searchRequestId += 1
      clearTimeout(timer)
    }
  },
  { immediate: true },
)

watch(currentLocale, () => {
  if (keyword.value) performSearch()
})

onMounted(() => {
  window.addEventListener('keydown', onKeyDown)
})

onUnmounted(() => {
  searchRequestId += 1
  unlockBodyScroll()
  window.removeEventListener('keydown', onKeyDown)
  clearTimeout(timer)
})
</script>

<style scoped>
.search-shortcut {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 36px;
  height: 24px;
  flex: 0 0 auto;
  padding: 0 7px;
  appearance: none;
  border: 1px solid var(--search-border);
  border-radius: 6px;
  background: var(--bg-soft);
  box-shadow: 0 1px 1px rgba(0, 0, 0, 0.08);
  color: var(--text-muted);
  font-family: inherit;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.03em;
  line-height: 1;
  user-select: none;
}

.search-fade-enter-active,
.search-fade-leave-active {
  transition: opacity 0.18s ease;
}

.search-fade-enter-active .search-panel,
.search-fade-leave-active .search-panel {
  transition: transform 0.18s ease;
  will-change: transform;
}

.search-fade-enter-from,
.search-fade-leave-to {
  opacity: 0;
}

.search-fade-enter-from .search-panel,
.search-fade-leave-to .search-panel {
  transform: translateY(-10px);
}

@media (prefers-reduced-motion: reduce) {
  .search-fade-enter-active,
  .search-fade-leave-active,
  .search-fade-enter-active .search-panel,
  .search-fade-leave-active .search-panel {
    transition: none;
  }
}

:deep(mark) {
  background: var(--search-highlight);
  color: inherit;
  border-radius: 2px;
  padding: 0 1px;
}

.results-area::-webkit-scrollbar {
  width: 6px;
}

.results-area::-webkit-scrollbar-thumb {
  background: var(--switcher-border);
  border-radius: 10px;
}

.results-list [role='option'].is-active {
  background: var(--search-row-hover);
}

.results-list [role='option'].is-active .result-arrow {
  color: var(--brand-primary);
  opacity: 1;
  transform: translateX(0);
}
</style>
