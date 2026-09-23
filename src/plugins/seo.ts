import type { RouteLocationNormalizedLoaded } from 'vue-router'
import {
  getAprilFoolsLogoPath,
  isAprilFoolsDay,
  isAprilFoolsSkippedPath,
  transformAprilFoolsText,
} from '@/utils/aprilFools'
import { getLocalizedResourceName } from '@/utils/resourceDisplay'
import { convertInlineText } from '@/utils/zhconv'

const SITE_URL = 'https://www.vmct.top'
const DEFAULT_IMAGE = '/imgs/og_image.png'

type TranslateFn = (key: string, values?: Record<string, unknown>) => string

interface SeoMeta {
  description?: string
  icon?: string
  image?: string
  noindex?: boolean
  originalName?: string
  title?: string
}

export interface ResolvedPageSeo {
  description: string
  image: string
  jsonLd: object
  pageTitle: string
  robots: string
  siteName: string
  url: string
  locale: string
}

function normalizeText(value: unknown, fallback = '') {
  if (typeof value !== 'string') return fallback
  return value.replace(/\s+/g, ' ').trim() || fallback
}

function absoluteUrl(value: string) {
  if (/^https?:\/\//.test(value)) return value
  return new URL(value.startsWith('/') ? value : `/${value}`, SITE_URL).toString()
}

function canonicalUrl(route: RouteLocationNormalizedLoaded) {
  return new URL(route.path || '/', SITE_URL).toString()
}

function upsertMeta(selector: string, attrs: Record<string, string>) {
  let el = document.head.querySelector<HTMLMetaElement>(selector)

  if (!el) {
    el = document.createElement('meta')
    document.head.appendChild(el)
  }

  Object.entries(attrs).forEach(([key, value]) => el?.setAttribute(key, value))
}

function upsertLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`)

  if (!el) {
    el = document.createElement('link')
    el.rel = rel
    document.head.appendChild(el)
  }

  el.href = href
}

function upsertJsonLd(id: string, data: object) {
  let el = document.getElementById(id) as HTMLScriptElement | null

  if (!el) {
    el = document.createElement('script')
    el.id = id
    el.type = 'application/ld+json'
    document.head.appendChild(el)
  }

  el.textContent = JSON.stringify(data)
}

function getRouteSeo(route: RouteLocationNormalizedLoaded, t: TranslateFn): SeoMeta {
  const meta = route.meta as SeoMeta
  const siteName = t('navbar.title')
  const defaultDescription = t('seo.defaultDescription')

  if (route.name === 'Home') {
    return {
      title: siteName,
      description: t('main.subheadline'),
      image: DEFAULT_IMAGE,
    }
  }

  if (route.name === 'modpacks-list') {
    return {
      title: t('navbar.modpack'),
      description: t('seo.modpacksDescription'),
      image: DEFAULT_IMAGE,
    }
  }

  if (route.name === 'map-list') {
    return {
      title: t('navbar.map'),
      description: t('seo.mapsDescription'),
      image: DEFAULT_IMAGE,
    }
  }

  if (route.name === 'not-found') {
    return {
      title: t('notFound.title'),
      description: t('notFound.desc'),
      image: DEFAULT_IMAGE,
      noindex: true,
    }
  }

  return {
    title: normalizeText(meta.title, siteName),
    description: normalizeText(meta.description, defaultDescription),
    image: normalizeText(meta.image || meta.icon, DEFAULT_IMAGE),
    noindex: meta.noindex || route.path.endsWith('/secret'),
  }
}

export async function resolvePageSeo(
  route: RouteLocationNormalizedLoaded,
  locale: string,
  t: TranslateFn,
): Promise<ResolvedPageSeo> {
  const siteName = t('navbar.title')
  const defaultDescription = t('seo.defaultDescription')
  const rawSeo = getRouteSeo(route, t)
  const useAprilFoolsBranding = isAprilFoolsDay() && !isAprilFoolsSkippedPath(route.path)
  const localizedTitle = getLocalizedResourceName(
    { title: normalizeText(rawSeo.title, siteName), originalName: rawSeo.originalName },
    locale,
    siteName,
  )
  const titleRaw = await convertInlineText(localizedTitle, locale)
  const descriptionRaw = await convertInlineText(
    normalizeText(rawSeo.description, defaultDescription),
    locale,
  )
  const resolvedSiteName = useAprilFoolsBranding ? transformAprilFoolsText(siteName) : siteName
  const title = useAprilFoolsBranding ? transformAprilFoolsText(titleRaw) : titleRaw
  const description = useAprilFoolsBranding
    ? transformAprilFoolsText(descriptionRaw)
    : descriptionRaw
  const pageTitle = title === resolvedSiteName ? resolvedSiteName : `${title} | ${resolvedSiteName}`
  const url = canonicalUrl(route)
  const image = absoluteUrl(rawSeo.image || DEFAULT_IMAGE)
  const robots = rawSeo.noindex ? 'noindex, nofollow' : 'index, follow'

  return {
    description,
    image,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': route.name === 'Home' ? 'WebSite' : 'WebPage',
      name: pageTitle,
      description,
      url,
      image,
      publisher: {
        '@type': 'Organization',
        name: resolvedSiteName,
        url: SITE_URL,
        logo: absoluteUrl(
          useAprilFoolsBranding ? getAprilFoolsLogoPath(512) : '/imgs/logo/logo_512.png',
        ),
      },
    },
    locale,
    pageTitle,
    robots,
    siteName: resolvedSiteName,
    url,
  }
}

export function renderSeoHead(seo: ResolvedPageSeo) {
  const escapeAttr = (value: string) =>
    value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  const ogLocale = seo.locale === 'zh-TW' ? 'zh_TW' : seo.locale === 'en-US' ? 'en_US' : 'zh_CN'

  return [
    `<title>${escapeAttr(seo.pageTitle)}</title>`,
    `<meta name="description" content="${escapeAttr(seo.description)}" />`,
    `<meta name="robots" content="${escapeAttr(seo.robots)}" />`,
    `<link rel="canonical" href="${escapeAttr(seo.url)}" />`,
    `<meta property="og:site_name" content="${escapeAttr(seo.siteName)}" />`,
    '<meta property="og:type" content="website" />',
    `<meta property="og:title" content="${escapeAttr(seo.pageTitle)}" />`,
    `<meta property="og:description" content="${escapeAttr(seo.description)}" />`,
    `<meta property="og:url" content="${escapeAttr(seo.url)}" />`,
    `<meta property="og:image" content="${escapeAttr(seo.image)}" />`,
    `<meta property="og:locale" content="${ogLocale}" />`,
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${escapeAttr(seo.pageTitle)}" />`,
    `<meta name="twitter:description" content="${escapeAttr(seo.description)}" />`,
    `<meta name="twitter:image" content="${escapeAttr(seo.image)}" />`,
    `<script id="vmct-jsonld" type="application/ld+json">${JSON.stringify(seo.jsonLd).replace(/</g, '\\u003c')}</script>`,
  ].join('\n    ')
}

