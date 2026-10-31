import { createApp as createClientApp, createSSRApp, type Directive } from 'vue'
import { Icon } from '@iconify/vue'

import App from './App.vue'
import { createAppRouter } from './router'
import { createI18nInstance, type AvailableLocales } from './plugins/i18n'
import { CONTENT_STORE, createContentStore, type SiteContent } from './content/store'

const LAZY_IMAGE_PLACEHOLDER =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

const ssrLazyDirective: Directive<HTMLImageElement, string> = {
  getSSRProps(binding) {
    return {
      loading: 'lazy',
      src: LAZY_IMAGE_PLACEHOLDER,
      'data-src': binding.value,
    }
  },
}

interface CreateAppOptions {
  hydrate?: boolean
  locale?: AvailableLocales
  ssr?: boolean
  content?: SiteContent
}

export function createApp(options: CreateAppOptions = {}) {
  const createVueApp = options.ssr || options.hydrate ? createSSRApp : createClientApp
  const app = createVueApp(App)
  const content = createContentStore(options.content)
  const router = createAppRouter(content, Boolean(options.ssr))
  const i18n = createI18nInstance(options.locale)

  app.component('Icon', Icon)
  app.provide(CONTENT_STORE, content)
  app.use(router)
  app.use(i18n)

  if (options.ssr) {
    app.directive('lazy', ssrLazyDirective)
  }

  return { app, i18n, router, content }
}
