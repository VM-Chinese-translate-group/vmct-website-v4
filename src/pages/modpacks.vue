<template>
  <div class="markdown-body resource-list-page">
    <DownloadCards :mods="modpacks" />
  </div>
</template>

<script setup lang="ts">
import DownloadCards from '@/layout/DownloadCards.vue'
import { useSiteContent } from '@/content/store'
const { modpacks } = useSiteContent()
</script>

<style scoped>
.resource-list-page {
  background: var(--bg-off-white);
}
</style>
