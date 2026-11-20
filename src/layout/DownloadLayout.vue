<template>
  <div class="pack-page-container">
    <header class="pack-header">
      <div class="header-content">
        <div class="pack-icon-wrapper" :class="{ 'image-loading-frame': Boolean(meta.icon) }">
          <img
            v-if="meta.icon"
            :src="meta.icon"
            :alt="displayTitle"
            class="pack-icon"
            width="128"
            height="128"
            loading="eager"
            fetchpriority="high"
            decoding="async"
          />
          <div v-else class="pack-icon-placeholder"></div>
        </div>

        <div class="pack-title-area">
          <div class="title-row">
            <h1>{{ displayTitle }}</h1>
            <div class="pack-status-tags" v-if="meta.status?.type">
              <span
                :class="['status-tag', meta.status.type || 'info']"
                :title="getStatusDescription(meta.status.type)"
              >
                {{ getStatusText(meta.status.type) }}
              </span>
            </div>
          </div>

          <p class="pack-description" v-if="meta.description">
            {{ meta.description }}
          </p>

          <div class="author-row" v-if="meta.authors">
            <span class="by-text">by</span>
            <span class="author-name" v-for="author in meta.authors" :key="author">
              {{ author }}
            </span>
          </div>
        </div>

        <div class="download-button-wrapper">
          <button type="button" class="btn-download-main" @click="scrollToDownload">
            <Icon icon="lucide:download" />
            {{ t('pack.downloadPatch') }}
          </button>
          <span class="update-date" v-if="meta.updateDate">
            <Icon icon="lucide:calendar-clock" />
            {{ t('pack.updateDate', { date: formatUpdateDate(meta.updateDate, locale) }) }}
          </span>
        </div>
      </div>
    </header>

    <main class="pack-main">
      <section class="pack-content-body markdown-body vm-prose" ref="contentRef">
        <slot />
      </section>

      <aside>
        <div class="sidebar-card">
          <h3 class="sidebar-title">{{ t('pack.compatibilityTitle') }}</h3>

          <div class="info-item" v-if="meta.compatibility?.minecraft">
            <div class="info-label">
              <Icon icon="mdi:microsoft-minecraft" />
              {{ t('pack.minecraftVersion') }}
            </div>
            <div class="info-value">{{ meta.compatibility.minecraft }}</div>
          </div>

          <div class="info-item" v-if="meta.compatibility?.loader">
            <div class="info-label">
              <Icon icon="lucide:layers" />
              {{ t('pack.loader') }}
            </div>
            <div class="info-value">
              <span :class="['loader-pill', getLoaderClass(meta.compatibility.loader)]">
                <span
                  v-if="getLoaderIcon(meta.compatibility.loader)"
                  class="loader-icon"
                  :style="{
                    WebkitMaskImage: `url(${getLoaderIcon(meta.compatibility.loader)})`,
                    maskImage: `url(${getLoaderIcon(meta.compatibility.loader)})`,
                  }"
                />
                {{ getLoaderText(meta.compatibility.loader) }}
              </span>
            </div>
          </div>

          <div class="info-item" v-if="meta.compatibility?.pack">
            <div class="info-label">
              <Icon icon="lucide:tag" />
              {{ t('pack.packVersion') }}
            </div>
            <div class="info-value">{{ meta.compatibility.pack }}</div>
          </div>
        </div>

        <div class="sidebar-card" v-if="relatedLinks.length">
          <h3 class="sidebar-title">{{ t('pack.relatedLinks') }}</h3>
          <div class="external-links">
            <a
              v-for="(item, index) in relatedLinks"
              :key="`${item.id}-${index}`"
              :href="item.link"
              class="link-pill"
              target="_blank"
              rel="noopener noreferrer"
            >
              <img v-if="item.icon" v-lazy="item.icon" class="link-icon" />
              <span>{{ item.text }}</span>
              <Icon icon="lucide:external-link" class="external-icon" />
            </a>
          </div>
        </div>
      </aside>
    </main>
  </div>

  <ImagePreview
    :visible="previewVisible"
    :imgs="previewImages"
    :index="previewIndex"
    @hide="closePreview"
    @update:visible="onPreviewVisibleChange"
  />

  <DownloadModal
    ref="downloadModalRef"
    :items="downloadMethods"
    :visible="downloadModalVisible"
    @close="downloadModalVisible = false"
  />
</template>

<script setup lang="ts">
import { computed, ref, provide, watch, nextTick } from 'vue'
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'
import { convertMarkdownContainers } from '@/utils/zhconv'
import { useImagePreview } from '@/composables/useImagePreview'
import { getLoaderClass, getLoaderIcon } from '@/data/loaderIcons'
import { formatUpdateDate } from '@/utils/dateFormat'
import { getLocalizedResourceName } from '@/utils/resourceDisplay'
import { resolveRelatedLink, type RelatedLinkInput } from '@/data/relatedLinks'
import ImagePreview from '@/components/ImagePreview.vue'
import DownloadModal from '@/components/DownloadPage/DownloadModal.vue'
import {
  DOWNLOAD_METHODS_REGISTRAR,
  type DownloadMethodItem,
} from '@/components/DownloadPage/downloadMethods'

const props = defineProps({
  meta: { type: Object, default: () => ({}) },
})

const { t, locale } = useI18n()
const contentRef = ref<HTMLElement | null>(null)
const downloadMethods = ref<DownloadMethodItem[]>([])
const downloadModalVisible = ref(false)
const downloadModalRef = ref<{
  activateDownload: (item: DownloadMethodItem) => void
} | null>(null)
provide(DOWNLOAD_METHODS_REGISTRAR, (methods) => {
  downloadMethods.value = methods
})
const displayTitle = computed(() =>
  getLocalizedResourceName(props.meta, locale.value, t('pack.defaultTitle')),
)
const relatedLinks = computed(() => {
  void locale.value
  return ((props.meta.links || []) as RelatedLinkInput[])
    .map((item) => resolveRelatedLink(item, t))
    .filter((item) => item.text && item.link)
})
const {
  closePreview,
  images: previewImages,
  index: previewIndex,
  onVisibleChange: onPreviewVisibleChange,
  visible: previewVisible,
} = useImagePreview(contentRef)

const handleConvert = async () => {
  await nextTick()
  if (!contentRef.value) return
  await convertMarkdownContainers(locale.value, contentRef.value)
}

watch(
  () => props.meta,
  () => handleConvert(),
  { deep: true, immediate: true },
)
watch(locale, () => handleConvert())

const getLoaderText = (loader: string) => t(`loader.${loader?.toLowerCase()}`)
const getStatusText = (statusType: string) => t(`pack.status.${statusType}`)
const getStatusDescription = (statusType: string) =>
  statusType === 'stopped' ? t('pack.statusDescription.stopped') : undefined

const scrollToDownload = () => {
  if (downloadMethods.value.length === 1) {
    downloadModalRef.value?.activateDownload(downloadMethods.value[0])
    return
  }

  if (downloadMethods.value.length > 1) downloadModalVisible.value = true
}
</script>

<style scoped>
@import '@/styles/DownloadLayout.css';
</style>
