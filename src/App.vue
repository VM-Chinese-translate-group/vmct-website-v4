<template>
  <router-view />
  <SiteEntryAnnouncement v-if="!embedded" />
  <TranslationFeedbackWidget v-if="!embedded" />
</template>

<script setup lang="ts">
import SiteEntryAnnouncement from '@/components/SiteEntryAnnouncement.vue'
import TranslationFeedbackWidget from '@/components/TranslationFeedbackWidget.vue'
import { useSiteContent } from '@/content/store'
const { embedded } = useSiteContent()
</script>
