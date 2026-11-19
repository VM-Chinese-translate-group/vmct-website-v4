<template>
  <Teleport to="#vmct-overlays">
    <section
      v-if="browseOpen"
      id="site-announcements-list"
      ref="listRef"
      class="announcement-popover"
      :style="listPosition"
      role="dialog"
      aria-labelledby="site-announcements-list-title"
      tabindex="-1"
    >
      <header class="announcement-popover-header">
        <h2 id="site-announcements-list-title">{{ t('announcements.title') }}</h2>
        <button
          ref="listCloseRef"
          type="button"
          class="announcement-popover-close"
          :aria-label="t('announcements.closeLabel')"
          @click="closeList(true)"
        >
          <Icon icon="lucide:x" aria-hidden="true" />
        </button>
      </header>
      <div class="announcement-popover-body">
        <AnnouncementList id-prefix="site-announcement-item" @select="selectAnnouncement" />
      </div>
    </section>
  </Teleport>
  <BaseDialog
    id="site-announcements"
    v-model:open="open"
    :title="selectedAnnouncement ? selectedAnnouncement.title : t('announcements.title')"
    :close-label="t('announcements.closeLabel')"
    :show-close="!selectedAnnouncement"
    width="720px"
    class="entry-announcement-popup"
    :class="{ 'has-return': canReturnToList }"
  >
    <template #header-start>
      <button
        v-if="canReturnToList"
        type="button"
        class="entry-announcement-back"
        :aria-label="t('announcements.backToList')"
        :title="t('announcements.backToList')"
        @click="returnToList"
      >
        <Icon icon="lucide:arrow-left" aria-hidden="true" />
        {{ t('announcements.backToList') }}
      </button>
    </template>
    <template v-if="selectedAnnouncement">
      <div ref="detailContentRef" class="entry-announcement-content" tabindex="-1">
        <component :is="selectedAnnouncement.component" />
      </div>
    </template>
    <div v-else ref="entryListRef">
      <AnnouncementList id-prefix="entry-announcement-item" @select="selectAnnouncement" />
    </div>
    <template #footer>
      <div class="base-dialog-actions">
        <a
          v-if="selectedAnnouncement?.sourceButton"
          class="entry-announcement-source"
          :href="selectedAnnouncement.sourceButton.link"
          target="_blank"
          rel="noopener noreferrer"
        >
          {{ selectedAnnouncement.sourceButton.text }}
        </a>
        <button type="button" class="entry-announcement-confirm" @click="open = false">
          {{ t('announcements.confirm') }}
        </button>
      </div>
    </template>
  </BaseDialog>
</template>

