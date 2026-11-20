<template>
  <BaseDialog
    v-if="isDialog"
    :open="visible === true"
    :title="t('downloadModal.driveTitle')"
    :close-label="t('downloadModal.close')"
    width="640px"
    class="download-picker-dialog rounded-[24px] [&_.base-dialog-header]:p-[20px_24px_20px_36px] [&_.base-dialog-title]:text-[24px] [&_.base-dialog-title]:leading-[1.4] [&_.base-dialog-close_svg]:w-6 [&_.base-dialog-close_svg]:h-6 [&_.base-dialog-body]:p-[0_36px_28px] [&_.download-action-notice]:mt-[22px] [&_.download-action-notice]:text-[14px] [&_.download-action-notice]:leading-[1.5] max-[600px]:rounded-[22px] max-[600px]:[&_.base-dialog-header]:p-[20px_18px_24px_24px] max-[600px]:[&_.base-dialog-title]:text-[24px] max-[600px]:[&_.base-dialog-close_svg]:w-6 max-[600px]:[&_.base-dialog-close_svg]:h-6 max-[600px]:[&_.base-dialog-body]:p-[0_24px_28px] max-[600px]:[&_.download-action-notice]:mt-6 max-[600px]:[&_.download-action-notice]:text-[14px]"
    @update:open="emit('close')"
    @closed="openSelectedDownload"
  >
    <DownloadMethodGrid :items="items || []" @select="select" />
    <DownloadNotice show-title :has-install-guide="hasInstallGuide" />
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
import { useRoute } from 'vue-router'
import BaseDialog from '@/components/BaseDialog.vue'
import DownloadMethodGrid from './DownloadMethodGrid.vue'
import DownloadActionDialog from './DownloadActionDialog.vue'
import DownloadNotice from './DownloadNotice.vue'
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
const route = useRoute()
const hasInstallGuide = computed(() => route.path.startsWith('/modpacks/'))
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
