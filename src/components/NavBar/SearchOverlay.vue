<template>
  <teleport to="#vmct-overlays">
    <transition name="search-fade" @after-enter="prepareSearch" @after-leave="resetSearch">
      <div
        v-if="visible"
        class="fixed inset-0 z-2000 flex justify-center overscroll-contain bg-[var(--search-overlay)] pt-[12vh]"
        @click.self="close"
      >
        <div
          class="search-panel [.search-fade-enter-active_&]:[transition:transform_0.18s_ease] [.search-fade-enter-active_&]:[will-change:transform] [.search-fade-leave-active_&]:[transition:transform_0.18s_ease] [.search-fade-leave-active_&]:[will-change:transform] [.search-fade-enter-from_&]:[transform:translateY(-10px)] [.search-fade-leave-to_&]:[transform:translateY(-10px)] motion-reduce:[.search-fade-enter-active_&]:[transition:none] motion-reduce:[.search-fade-leave-active_&]:[transition:none] flex max-h-[70vh] w-160 max-w-[95%] flex-col overflow-hidden border border-[var(--search-border)] rounded-3 bg-[var(--bg-white)] shadow-[var(--card-shadow)]"
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
            <kbd
              class="search-shortcut box-border inline-flex items-center justify-center min-w-[36px] h-6 flex-none p-[0_7px] appearance-none [border:1px_solid_var(--search-border)] rounded-md [background:var(--bg-soft)] [box-shadow:0_1px_1px_rgba(0,_0,_0,_0.08)] text-[var(--text-muted)] [font-family:inherit] text-[11px] font-600 tracking-[0.03em] leading-[1] select-none"
              aria-hidden="true"
            >
              {{ $t('search.esc') }}
            </kbd>
          </div>

          <div
            id="site-search-results"
            ref="resultsAreaRef"
            class="results-area [&::-webkit-scrollbar]:w-[6px] [&::-webkit-scrollbar-thumb]:[background:var(--switcher-border)] [&::-webkit-scrollbar-thumb]:rounded-[10px] overflow-y-auto overscroll-contain p-2"
            role="listbox"
          >
            <div
              v-if="keyword && (searching || searchFailed)"
              class="px-4 py-16 text-center text-[var(--text-muted)]"
              role="status"
            >
              {{ $t(searching ? 'search.loading' : 'search.loadFailed') }}
            </div>
            <div v-else-if="results.length" class="results-list">
              <div
                v-for="(item, index) in results"
                :key="item.url"
                :data-result-index="index"
                :class="[
                  'group mb-0.5 flex cursor-pointer items-center rounded-2 px-4 py-[0.85rem] transition-colors duration-150 hover:bg-[var(--search-row-hover)]',
                  index === activeIndex ? 'is-active vm-search-is-active' : '',
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
                    'result-arrow vm-search-result-arrow -translate-x-1.25 text-[1.2rem] text-[var(--brand-primary)] opacity-50 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100',
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
import { useSiteContent } from '@/content/store'
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
const content = useSiteContent()
const { locale } = useI18n()
const { lock: lockBodyScroll, unlock: unlockBodyScroll } = usePageScrollLock()

const keyword = ref('')
const results = ref<SearchResult[]>([])
const inputRef = ref<HTMLInputElement | null>(null)
const resultsAreaRef = ref<HTMLElement | null>(null)
const activeIndex = ref(-1)
const searching = ref(false)
const searchFailed = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined
let searchRequestId = 0
let indexRequest: ReturnType<typeof content.loadSearchIndex> | undefined

const currentLocale = computed(() => locale.value)

function loadIndex() {
  if (!indexRequest) {
    const pending = content.loadSearchIndex()
    indexRequest = pending
    void pending.catch(() => {
      if (indexRequest === pending) indexRequest = undefined
    })
  }
  return indexRequest
}

const performSearch = async () => {
  const query = keyword.value.trim()
  const normalizedQuery = normalizeSearchText(query)
  const targetLocale = currentLocale.value
  const requestId = ++searchRequestId

  results.value = []
  activeIndex.value = -1
  searchFailed.value = false
  searching.value = Boolean(normalizedQuery && props.visible)
  if (!searching.value) return

  const isCurrent = () =>
    props.visible &&
    requestId === searchRequestId &&
    normalizedQuery === normalizeSearchText(keyword.value) &&
    targetLocale === currentLocale.value
  try {
    const index = await loadIndex()
    if (!isCurrent()) return
    const rankedResults = rankSearchIndex(index, query, targetLocale)
    const translatedResults = await Promise.all(
      rankedResults.map(async ({ item }) => {
        const [displayTitle, displayText] = await Promise.all([
          convertInlineText(item.title, targetLocale),
          convertInlineText(item.text, targetLocale),
        ])
        return {
          url: item.url,
          title: formatResultTitle(displayTitle || 'Untitled', item.originalName, targetLocale),
          snippet: createSearchSnippet(displayText, query),
        }
      }),
    )
    if (!isCurrent()) return
    results.value = translatedResults
    activeIndex.value = translatedResults.length ? 0 : -1
  } catch {
    if (isCurrent()) searchFailed.value = true
  } finally {
    if (requestId === searchRequestId) searching.value = false
  }
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
      loadIndex()
      if (keyword.value) void performSearch()
    } else {
      indexRequest = undefined
      searching.value = false
      searchFailed.value = false
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
