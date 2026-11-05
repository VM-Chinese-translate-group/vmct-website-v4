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
} from '@/content/announcements/official-account.md'
import { isAprilFoolsSkippedPath } from '@/utils/aprilFools'

const ANNOUNCEMENT_ID = 'official-account'
const ANNOUNCEMENT_STORAGE_KEY = `site-announcement:${ANNOUNCEMENT_ID}`
const ANNOUNCEMENT_SOURCE = 'https://www.bilibili.com/opus/1251946408080048130'
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
        source: ANNOUNCEMENT_SOURCE,
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
.entry-announcement-confirm {
  padding-inline: 24px;
  border-radius: 8px;
  font: inherit;
  border: 0;
  background: var(--btn-primary-bg);
  color: #fff;
  cursor: pointer;
}
.entry-announcement-confirm:focus-visible {
  outline: 2px solid var(--info-1);
  outline-offset: 2px;
}
</style>
