<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { DownloadMethodItem } from './downloadMethods'
import DownloadOptionCard from './DownloadOptionCard.vue'

defineProps<{
  items: DownloadMethodItem[]
}>()

const emit = defineEmits<{
  select: [item: DownloadMethodItem]
}>()

const { t } = useI18n()
const descriptionKeys: Record<string, string> = {
  '123pan': 'pan123Desc',
  mediafire: 'mediafireDesc',
  lazy: 'lazyDesc',
}

function getDescription(item: DownloadMethodItem) {
  if (item.secondary) return item.secondary
  const key = descriptionKeys[item.id?.toLowerCase() || '']
  return key ? t(`downloadModal.${key}`) : ''
}
</script>

<template>
  <div class="download-options">
    <DownloadOptionCard
      v-for="item in items"
      :key="item.id || item.name"
      :title="item.name"
      :description="getDescription(item)"
      :icon="item.icon"
      @select="emit('select', item)"
    />
  </div>
</template>
