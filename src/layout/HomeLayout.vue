<template>
  <main class="home-shell">
    <section class="home-hero-panel">
      <div class="hero-copy" :class="{ 'is-english': locale === 'en-US' }">
        <span class="resource-kicker">
          <Icon icon="lucide:blocks" />
          {{ $t('main.homeHub.kicker') }}
        </span>
        <h1>{{ $t('main.headline') }}</h1>
        <p>{{ $t('main.homeHub.description') }}</p>

        <div class="hero-actions">
          <RouterLink to="/modpacks" class="hero-button hero-button-primary">
            <Icon icon="lucide:package-open" />
            {{ $t('main.homeHub.browseModpacks') }}
          </RouterLink>
          <RouterLink to="/map" class="hero-button">
            <Icon icon="lucide:map" />
            {{ $t('main.homeHub.browseMaps') }}
          </RouterLink>
        </div>

        <ul class="hero-trust-list">
          <li v-for="item in trustItems" :key="item.label">
            <Icon :icon="item.icon" />
            <span>{{ item.label }}</span>
          </li>
        </ul>
      </div>

      <div
        class="hero-feature"
        @mouseenter="pauseCarousel"
        @mouseleave="resumeCarousel"
        @focusin="pauseCarousel"
        @focusout="resumeCarousel"
      >
        <Transition name="hero-slide" mode="out-in">
          <RouterLink
            v-if="heroCarouselItem"
            :key="heroCarouselItem.link"
            :to="heroCarouselItem.link"
            class="hero-main-card flex flex-col"
          >
            <span class="hero-main-image image-loading-frame min-h-0 flex-1">
              <img
                :src="getResourceImage(heroCarouselItem, true)"
                :alt="getDisplayName(heroCarouselItem)"
                :loading="heroCarouselIndex === 0 ? 'eager' : 'lazy'"
                :fetchpriority="heroCarouselIndex === 0 ? 'high' : 'auto'"
                decoding="async"
              />
              <span class="hero-main-overlay z-1"></span>
            </span>
            <span
              class="grid shrink-0 gap-1 border-t border-[var(--home-border)] bg-[var(--home-surface-solid)] px-5 py-3.5 text-[var(--home-text)] lt-sm:px-3 lt-sm:py-3"
            >
              <strong class="text-[clamp(1.05rem,1.8vw,1.45rem)] font-850 leading-[1.2]">
                {{ getDisplayName(heroCarouselItem) }}
              </strong>
              <small
                class="line-clamp-2 text-[0.84rem] font-600 leading-[1.45] text-[var(--home-muted)]"
              >
                {{ heroCarouselItem.description || $t('main.homeHub.emptyFeaturedDesc') }}
              </small>
            </span>
          </RouterLink>
        </Transition>
        <div
          v-if="heroCarouselItems.length > 1"
          class="hero-carousel-indicators top-4 max-[760px]:top-3"
        >
          <button
            v-for="(item, index) in heroCarouselItems"
            :key="item.link"
            type="button"
            :class="{ active: index === heroCarouselIndex }"
            :aria-label="getDisplayName(item)"
            :aria-current="index === heroCarouselIndex ? 'true' : undefined"
            @click="heroCarouselIndex = index"
          />
        </div>
      </div>

      <div class="home-stats" :aria-label="$t('main.homeHub.statsLabel')">
        <article v-for="item in statItems" :key="item.label" class="stat-card">
          <span class="stat-icon">
            <Icon :icon="item.icon" />
          </span>
          <span>
            <small>{{ item.label }}</small>
            <strong>{{ item.value }}</strong>
          </span>
        </article>
      </div>
    </section>

    <section class="resource-layout">
      <div class="resource-main">
        <div class="section-title-row">
          <div class="section-title">
            <span class="section-icon">
              <Icon icon="lucide:package" />
            </span>
            <span>
              <h2>{{ $t('navbar.modpack') }}</h2>
              <small>{{ $t('main.homeHub.modpackSectionDesc') }}</small>
            </span>
          </div>
        </div>

        <div class="resource-tabs" :aria-label="$t('main.homeHub.sortLabel')">
          <button
            v-for="tab in resourceTabs"
            :key="tab.key"
            type="button"
            :class="{ active: activeResourceTab === tab.key }"
            @click="activeResourceTab = tab.key"
          >
            <Icon :icon="tab.icon" />
            {{ tab.label }}
          </button>
        </div>

        <div class="resource-grid">
          <RouterLink
            v-for="item in resourceCards"
            :key="item.link"
            :to="item.link"
            class="resource-card"
          >
            <span class="image-loading-frame resource-image-loading-frame">
              <img
                v-lazy="item.icon || '/imgs/missing.png'"
                :alt="getDisplayName(item)"
                class="resource-img"
              />
            </span>
            <div class="resource-meta">
              <span v-if="item.displayDate">
                {{ $t('pack.updateDate', { date: formatUpdateDate(item.displayDate, locale) }) }}
              </span>
            </div>
            <h3>{{ getDisplayName(item) }}</h3>
            <div class="resource-tags">
              <span
                v-if="item.versions?.loader"
                :class="['tag', 'strong', getLoaderClass(item.versions.loader)]"
              >
                <span
                  v-if="getLoaderIcon(item.versions.loader)"
                  class="tag-loader-icon"
                  :style="{
                    WebkitMaskImage: `url(${getLoaderIcon(item.versions.loader)})`,
                    maskImage: `url(${getLoaderIcon(item.versions.loader)})`,
                  }"
                  aria-hidden="true"
                />
                <Icon v-else icon="lucide:layers" />
                {{ getLoaderText(item.versions.loader) }}
              </span>
              <span v-if="item.versions?.mc" class="tag">{{ item.versions.mc }}</span>
              <span
                v-if="item.status?.type"
                :class="['tag', 'status-tag', `status-${item.status.type}`]"
                :title="getStatusDescription(item.status.type)"
              >
                {{ getStatusText(item.status.type) }}
              </span>
            </div>
            <p>{{ item.description || $t('main.emptyDescription') }}</p>
            <div class="resource-footer">
              <strong>
                {{ $t('main.homeHub.viewResource') }}
                <Icon icon="lucide:chevron-right" />
              </strong>
            </div>
          </RouterLink>
        </div>
      </div>

      <aside class="resource-sidebar">
        <section class="sidebar-panel">
          <h2>{{ $t('main.homeHub.siteSearch') }}</h2>
          <p>{{ $t('main.homeHub.searchDesc') }}</p>
          <button class="home-search-field" type="button" @click="isSearchOpen = true">
            <span>{{ $t('search.placeholder') }}</span>
            <Icon icon="lucide:search" />
          </button>
        </section>

        <section class="sidebar-panel guide-panel">
          <h2>{{ $t('main.homeHub.guideTitle') }}</h2>
          <RouterLink
            v-for="item in guideLinks"
            :key="item.link"
            :to="item.link"
            class="guide-link"
          >
            <span class="guide-icon"><Icon :icon="item.icon" /></span>
            <span>
              <strong>{{ item.title }}</strong>
              <small>{{ item.desc }}</small>
            </span>
          </RouterLink>
        </section>

        <section class="sidebar-panel compact-list">
          <h2>{{ $t('main.featuredMapsLabel') }}</h2>
          <RouterLink v-for="item in featuredMaps" :key="item.link" :to="item.link">
            <img v-lazy="item.icon || '/imgs/missing.png'" :alt="getDisplayName(item)" />
            <span>{{ getDisplayName(item) }}</span>
          </RouterLink>
        </section>
      </aside>
    </section>

    <SearchOverlay :visible="isSearchOpen" @close="isSearchOpen = false" />
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Icon } from '@iconify/vue'
import { maps, modpacks } from 'virtual:resources'
import { getLoaderClass, getLoaderIcon } from '@/data/loaderIcons'
import { formatUpdateDate } from '@/utils/dateFormat'
import { getLocalizedResourceName } from '@/utils/resourceDisplay'
import type { ResourceItem, ResourceStatusType } from '@/types/resource'

