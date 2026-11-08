<template>
  <router-view />
  <SiteEntryAnnouncement
    v-if="!embedded"
    v-model:browse-open="announcementsOpen"
    @seen="markSeen"
  />
  <TranslationFeedbackWidget v-if="!embedded" />
</template>

<script setup lang="ts">
import { provide, ref, shallowRef } from 'vue'
import SiteEntryAnnouncement from '@/components/SiteEntryAnnouncement.vue'
import TranslationFeedbackWidget from '@/components/TranslationFeedbackWidget.vue'
import { useSiteContent } from '@/content/store'
import { announcementPanelKey } from '@/data/announcements'
import { useAnnouncementNotifications } from '@/composables/useAnnouncementNotifications'
const { embedded } = useSiteContent()
const announcementsOpen = ref(false)
const announcementTrigger = shallowRef<HTMLElement | null>(null)
const { hasUnread, markSeen } = useAnnouncementNotifications()
provide(announcementPanelKey, {
  isOpen: announcementsOpen,
  hasUnread,
  trigger: announcementTrigger,
  toggle(trigger) {
    announcementTrigger.value = trigger
    announcementsOpen.value = !announcementsOpen.value
    if (announcementsOpen.value) markSeen()
  },
})
</script>
