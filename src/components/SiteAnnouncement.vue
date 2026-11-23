<template>
  <section
    v-if="announcementConfig.enabled"
    class="site-announcement box-border w-full p-[18px_20px_0] [background:var(--bg-off-white)] overflow-hidden [&_p]:flex [&_p]:flex-wrap [&_p]:gap-2 [&_p]:min-w-0 [&_p]:flex-1 [&_p]:m-0 [&_p]:text-[0.92rem] [&_p]:font-700 [&_p]:leading-[1.35] max-[720px]:p-[10px_10px_0] max-[720px]:[&_p]:block max-[720px]:[&_p]:text-[0.84rem] max-[720px]:[&_p]:leading-[1.4]"
    :class="{
      'is-home [.site-announcement&]:p-[12px_0_0] [.site-announcement&]:[background:radial-gradient(circle_at_12%_0%,_rgba(57,_132,_68,_0.1),_transparent_26%),_#eef3f2] [.dark_.site-announcement&]:[background:#101417] max-[720px]:[.site-announcement&]:p-[10px_0_0]':
        isHomePage,
      'is-doc-surface [.site-announcement&]:[background:var(--bg-alt)]': isDocSurface,
      'is-plain-surface [.site-announcement&]:[background:var(--bg-white)]': isPlainSurface,
    }"
    :aria-label="announcement.label"
  >
    <div
      class="site-announcement-inner flex items-center gap-3 box-border w-[min(1440px,_100%)] min-h-[44px] m-[0_auto] p-[7px_12px] [border:1px_solid_rgba(39,_112,_56,_0.12)] rounded-lg [background:rgba(255,_255,_255,_0.5)] text-[#277038] [.site-announcement.is-home_&]:w-[min(1320px,_calc(100%_-_40px))] dark:[background:rgba(24,_30,_34,_0.78)] dark:text-[#89e8bd] max-[720px]:grid max-[720px]:grid-cols-[auto_minmax(0,_1fr)_auto] max-[720px]:items-center max-[720px]:w-[calc(100%_-_20px)] max-[720px]:min-h-[52px] max-[720px]:gap-2 max-[720px]:p-[7px_9px]"
    >
      <span
        class="site-announcement-icon grid place-items-center w-7 h-7 flex-none rounded-lg [background:rgba(49,_130,_65,_0.1)] text-[1rem]"
        aria-hidden="true"
      >
        <Icon icon="lucide:megaphone" />
      </span>
      <p>
        <span>{{ announcement.body }}</span>
      </p>
      <RouterLink
        class="site-announcement-link inline-flex items-center justify-center min-h-[30px] p-[5px_12px] [border:1px_solid_rgba(39,_112,_56,_0.18)] rounded-lg [background:rgba(46,_125,_50,_0.1)] text-[#277038] text-[0.86rem] font-800 no-underline whitespace-nowrap dark:text-[#89e8bd] max-[720px]:w-[auto] max-[720px]:min-h-[32px] max-[720px]:p-[5px_10px] max-[720px]:text-[0.82rem]"
        :to="announcementConfig.link"
      >
        {{ announcement.action }}
      </RouterLink>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { Icon } from '@/icons'
import { announcementConfig } from '@/locales/announcement'

const route = useRoute()
const { locale } = useI18n()
const announcement = computed(
  () =>
    announcementConfig.messages[locale.value as keyof typeof announcementConfig.messages] ??
    announcementConfig.messages['zh-CN'],
)

const isHomePage = computed(() => route.path === '/')
const docSurfacePaths = new Set([
  '/agreement',
  '/community',
  '/doing',
  '/friends-links',
  '/privacy',
  '/support-us',
  '/tools',
])

const isDocSurface = computed(() => route.meta.layout === 'doc' || docSurfacePaths.has(route.path))
const isPlainSurface = computed(() => route.name === 'not-found')
</script>