import SearchOverlay from '@/components/NavBar/SearchOverlay.vue'

const { locale, t } = useI18n()
const isSearchOpen = ref(false)
const activeResourceTab = ref<'hot' | 'updated'>('hot')
const heroCarouselIndex = ref(0)
const isCarouselPaused = ref(false)
let carouselTimer: ReturnType<typeof setInterval> | undefined

const sortedModpacks = computed(() =>
  modpacks.slice().sort((a, b) => (b.date || 0) - (a.date || 0)),
)

const featuredMaps = computed(() => maps.slice(0, 4))
const heroCarouselItems = computed<ResourceItem[]>(() =>
  [...modpacks, ...maps].sort((a, b) => (b.date || 0) - (a.date || 0)).slice(0, 6),
)
const heroCarouselItem = computed(() => heroCarouselItems.value[heroCarouselIndex.value])
const resourceCards = computed(() => {
  if (activeResourceTab.value === 'updated') return sortedModpacks.value.slice(0, 6)

  const featured = sortedModpacks.value.filter((item) => item.featured)
  const fallback = sortedModpacks.value.filter((item) => !item.featured)
  return [...featured, ...fallback].slice(0, 6)
})
const statItems = computed(() => [
  {
    label: t('main.homeHub.totalResources'),
    value: t('main.homeHub.countValue', { count: modpacks.length + maps.length }),
    icon: 'lucide:boxes',
  },
  {
    label: t('main.homeHub.totalModpacks'),
    value: t('main.homeHub.countValue', { count: modpacks.length }),
    icon: 'lucide:package',
  },
  {
    label: t('main.homeHub.mapTranslations'),
    value: t('main.homeHub.countValue', { count: maps.length }),
    icon: 'lucide:map',
  },
  {
    label: t('main.homeHub.patchDownloads'),
    value: t('main.homeHub.downloadTotalValue'),
    icon: 'lucide:download',
  },
  { label: t('main.homeHub.openTools'), value: t('main.homeHub.keepUpdating'), icon: 'lucide:eye' },
])

