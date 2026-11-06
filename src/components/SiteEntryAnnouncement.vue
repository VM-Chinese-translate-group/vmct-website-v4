<template>
  <BaseDialog
    :open="open"
    :title="announcementTitle"
    close-label="关闭公告"
    width="720px"
    class="entry-announcement-popup"
    @update:open="dismissAnnouncement"
  >
    <div class="entry-announcement-content">
      <OfficialAccountAnnouncement />
    </div>
    <template #footer>
      <div class="base-dialog-actions">
        <a
          v-if="sourceButton && sourceButton.enabled !== false"
          class="entry-announcement-source"
          :href="sourceButton.link"
          target="_blank"
          rel="noopener noreferrer"
        >
          {{ sourceButton.text }}
        </a>
        <button type="button" class="entry-announcement-confirm" @click="dismissAnnouncement">
          我知道了
        </button>
      </div>
    </template>
  </BaseDialog>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import BaseDialog from '@/components/BaseDialog.vue'
import OfficialAccountAnnouncement, {
  title as announcementTitle,
  sourceButton,
} from '@/content/announcements/official-account.md'
import { isAprilFoolsSkippedPath } from '@/utils/aprilFools'

const ANNOUNCEMENT_ID = 'official-account'
const ANNOUNCEMENT_STORAGE_KEY = `site-announcement:${ANNOUNCEMENT_ID}`
const route = useRoute()
const { locale } = useI18n()
const open = ref(false)
let dismissedInMemory = false

const wasDismissed = () => {
  if (dismissedInMemory) return true
  try {
    return window.localStorage.getItem(ANNOUNCEMENT_STORAGE_KEY) !== null
  } catch {
    return false
  }
}

const dismissAnnouncement = () => {
  open.value = false
  dismissedInMemory = true
  try {
    window.localStorage.setItem(
      ANNOUNCEMENT_STORAGE_KEY,
      JSON.stringify({
        id: ANNOUNCEMENT_ID,
        dismissedAt: new Date().toISOString(),
        source: sourceButton?.link,
      }),
    )
  } catch {
    // 隐私模式可能禁用 localStorage；内存标记仍可避免本次访问重复弹出。
  }
}

const showAnnouncement = () => {
  if (
    typeof window === 'undefined' ||
    open.value ||
    locale.value !== 'zh-CN' ||
    isAprilFoolsSkippedPath(route.path) ||
    wasDismissed()
  )
    return
  open.value = true
}

onMounted(showAnnouncement)
watch([() => route.path, locale], showAnnouncement)
</script>

<style scoped>
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
.entry-announcement-source:focus-visible,
.entry-announcement-confirm:focus-visible {
  outline: 2px solid var(--info-1);
  outline-offset: 2px;
}
</style>
