import { nextTick, watch } from 'vue'
import VueLazyload from 'vue-lazyload'

import { createApp } from './app'
import { getClientLocale } from './plugins/i18n'
import { syncPageSeo } from './plugins/seo'
import { isAprilFoolsDay, syncAprilFoolsBranding } from '@/utils/aprilFools'
import { startImageLoadingFrames, syncImageLoadingLabel } from '@/utils/imageLoading'
import { convertMarkdownContainers } from '@/utils/zhconv'
import { applyTheme, getPreferredTheme } from '@/utils/theme'
import type { SiteContent } from '@/content/store'

import '@/styles/imageLoading.css'
import '@/styles/markdown.css'
import 'virtual:uno.css'

declare global {
  interface Window {
    gtag?: (...args: any[]) => void
  }
}

const clientLocale = getClientLocale()
applyTheme(getPreferredTheme(), false)
void syncImageLoadingLabel(clientLocale)
startImageLoadingFrames()

const contentElement = document.getElementById('vmct-content')
const initialContent = contentElement?.textContent
  ? (JSON.parse(contentElement.textContent) as SiteContent)
  : undefined
const { app, i18n, router } = createApp({
  locale: initialContent ? 'zh-CN' : clientLocale,
  hydrate: Boolean(initialContent),
  content: initialContent,
})

const registerImageCache = () => {
  if (!import.meta.env.PROD) return
  if (!('serviceWorker' in navigator)) return

  navigator.serviceWorker.register('/image-cache-sw.js').catch(() => {
    // 图片缓存只是加速层，注册失败不影响页面内容。
  })
}

app.use(VueLazyload as any, {
  preLoad: 1,
  error: '/imgs/missing.png',
  attempt: 3,
  // 预渲染页面的布局在 hydration 期间仍可能变化，使用滚动监听避免观察器误判首屏外图片。
  observer: false,
  observerOptions: { rootMargin: '0px', threshold: 0.1 },
})

const syncHtmlMeta = () => {
  const { locale } = i18n.global as any
  document.documentElement.lang = locale.value
}

const syncSeo = () => {
  const { locale, t } = i18n.global as any
  syncPageSeo(router.currentRoute.value, locale.value, t)
}

let aprilFoolsFrame = 0

const scheduleAprilFoolsBranding = () => {
  if (!isAprilFoolsDay()) return
  cancelAnimationFrame(aprilFoolsFrame)
  aprilFoolsFrame = requestAnimationFrame(() => {
    syncAprilFoolsBranding(router.currentRoute.value.path)
  })
}

router.isReady().then(async () => {
  app.mount('#app')

  const { locale } = i18n.global as any
  if (locale.value !== clientLocale) {
    locale.value = clientLocale
    await nextTick()
  }

  syncHtmlMeta()
  syncSeo()
  convertMarkdownContainers(locale.value)
  scheduleAprilFoolsBranding()

  watch(
    () => (i18n.global as any).locale.value,
    async (val) => {
      syncHtmlMeta()
      syncSeo()
      void syncImageLoadingLabel(val)

      await nextTick()
      convertMarkdownContainers(val)
      scheduleAprilFoolsBranding()
    },
  )

  router.afterEach(async () => {
    syncSeo()
    await nextTick()
    scheduleAprilFoolsBranding()
  })

  registerImageCache()

  if (isAprilFoolsDay()) {
    const observer = new MutationObserver(() => scheduleAprilFoolsBranding())
    observer.observe(document.body, { childList: true, subtree: true })
  }

  if (import.meta.env.PROD) {
    router.afterEach(async () => {
      await nextTick()

      window.gtag?.('event', 'page_view', {
        page_title: document.title,
        page_path: location.pathname,
      })
    })
  }
})