const trustItems = computed(() => [
  { label: t('main.homeHub.trustSince'), icon: 'lucide:calendar-heart' },
  { label: t('main.homeHub.trustTranslation'), icon: 'lucide:languages' },
  { label: t('main.homeHub.trustCopyright'), icon: 'lucide:badge-check' },
])

const resourceTabs = computed(() =>
  [
    { key: 'hot' as const, labelKey: 'main.homeHub.hotModpacks', icon: 'lucide:flame' },
    { key: 'updated' as const, labelKey: 'main.homeHub.recentlyUpdated', icon: 'lucide:wrench' },
  ].map((item) => ({ ...item, label: t(item.labelKey) })),
)

const guideLinks = computed(() => [
  {
    title: t('navbar.community'),
    desc: t('main.quickCommunityDesc'),
    link: '/community',
    icon: 'lucide:megaphone',
  },
  {
    title: t('navbar.supportUs'),
    desc: t('main.homeHub.supportDesc'),
    link: '/support-us',
    icon: 'lucide:heart-handshake',
  },
  {
    title: t('navbar.tools'),
    desc: t('main.quickToolsDesc'),
    link: '/tools',
    icon: 'lucide:wrench',
  },
])

const getStatusText = (statusType?: ResourceStatusType) => {
  if (!statusType) return ''
  const key = `pack.status.${statusType}`
  const label = t(key)
  return label === key ? statusType : label
}

const getStatusDescription = (statusType?: ResourceStatusType) => {
  if (statusType !== 'stopped') return undefined
  return t('pack.statusDescription.stopped')
}

const getLoaderText = (loader?: string) => {
  if (!loader) return ''
  const key = `loader.${loader.toLowerCase()}`
  const label = t(key)
  return label === key ? loader : label
}

const getResourceImage = (item: ResourceItem, preferLarge = false) => {
  if (preferLarge && item.image) return item.image
  return item.icon || item.image || '/imgs/missing.png'
}

const getDisplayName = (item: ResourceItem) => getLocalizedResourceName(item, locale.value)

const showNextCarouselItem = () => {
  const itemCount = heroCarouselItems.value.length
  if (isCarouselPaused.value || itemCount < 2) return

  heroCarouselIndex.value = (heroCarouselIndex.value + 1) % itemCount
}

const pauseCarousel = () => {
  isCarouselPaused.value = true
}

const resumeCarousel = () => {
  isCarouselPaused.value = false
}

watch(
  () => heroCarouselItems.value.length,
  (itemCount) => {
    if (heroCarouselIndex.value >= itemCount) heroCarouselIndex.value = 0
  },
)

onMounted(() => {
  carouselTimer = setInterval(showNextCarouselItem, 6000)
})

onUnmounted(() => {
  if (carouselTimer) clearInterval(carouselTimer)
})
</script>

<style scoped>
@import '@/styles/Home.css';
</style>
