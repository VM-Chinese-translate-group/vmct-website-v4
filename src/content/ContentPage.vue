<template>
  <component v-if="page" :is="layout" :meta="page.meta" :key="page.path">
    <ContentDocument :nodes="page.document" />
  </component>
  <NotFoundLayout v-else />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import DocLayout from '@/layout/DocLayout.vue'
import DownloadLayout from '@/layout/DownloadLayout.vue'
import NotFoundLayout from '@/layout/NotFoundLayout.vue'
import ContentDocument from './ContentDocument'
import { useSiteContent } from './store'

const { state } = useSiteContent()
const page = computed(() => state.value.page)
const layout = computed(() => page.value && /^\/(?:modpacks|map|maps)\//.test(page.value.path)
  && !page.value.path.startsWith('/modpacks/fc5-wiki') && !page.value.path.endsWith('/secret') ? DownloadLayout : DocLayout)
</script>