<script setup lang="ts">
import { computed, inject, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import BaseDialog from '@/components/BaseDialog.vue'
import AnnouncementList from '@/components/AnnouncementList.vue'
import { announcementPanelKey, announcements } from '@/data/announcements'
import { isAprilFoolsSkippedPath } from '@/utils/aprilFools'

const emit = defineEmits<{ seen: [] }>()
const browseOpen = defineModel<boolean>('browseOpen', { default: false })
const panel = inject(announcementPanelKey)!
const route = useRoute()
const { locale, t } = useI18n()
const open = ref(false)
const entryListSession = ref(false)
const selectedId = ref<string | null>(null)
const selectedAnnouncement = computed(() =>
  announcements.find((announcement) => announcement.id === selectedId.value),
)
const canReturnToList = computed(() => entryListSession.value && !!selectedAnnouncement.value)
const entryListRef = ref<HTMLElement | null>(null)
const detailContentRef = ref<HTMLElement | null>(null)
const listRef = ref<HTMLElement | null>(null)
const listCloseRef = ref<HTMLButtonElement | null>(null)
const listPosition = ref({
  top: '60px',
  left: '12px',
  '--announcement-panel-height': 'calc(100dvh - 72px)',
})

const closeList = (restoreFocus = false) => {
  browseOpen.value = false
  if (restoreFocus) panel.trigger.value?.focus({ preventScroll: true })
}

const positionList = () => {
  if (!browseOpen.value || !listRef.value || !panel.trigger.value) return
  const anchor = panel.trigger.value.getBoundingClientRect()
  const top = anchor.bottom + 8
  if (!anchor.width || anchor.bottom <= 0 || top >= window.innerHeight - 12) {
    closeList()
    return
  }
  const width = listRef.value.offsetWidth
  listPosition.value = {
    top: `${top}px`,
    left: `${Math.max(12, Math.min(anchor.right - width, window.innerWidth - width - 12))}px`,
    '--announcement-panel-height': `${window.innerHeight - top - 12}px`,
  }
}

const isInsideList = (target: EventTarget | null) =>
  target instanceof Node &&
  (listRef.value?.contains(target) || panel.trigger.value?.contains(target))

const handleOutsideInteraction = (event: Event) => {
  if (browseOpen.value && !isInsideList(event.target)) closeList()
}

const handleListKeydown = (event: KeyboardEvent) => {
  if (!browseOpen.value || event.key !== 'Escape') return
  event.preventDefault()
  event.stopPropagation()
  closeList(true)
}

const handleScroll = (event: Event) => {
  if (event.target instanceof Node && listRef.value?.contains(event.target)) return
  positionList()
}

const selectAnnouncement = async (id: string) => {
  const wasOpen = open.value
  if (!wasOpen) {
    entryListSession.value = false
    panel.trigger.value?.focus({ preventScroll: true })
  }
  selectedId.value = id
  browseOpen.value = false
  open.value = true
  if (wasOpen) {
    await nextTick()
    detailContentRef.value?.parentElement?.scrollTo({ top: 0 })
    detailContentRef.value?.focus({ preventScroll: true })
  }
}

const returnToList = async () => {
  const id = selectedId.value
  if (id === null) return
  selectedId.value = null
  await nextTick()
  entryListRef.value
    ?.querySelector<HTMLButtonElement>(`#${CSS.escape(`entry-announcement-item-${encodeURIComponent(id)}`)}`)
    ?.focus()
}

const showEntryAnnouncements = () => {
  if (
    typeof window === 'undefined' ||
    !panel.hasUnread.value ||
    open.value ||
    browseOpen.value ||
    locale.value !== 'zh-CN' ||
    isAprilFoolsSkippedPath(route.path)
  )
    return

  entryListSession.value = true
  selectedId.value = null
  open.value = true
  emit('seen')
}

watch(browseOpen, async (value) => {
  if (!value) return
  selectedId.value = null
  await nextTick()
  positionList()
  if (!browseOpen.value) return
  listCloseRef.value?.focus({ preventScroll: true })
})
onMounted(() => {
  document.addEventListener('pointerdown', handleOutsideInteraction)
  document.addEventListener('focusin', handleOutsideInteraction)
  document.addEventListener('keydown', handleListKeydown)
  window.addEventListener('resize', positionList)
  window.addEventListener('scroll', handleScroll, true)
  showEntryAnnouncements()
})
onUnmounted(() => {
  document.removeEventListener('pointerdown', handleOutsideInteraction)
  document.removeEventListener('focusin', handleOutsideInteraction)
  document.removeEventListener('keydown', handleListKeydown)
  window.removeEventListener('resize', positionList)
  window.removeEventListener('scroll', handleScroll, true)
})
watch([panel.hasUnread, locale, () => route.path], showEntryAnnouncements, { flush: 'post' })
</script>

<style scoped>
.announcement-popover {
  position: fixed;
  z-index: 1200;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  box-sizing: border-box;
  width: min(420px, calc(100vw - 24px));
  min-height: min(240px, var(--announcement-panel-height));
  max-height: var(--announcement-panel-height);
  overflow: hidden;
  border: 1px solid var(--switcher-border);
  border-radius: 14px;
  background: var(--bg-white);
  color: var(--text-1);
  box-shadow: 0 12px 36px rgb(0 0 0 / 20%);
  font-size: 14px;
}
.announcement-popover-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--switcher-border);
}
.announcement-popover-header h2 {
  margin: 0;
  color: var(--text-dark);
  font-size: 14px;
  font-weight: 600;
}
.announcement-popover-close {
  display: grid;
  width: 28px;
  height: 28px;
  flex: 0 0 auto;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--text-2);
  cursor: pointer;
}
.announcement-popover-close svg {
  width: 16px;
  height: 16px;
}
.announcement-popover-close:hover {
  background: var(--bg-soft);
  color: var(--text-dark);
}
.announcement-popover-body {
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 8px;
}
.entry-announcement-content {
  color: var(--text-1);
  text-align: left;
  font-size: 0.96rem;
  line-height: 1.7;
}
.entry-announcement-content :deep(.markdown-body) {
  background: transparent;
  color: inherit;
  font: inherit;
}
.entry-announcement-content :deep(p) {
  margin: 0 0 0.85em;
}
.entry-announcement-content :deep(h3) {
  margin: 1.15em 0 0.35em;
  color: var(--nav-primary);
  font-size: 1rem;
}
.entry-announcement-content :deep(a) {
  color: var(--nav-primary);
  overflow-wrap: anywhere;
}
.entry-announcement-content :deep(p:last-child) {
  margin-bottom: 0;
}
.entry-announcement-source {
  display: inline-flex;
  box-sizing: border-box;
  align-items: center;
  justify-content: center;
  min-width: 0;
  height: 44px;
  padding-inline: 12px;
  border: 1px solid var(--switcher-border);
  border-radius: 8px;
  background: var(--bg-white);
  color: var(--text-2);
  font: inherit;
  font-size: 0.875rem;
  line-height: 1.25;
  text-align: center;
  text-decoration: none;
  overflow-wrap: anywhere;
  cursor: pointer;
}
:global(.entry-announcement-popup.has-return .base-dialog-header) {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  row-gap: 0;
}
:global(.entry-announcement-popup.has-return .base-dialog-heading) {
  grid-column: 1 / -1;
  grid-row: 2;
}
.entry-announcement-back {
  grid-column: 1;
  grid-row: 1;
  justify-self: start;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 40px;
  margin-bottom: 16px;
  padding: 4px 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--nav-primary);
  font: inherit;
  font-size: 0.9rem;
  cursor: pointer;
}
.entry-announcement-back svg {
  width: 16px;
  height: 16px;
}
.entry-announcement-source:hover {
  background: var(--bg-soft);
  color: var(--text-dark);
}
.entry-announcement-confirm {
  padding-inline: 24px;
  border-radius: 8px;
  font: inherit;
  border: 0;
  background: var(--btn-primary-bg);
  color: #fff;
  cursor: pointer;
}
.announcement-popover-close:focus-visible,
.entry-announcement-back:focus-visible,
.entry-announcement-source:focus-visible,
.entry-announcement-confirm:focus-visible {
  outline: 2px solid var(--info-1);
  outline-offset: 2px;
}
</style>
