<script setup lang="ts">
import { I18nT, useI18n } from 'vue-i18n'

defineProps<{
  showTitle?: boolean
  hasInstallGuide?: boolean
}>()

const { t } = useI18n()
</script>

<template>
  <p class="download-action-notice">
    <strong v-if="showTitle">{{ t('downloadModal.noticeTitle') }}</strong>
    <I18nT keypath="downloadModal.noticeRead" scope="global">
      <template #agreement>
        <a href="/agreement/" target="_blank" rel="noopener noreferrer">
          {{ t('downloadModal.agreement') }}
        </a>
      </template>
    </I18nT>
    <I18nT
      v-if="hasInstallGuide"
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
