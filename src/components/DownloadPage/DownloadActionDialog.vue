<template>
  <BaseDialog
    :open="open"
    :title="title"
    :close-label="t('downloadModal.close')"
    :show-close="dialog?.kind === 'drive' || dialog?.kind === 'question'"
    :role="dialog?.kind === 'wrong' || dialog?.kind === 'question-error' ? 'alertdialog' : 'dialog'"
    width="560px"
    class="download-action-dialog"
    initial-focus=".download-question-input, .download-question-choices button, .download-action-footer .primary"
    @update:open="dismiss"
  >
    <template v-if="dialog">
      <template v-if="dialog.kind === 'drive'">
        <p class="download-action-intro">{{ t('downloadModal.driveIntro') }}</p>
        <div class="download-drive-options">
          <button
            type="button"
            class="download-drive-option recommended"
            :disabled="busy"
            @click="chooseDrive('quark')"
          >
            <span class="download-drive-title">
              <span aria-hidden="true">📂</span>
              <strong>{{ t('downloadModal.quarkTitle') }}</strong>
            </span>
            <I18nT
              keypath="downloadModal.quarkDesc"
              tag="span"
              class="download-drive-description"
              scope="global"
            >
              <template #emphasis>
                <strong>{{ t('downloadModal.quarkEmphasis') }}</strong>
              </template>
            </I18nT>
          </button>
          <button
            type="button"
            class="download-drive-option lanzou"
            :disabled="busy"
            @click="chooseDrive('lanzou')"
          >
            <span class="download-drive-title">
              <span aria-hidden="true">🚀</span>
              <strong>{{ t('downloadModal.lanzouTitle') }}</strong>
            </span>
            <span class="download-drive-description">{{ t('downloadModal.lanzouDesc') }}</span>
          </button>
          <button
            v-if="dialog.item.lazyLink"
            type="button"
            class="download-drive-option lazy-option"
            :disabled="busy"
            @click="chooseDrive('lazy')"
          >
            <span class="download-drive-title">
              <img src="/imgs/lazydl.png" alt="" />
              <strong class="lazy-rainbow">
                <span
                  v-for="(character, index) in t('downloadModal.lazyTitle')"
                  :key="index"
                  :style="{ '--char-index': index }"
                >
                  {{ character }}
                </span>
              </strong>
            </span>
            <span class="download-drive-description">{{ t('downloadModal.lazyDesc') }}</span>
          </button>
        </div>
      </template>

      <template v-if="dialog.kind === 'drive' || dialog.kind === 'protocol'">
        <p class="download-action-notice">
          <strong v-if="dialog.kind === 'drive'">{{ t('downloadModal.noticeTitle') }}</strong>
          <I18nT keypath="downloadModal.noticeRead" scope="global">
            <template #agreement>
              <a href="/agreement/" target="_blank" rel="noopener noreferrer">
                {{ t('downloadModal.agreement') }}
              </a>
            </template>
          </I18nT>
          <I18nT
            v-if="dialog.hasInstallGuide"
            keypath="downloadModal.installGuideJoiner"
            scope="global"
          >
            <template #installGuide>
              <a
                href="https://docs.vmct.top/tutorial/modpack/translation.html"
                target="_blank"
                rel="noopener noreferrer"
              >
                {{ t('downloadModal.installGuide') }}
              </a>
            </template>
          </I18nT>
          <template v-else>{{ t('downloadModal.noticeEnd') }}</template>
        </p>
      </template>

      <form v-else-if="dialog.kind === 'question'" @submit.prevent="confirm">
        <p class="download-question-content">{{ questionContent }}</p>
        <img
          v-if="questionImage"
          :src="questionImage"
          loading="lazy"
          class="download-question-image"
          alt=""
        />
        <input
          v-if="dialog.question.isInput"
          ref="answerInput"
          v-model="answer"
          class="download-question-input"
          :aria-label="t('downloadModal.answerPlaceholder')"
          :placeholder="t('downloadModal.answerPlaceholder')"
          :disabled="busy"
        />
      </form>
      <I18nT
        v-else-if="dialog.kind === 'correct'"
        keypath="downloadModal.correctBody"
        tag="p"
        class="download-action-notice download-correct-body"
        scope="global"
      >
        <template #agreement>
          <a href="/agreement/" target="_blank" rel="noopener noreferrer">
            {{ t('downloadModal.agreement') }}
          </a>
        </template>
        <template #installGuide>
          <a
            href="https://docs.vmct.top/tutorial/modpack/translation.html"
            target="_blank"
            rel="noopener noreferrer"
          >
            {{ t('downloadModal.installGuide') }}
          </a>
        </template>
      </I18nT>
      <p v-else-if="dialog.kind === 'wrong'">{{ t('downloadModal.wrongText') }}</p>
      <p v-else-if="dialog.kind === 'question-error'">
        {{ t('downloadModal.questionLoadErrorText') }}
      </p>
    </template>

    <template v-if="dialog && dialog.kind !== 'drive'" #footer>
      <div
        v-if="dialog.kind === 'question' && !dialog.question.isInput"
        ref="questionActions"
        class="base-dialog-actions download-question-choices"
      >
        <button
          v-for="option in ['A', 'B', 'C', 'D']"
          :key="option"
          type="button"
          class="download-action-button primary"
          :disabled="busy"
          @click="submitAnswer(option)"
        >
          {{ option }}
        </button>
      </div>
      <div v-else class="base-dialog-actions download-action-footer">
        <button
          v-if="dialog.kind === 'protocol'"
          type="button"
          class="download-action-button"
          @click="close"
        >
          {{ t('downloadModal.cancel') }}
        </button>
        <button
          ref="confirmButton"
          type="button"
          class="download-action-button primary"
          :disabled="busy || (dialog.kind === 'protocol' && remaining > 0)"
          @click="confirm"
        >
          {{
            dialog.kind === 'protocol' && remaining > 0
              ? t('downloadModal.countdown', { label: t('downloadModal.ok'), seconds: remaining })
              : t(dialog.kind === 'question' ? 'downloadModal.submit' : 'downloadModal.ok')
          }}
        </button>
      </div>
    </template>
  </BaseDialog>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { I18nT, useI18n } from 'vue-i18n'
