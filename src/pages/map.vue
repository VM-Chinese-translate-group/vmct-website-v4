<template>
  <div class="resource-list-page [background:var(--bg-off-white)]">
    <DownloadCards :mods="maps" :show-loader-filter="false" />
  </div>
</template>

<script setup lang="ts">
import DownloadCards from '@/layout/DownloadCards.vue'
import { useSiteContent } from '@/content/store'
const { maps } = useSiteContent()
</script>
