<template>
  <p v-if="loadError" role="alert">{{ loadError }}</p>
  <div v-if="!registerDownloadMethods">
    <DownloadModal :items="downloadMethods" />
  </div>
</template>

<script setup lang="ts">
import { useUrlSearchParams } from '@vueuse/core'
import { computed, inject, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import DownloadModal from '@/components/DownloadPage/DownloadModal.vue'
import {
  DOWNLOAD_METHODS_REGISTRAR,
  getPageDownloadMethods,
  type DownloadMethodItem,
  type DownloadMethodSource,
} from '@/components/DownloadPage/downloadMethods'

const props = withDefaults(
  defineProps<{
    methods?: DownloadMethodSource[]
  }>(),
  {
    methods: () => [],
  },
)

const params = useUrlSearchParams('history')
const registerDownloadMethods = inject(DOWNLOAD_METHODS_REGISTRAR, null)
const route = useRoute()
const storedMethods = ref<DownloadMethodSource[]>([])
const loadError = ref('')
const isProject = computed(() => /^\/(modpacks|map|maps)\//.test(route.path))
const downloadMethods = computed(() => getPageDownloadMethods(isProject.value ? storedMethods.value : props.methods))
let requestNumber = 0
watch(() => route.path, async (path) => {
  if (typeof window === 'undefined' || !isProject.value) return
  const number = ++requestNumber
  storedMethods.value = []
  loadError.value = ''
  try {
    const response = await fetch('/api/content/downloads?path=' + encodeURIComponent(path))
    if (!response.ok) throw new Error('下载链接加载失败')
    const data = await response.json()
    let methods: DownloadMethodSource[] = data.methods
    // VMPM controls the lazy entry; cloud links remain managed by the CMS.
    const lazyResponse = await fetch('/download-catalog/lazy?sourceId=' + encodeURIComponent(data.pageId))
    if (lazyResponse.ok) {
      const lazy = await lazyResponse.json()
      if (lazy.configured) {
        methods = methods.filter(method => method.id?.toLowerCase() !== 'lazy').map(({ lazyLink, ...method }) => method)
        if (lazy.link) methods.push({ id: 'lazy', link: lazy.link })
      }
    } else if (lazyResponse.status !== 404) throw new Error('懒汉下载配置加载失败')
    if (number !== requestNumber) return
    storedMethods.value = methods
    downloadJump(getPageDownloadMethods(methods))
  } catch (error) {
    if (number === requestNumber) loadError.value = error instanceof Error ? error.message : '下载链接加载失败'
  }
}, { immediate: true })

function downloadJump(methods: DownloadMethodItem[]) {
  const query = Array.isArray(params.q) ? params.q[0] : params.q
  if (typeof query !== 'string') return

  const targetId = query.toLowerCase()
  const target = methods.find((method) => method.id?.toLowerCase() === targetId)

  const link = target?.link || (targetId === 'lazy' ? methods.find(method => method.lazyLink)?.lazyLink : undefined)
  if (link) location.href = link
}

watch(
  downloadMethods,
  (methods) => {
    registerDownloadMethods?.(methods)
  },
  { immediate: true },
)

onMounted(() => {
  downloadJump(downloadMethods.value)
})

onBeforeUnmount(() => {
  requestNumber++
  registerDownloadMethods?.([])
})
</script>