import BaseDialog from '@/components/BaseDialog.vue'
import type { DownloadQuestion } from '@/types/downloadQuestion'
import { useDownloadModal } from './useDownloadModal'

const props = defineProps<{
  questions?: DownloadQuestion[]
  questionLoader?: (() => Promise<DownloadQuestion[]>) | null
}>()
const { locale, t } = useI18n()
const {
  dialog,
  open,
  busy,
  answer,
  remaining,
  dismiss,
  close,
  confirm,
  submitAnswer,
  chooseDrive,
  isDialogMethod,
  handleDownloadMethod,
} = useDownloadModal({
  locale,
  t,
  questions: props.questions,
  questionLoader: props.questionLoader,
})
const answerInput = ref<HTMLInputElement | null>(null)
const questionActions = ref<HTMLDivElement | null>(null)
const confirmButton = ref<HTMLButtonElement | null>(null)
const title = computed(() => {
  const current = dialog.value
  if (!current) return ''
  if (current.kind === 'question') return current.question.title
  const keys = {
    drive: 'driveTitle',
    protocol: 'protocolTitle',
    correct: 'correctTitle',
    wrong: 'wrongTitle',
    'question-error': 'questionLoadErrorTitle',
  }
  return t(`downloadModal.${keys[current.kind]}`)
})
const questionContent = computed(() =>
  dialog.value?.kind === 'question'
    ? dialog.value.question.content.replace(/<br\s*\/?\s*>/gi, '\n')
    : '',
)
const questionImage = computed(() => {
  const url = dialog.value?.kind === 'question' ? dialog.value.question.imageUrl : undefined
  return url && /^(?:\/(?!\/)|https?:\/\/)/i.test(url) ? url : ''
})
watch(dialog, async () => {
  await nextTick()
  if (!open.value) return
  const target =
    answerInput.value || questionActions.value?.querySelector('button') || confirmButton.value
  if (target && !target.disabled) target.focus({ preventScroll: true })
})

defineExpose({ activateDownload: handleDownloadMethod, isDialogMethod })
</script>
