<template>
  <router-view />
  <SiteEntryAnnouncement />
  <TranslationFeedbackWidget />
</template>

<script setup lang="ts">
import SiteEntryAnnouncement from '@/components/SiteEntryAnnouncement.vue'
import TranslationFeedbackWidget from '@/components/TranslationFeedbackWidget.vue'
</script>
