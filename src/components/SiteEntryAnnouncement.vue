<template>
  <BaseDialog
    :open="open"
    :title="announcementTitle"
    close-label="关闭公告"
    width="720px"
    class="entry-announcement-popup"
    @update:open="dismissAnnouncement"
  >
    <div
      class="entry-announcement-content text-[var(--text-1)] text-left text-[0.96rem] leading-[1.7] [&_.markdown-body]:[background:transparent] [&_.markdown-body]:text-[inherit] [&_.markdown-body]:font-inherit [&_.markdown-body]:[font-size:inherit] [&_.markdown-body]:[font-weight:inherit] [&_.markdown-body]:[line-height:inherit] [&_p]:m-[0_0_0.85em] [&_h3]:m-[1.15em_0_0.35em] [&_h3]:text-[var(--nav-primary)] [&_h3]:text-[1rem] [&_a]:text-[var(--nav-primary)] [&_a]:[overflow-wrap:anywhere] [&_p:last-child]:mb-0"
    >
      <OfficialAccountAnnouncement />
    </div>
    <template #footer>
      <div class="base-dialog-actions">
        <a
          v-if="sourceButton && sourceButton.enabled !== false"
          class="entry-announcement-source inline-flex box-border items-center justify-center min-w-0 h-11 px-3 [border:1px_solid_var(--switcher-border)] rounded-lg [background:var(--bg-white)] text-[var(--text-2)] font-inherit [font-weight:inherit] text-[0.875rem] leading-[1.25] text-center no-underline [overflow-wrap:anywhere] hover:[background:var(--bg-soft)] hover:text-[var(--text-dark)] focus-visible:[outline:2px_solid_var(--info-1)] focus-visible:[outline-offset:2px]"
          :href="sourceButton.link"
          target="_blank"
          rel="noopener noreferrer"
        >
          {{ sourceButton.text }}
        </a>
        <button
          type="button"
          class="entry-announcement-confirm px-6 rounded-lg font-inherit [font-size:inherit] [font-weight:inherit] [line-height:inherit] border-0 [background:var(--btn-primary-bg)] text-[#fff] cursor-pointer focus-visible:[outline:2px_solid_var(--info-1)] focus-visible:[outline-offset:2px]"
          @click="dismissAnnouncement"
        >
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
