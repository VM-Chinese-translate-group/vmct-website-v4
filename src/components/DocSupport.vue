<template>
  <div>
    <h2>{{ $t('supportUs.supportTitle') }}</h2>

    <p>
      {{ $t('supportUs.supportParagraph1') }}
    </p>

    <p>
      <i18n-t keypath="supportUs.supportParagraph2" scope="global">
        <template #afd>
          <a href="https://afdian.com" target="_blank" rel="noopener noreferrer">
            {{ $t('supportUs.afdText') }}
          </a>
        </template>
      </i18n-t>
    </p>

    <h2>{{ $t('supportUs.joinTitle') }}</h2>

    <p>
      <i18n-t keypath="supportUs.joinParagraph1" scope="global">
        <template #community>
          <a :href="communityLink" target="_blank" rel="noopener noreferrer">
            {{ $t('supportUs.communityText') }}
          </a>
        </template>
      </i18n-t>
    </p>

    <p>
      <i18n-t keypath="supportUs.joinParagraph2" scope="global">
        <template #review>
          <router-link to="/community/">
            {{ $t('supportUs.reviewText') }}
          </router-link>
        </template>
      </i18n-t>
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { locale } = useI18n()

const communityLink = computed(() => {
  if (locale.value === 'zh-CN') {
    return 'https://qm.qq.com/q/PL5IfMBRKg'
  }
  return 'https://discord.com/invite/SvJM5d9S98'
})
</script>