export async function syncPageSeo(
  route: RouteLocationNormalizedLoaded,
  locale: string,
  t: TranslateFn,
) {
  const seo = await resolvePageSeo(route, locale, t)

  document.title = seo.pageTitle

  upsertMeta('meta[name="description"]', { name: 'description', content: seo.description })
  upsertMeta('meta[name="robots"]', { name: 'robots', content: seo.robots })
  upsertMeta('meta[property="og:site_name"]', { property: 'og:site_name', content: seo.siteName })
  upsertMeta('meta[property="og:type"]', { property: 'og:type', content: 'website' })
  upsertMeta('meta[property="og:title"]', { property: 'og:title', content: seo.pageTitle })
  upsertMeta('meta[property="og:description"]', {
    property: 'og:description',
    content: seo.description,
  })
  upsertMeta('meta[property="og:url"]', { property: 'og:url', content: seo.url })
  upsertMeta('meta[property="og:image"]', { property: 'og:image', content: seo.image })
  upsertMeta('meta[property="og:locale"]', {
    property: 'og:locale',
    content: seo.locale === 'zh-TW' ? 'zh_TW' : seo.locale === 'en-US' ? 'en_US' : 'zh_CN',
  })
  upsertMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary_large_image' })
  upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: seo.pageTitle })
  upsertMeta('meta[name="twitter:description"]', {
    name: 'twitter:description',
    content: seo.description,
  })
  upsertMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: seo.image })
  upsertLink('canonical', seo.url)
  upsertJsonLd('vmct-jsonld', seo.jsonLd)
}
