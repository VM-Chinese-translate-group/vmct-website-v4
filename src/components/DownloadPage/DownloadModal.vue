<template>
  <template v-if="isDialog">
    <Teleport to="#vmct-overlays">
      <Transition name="download-modal-fade">
        <div v-if="visible" class="download-modal-backdrop" role="presentation" @click.self="close">
          <section
            ref="dialogRef"
            class="download-modal-dialog"
            role="dialog"
            aria-modal="true"
            :aria-labelledby="titleId"
          >
            <header class="download-modal-header">
              <div>
                <h2 :id="titleId">{{ t('downloadModal.resourceTitle') }}</h2>
                <p>{{ t('downloadModal.resourceIntro') }}</p>
              </div>
              <button
                ref="closeButtonRef"
                type="button"
                class="download-modal-close"
                :aria-label="t('downloadModal.close')"
                @click="close"
              >
                <Icon icon="lucide:x" />
              </button>
            </header>

            <DownloadMethodGrid :items="items || []" @select="select" />
          </section>
        </div>
      </Transition>
    </Teleport>
  </template>

  <DownloadMethodGrid v-else :items="items || []" @select="activateDownload" />
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'
import DownloadMethodGrid from './DownloadMethodGrid.vue'
import { useDownloadModal } from './useDownloadModal'
import type { DownloadMethodItem } from './downloadMethods'
import type { DownloadQuestion } from '@/types/downloadQuestion'
import { usePageScrollLock } from '@/composables/usePageScrollLock'

const props = withDefaults(
  defineProps<{
    items?: DownloadMethodItem[]
    questions?: DownloadQuestion[]
    questionLoader?: (() => Promise<DownloadQuestion[]>) | null
    visible?: boolean
  }>(),
  {
    visible: undefined,
  },
)

const emit = defineEmits<{
  close: []
}>()

const { locale, t } = useI18n()
const { handleDownloadMethod } = useDownloadModal({
  locale,
  questionLoader: props.questionLoader,
  questions: props.questions,
  t,
})
const { lock, unlock } = usePageScrollLock()

const isDialog = computed(() => props.visible !== undefined)
const dialogRef = ref<HTMLElement | null>(null)
const closeButtonRef = ref<HTMLButtonElement | null>(null)
const previouslyFocusedElement = ref<HTMLElement | null>(null)
const titleId = 'download-modal-title'

const close = () => emit('close')

const select = (item: DownloadMethodItem) => {
  handleDownloadMethod(item)
  close()
}

const getFocusableElements = () => {
  const dialog = dialogRef.value
  if (!dialog) return []

  return Array.from(
    dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => !element.hasAttribute('hidden') && element.offsetParent !== null)
}

const restoreFocus = () => {
  const element = previouslyFocusedElement.value
  previouslyFocusedElement.value = null
  if (element?.isConnected) nextTick(() => element.focus())
}

const onKeydown = (event: KeyboardEvent) => {
  if (!isDialog.value || !props.visible) return

  if (event.key === 'Escape') {
    event.preventDefault()
    close()
    return
  }

  if (event.key !== 'Tab') return

  const focusableElements = getFocusableElements()
  if (!focusableElements.length) return

  const first = focusableElements[0]
  const last = focusableElements[focusableElements.length - 1]
  const activeElement = document.activeElement

  if (event.shiftKey && (activeElement === first || !dialogRef.value?.contains(activeElement))) {
    event.preventDefault()
    last.focus()
  } else if (
    !event.shiftKey &&
    (activeElement === last || !dialogRef.value?.contains(activeElement))
  ) {
    event.preventDefault()
    first.focus()
  }
}

watch(
  () => props.visible,
  (visible) => {
    if (!isDialog.value) return

    if (visible) {
      if (typeof document !== 'undefined') {
        previouslyFocusedElement.value =
          document.activeElement instanceof HTMLElement ? document.activeElement : null
      }
      lock()
      nextTick(() => closeButtonRef.value?.focus())
    } else {
      unlock()
      restoreFocus()
    }
  },
  { immediate: true },
)

onMounted(() => window.addEventListener('keydown', onKeydown))

onBeforeUnmount(() => {
  unlock()
  restoreFocus()
  window.removeEventListener('keydown', onKeydown)
})

const activateDownload = (item: DownloadMethodItem) => handleDownloadMethod(item)

defineExpose({ activateDownload })
</script>

<style>
@import '@/styles/DownloadModal.css';
</style>
