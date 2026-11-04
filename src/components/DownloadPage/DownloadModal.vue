<template>
  <BaseDialog
    v-if="isDialog"
    :open="visible === true"
    :title="t('downloadModal.resourceTitle')"
    :description="t('downloadModal.resourceIntro')"
    :close-label="t('downloadModal.close')"
    width="560px"
    @update:open="emit('close')"
    @closed="openSelectedDownload"
  >
    <DownloadMethodGrid :items="items || []" @select="select" />
  </BaseDialog>
  <DownloadMethodGrid v-else :items="items || []" @select="activateDownload" />
  <DownloadActionDialog
    ref="actionDialog"
    :questions="questions"
    :question-loader="questionLoader"
  />
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseDialog from '@/components/BaseDialog.vue'
import DownloadMethodGrid from './DownloadMethodGrid.vue'
import DownloadActionDialog from './DownloadActionDialog.vue'
import type { DownloadMethodItem } from './downloadMethods'
import type { DownloadQuestion } from '@/types/downloadQuestion'

const props = withDefaults(
  defineProps<{
    items?: DownloadMethodItem[]
    questions?: DownloadQuestion[]
    questionLoader?: (() => Promise<DownloadQuestion[]>) | null
    visible?: boolean
  }>(),
  { visible: undefined },
)
const emit = defineEmits<{ close: [] }>()
const { t } = useI18n()
const isDialog = computed(() => props.visible !== undefined)
const actionDialog = ref<InstanceType<typeof DownloadActionDialog> | null>(null)
let selectedDownload: DownloadMethodItem | null = null

const activateDownload = (item: DownloadMethodItem) => actionDialog.value?.activateDownload(item)

function select(item: DownloadMethodItem) {
  // Close the picker and restore its trigger before opening the next dialog.
  // Direct links must still open within the click's browser activation.
  if (actionDialog.value?.isDialogMethod(item)) selectedDownload = item
  else activateDownload(item)
  emit('close')
}

async function openSelectedDownload() {
  const item = selectedDownload
  selectedDownload = null
  if (!item) return
  await nextTick()
  activateDownload(item)
}

defineExpose({ activateDownload })
</script>

<style>
@import '@/styles/DownloadModal.css';
</style>
