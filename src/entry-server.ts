import { renderToString } from '@vue/server-renderer'

import { createApp } from './app'
import { renderSeoHead, resolvePageSeo } from './plugins/seo'
import type { AvailableLocales } from './plugins/i18n'
import type { SiteContent } from './content/store'

export async function render(url: string, content: SiteContent, locale: AvailableLocales = 'zh-CN') {
  const { app, i18n, router } = createApp({ locale, ssr: true, content })

  await router.push(url)
  await router.isReady()

  const context: { modules?: Set<string>; teleports?: Record<string, string> } = {}
  const html = await renderToString(app, context)
  const { t } = i18n.global as any
  const seo = await resolvePageSeo(router.currentRoute.value, locale, t)

  return {
    appHtml: html,
    head: renderSeoHead(seo),
    htmlAttrs: `lang="${locale}"`,
    modules: [...(context.modules || [])],
    teleports: context.teleports?.['#vmct-overlays'] || '',
    status: router.currentRoute.value.meta.contentMissing ? 404 : 200,
  }
}
