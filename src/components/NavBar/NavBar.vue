<template>
  <nav class="navbar" :class="{ 'is-menu-open': isMenuOpen }">
    <div class="navbar-container">
      <a class="navbar-brand" href="/" @click.prevent="goToHome">
        <img v-lazy="siteLogo" alt="Logo" class="navbar-logo" />
        <span class="navbar-title">{{ $t('navbar.title') }}</span>
      </a>

      <div class="navbar-content" :class="{ 'is-active': isMenuOpen }">
        <div class="navbar-nav-area" ref="navAreaRef">
          <ul class="navbar-list">
            <li v-for="item in visibleNavItems" :key="item.key" class="navbar-item">
              <a
                v-if="isExternalLink(item.to)"
                :href="item.to"
                target="_blank"
                rel="noopener noreferrer"
                @click="closeMenu"
              >
                {{ $t(item.labelKey) }}
              </a>
              <router-link v-else :to="item.to">{{ $t(item.labelKey) }}</router-link>
            </li>
          </ul>

          <div v-if="overflowNavItems.length" class="navbar-more" @click.stop>
            <button
              class="navbar-more-button"
              type="button"
              :aria-expanded="isMoreOpen"
              aria-haspopup="menu"
              @click="toggleMore"
            >
              <span>{{ $t('navbar.more') }}</span>
              <Icon
                icon="lucide:chevron-down"
                class="navbar-more-icon"
                :class="{ 'is-open': isMoreOpen }"
              />
            </button>
            <ul class="navbar-more-menu" :class="{ 'is-open': isMoreOpen }" role="menu">
              <li v-for="item in overflowNavItems" :key="item.key" class="navbar-more-item">
                <a
                  v-if="isExternalLink(item.to)"
                  :href="item.to"
                  target="_blank"
                  rel="noopener noreferrer"
                  role="menuitem"
                  @click="closeMenu"
                >
                  {{ $t(item.labelKey) }}
                </a>
                <router-link v-else :to="item.to" role="menuitem">
                  {{ $t(item.labelKey) }}
                </router-link>
              </li>
            </ul>
          </div>

          <div class="navbar-measure" aria-hidden="true">
            <span
              v-for="item in navItems"
              :key="item.key"
              ref="measureItemRefs"
              class="navbar-item"
            >
              <span>{{ $t(item.labelKey) }}</span>
            </span>
            <span ref="moreMeasureRef" class="navbar-more-button">
              <span>{{ $t('navbar.more') }}</span>
              <Icon icon="lucide:chevron-down" class="navbar-more-icon" />
            </span>
          </div>
        </div>

        <div class="navbar-divider"></div>

        <div class="navbar-utils">
          <router-link
            class="navbar-feedback-link inline-flex min-w-0 max-w-[9.6rem] flex-[0_1_auto] box-border items-center justify-center gap-1.5 overflow-hidden rounded-lg border border-[color-mix(in_srgb,var(--nav-primary)_28%,transparent)] bg-[color-mix(in_srgb,var(--nav-primary)_10%,transparent)] px-[0.68rem] py-[0.38rem] text-[0.78rem] font-700 leading-[1.25] text-[var(--nav-primary)] no-underline text-ellipsis whitespace-nowrap transition-[color,background-color,border-color,transform] duration-200 ease-out hover:translate-y-[-1px] hover:border-[color-mix(in_srgb,var(--nav-primary)_48%,transparent)] hover:bg-[color-mix(in_srgb,var(--nav-primary)_17%,transparent)] focus-visible:outline-2 focus-visible:outline-[var(--nav-primary)] focus-visible:outline-offset-3 max-[1180px]:max-w-[8.2rem] max-[1180px]:px-2 max-[1180px]:text-[0.74rem] max-[860px]:min-h-11 max-[860px]:w-full max-[860px]:max-w-none max-[860px]:px-4 max-[860px]:py-[0.7rem] max-[860px]:text-base"
            to="/translation-feedback"
            :class="{
              'translate-y-[-1px] border-[color-mix(in_srgb,var(--nav-primary)_48%,transparent)] bg-[color-mix(in_srgb,var(--nav-primary)_17%,transparent)]':
                route.path === '/translation-feedback',
            }"
            :aria-label="$t('navbar.feedbackCta')"
            @click="closeMenu"
          >
            <Icon class="h-4 w-4 shrink-0" icon="lucide:message-square-plus" aria-hidden="true" />
            <span>{{ $t('navbar.feedbackCta') }}</span>
          </router-link>
          <button type="button" class="search-box-trigger desktop-search" @click="openSearch">
            <Icon icon="lucide:search" class="search-icon" />
            <span class="search-text">{{ $t('search.placeholder') }}</span>
            <span class="search-shortcut" :aria-label="isApplePlatform ? 'Command K' : 'Ctrl K'">
              <Icon
                v-if="isApplePlatform"
                icon="lucide:command"
                class="search-shortcut-icon"
                aria-hidden="true"
              />
              <span v-else>Ctrl</span>
              <span>K</span>
            </span>
          </button>
          <Switcher />
          <button
            type="button"
            class="navbar-announcements-button"
            :aria-label="announcementButtonLabel"
            :title="announcementButtonLabel"
            aria-haspopup="dialog"
            :aria-expanded="isAnnouncementsOpen"
            aria-controls="site-announcements-list"
            @click="openAnnouncements"
          >
            <Icon icon="lucide:megaphone" class="navbar-announcements-icon" aria-hidden="true" />
            <span v-if="hasUnreadAnnouncements" class="navbar-announcement-dot" aria-hidden="true"></span>
          </button>
        </div>
      </div>

      <div class="navbar-mobile-actions">
        <button
          type="button"
          class="mobile-announcements-btn"
          :aria-label="announcementButtonLabel"
          :title="announcementButtonLabel"
          aria-haspopup="dialog"
          :aria-expanded="isAnnouncementsOpen"
          aria-controls="site-announcements-list"
          @click="openAnnouncements"
        >
          <Icon icon="lucide:megaphone" class="navbar-announcements-icon" aria-hidden="true" />
          <span v-if="hasUnreadAnnouncements" class="navbar-announcement-dot" aria-hidden="true"></span>
        </button>
        <button
          type="button"
          class="mobile-search-btn"
          :aria-label="$t('search.placeholder')"
          @click="openSearch"
        >
          <Icon icon="lucide:search" class="search-icon" />
        </button>
        <button
          type="button"
          class="hamburger"
          :class="{ 'is-active': isMenuOpen }"
          :aria-expanded="isMenuOpen"
          :aria-label="$t('navbar.menu')"
          @click="toggleMenu"
        >
          <span class="line"></span>
          <span class="line"></span>
          <span class="line"></span>
        </button>
      </div>
    </div>
    <SearchOverlay :visible="isSearchOpen" @close="isSearchOpen = false" />
  </nav>
</template>

<script setup lang="ts">
import { computed, inject, nextTick, ref, onMounted, onUnmounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Icon } from '@iconify/vue'
import { navItems } from '@/data/navigation'
import { announcementPanelKey } from '@/data/announcements'
import { getAprilFoolsLogoPath } from '@/utils/aprilFools'
import { usePageScrollLock } from '@/composables/usePageScrollLock'
import Switcher from './Switcher.vue'
import SearchOverlay from './SearchOverlay.vue'

const { locale, t } = useI18n()
const {
  isOpen: isAnnouncementsOpen,
  hasUnread: hasUnreadAnnouncements,
  toggle: toggleAnnouncements,
} = inject(announcementPanelKey)!
const announcementButtonLabel = computed(() =>
  t(hasUnreadAnnouncements.value ? 'navbar.unreadAnnouncements' : 'navbar.announcements'),
)

const router = useRouter()
const route = useRoute()
const isMenuOpen = ref(false)
const isMoreOpen = ref(false)
const isSearchOpen = ref(false)
const siteLogo = getAprilFoolsLogoPath()
const visibleCount = ref(navItems.length)
const navAreaRef = ref<HTMLElement | null>(null)
const measureItemRefs = ref<HTMLElement[]>([])
const moreMeasureRef = ref<HTMLElement | null>(null)
const { lock: lockPageScroll, unlock: unlockPageScroll } = usePageScrollLock()
let resizeObserver: ResizeObserver | null = null

const visibleNavItems = computed(() => navItems.slice(0, visibleCount.value))
const overflowNavItems = computed(() => navItems.slice(visibleCount.value))
const isExternalLink = (url: string) => /^https?:\/\//.test(url)

const getIsApplePlatform = () => {
  if (typeof navigator === 'undefined') return false

  const platform = navigator.platform.toLowerCase()
  const userAgent = navigator.userAgent.toLowerCase()
  return (
    platform.includes('mac') ||
    platform.includes('iphone') ||
    platform.includes('ipad') ||
    platform.includes('ipod') ||
    userAgent.includes('mac os') ||
    userAgent.includes('iphone') ||
    userAgent.includes('ipad') ||
    userAgent.includes('ipod')
  )
}

const isApplePlatform = getIsApplePlatform()

const toggleMenu = () => {
  isMenuOpen.value = !isMenuOpen.value
  isMoreOpen.value = false
  if (isMenuOpen.value) {
    lockPageScroll()
  } else {
    unlockPageScroll()
  }
}

const closeMenu = () => {
  isMenuOpen.value = false
  isMoreOpen.value = false
  unlockPageScroll()
}

const toggleMore = () => {
  isMoreOpen.value = !isMoreOpen.value
}

watch(
  () => route.path,
  () => {
    closeMenu()
  },
)

const openSearch = () => {
  isSearchOpen.value = true
  closeMenu()
}

const openAnnouncements = (event: MouseEvent) => {
  closeMenu()
  toggleAnnouncements(event.currentTarget as HTMLElement)
}

const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    isMoreOpen.value = false
    return
  }

  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    openSearch()
  }
}

const calculateVisibleItems = async () => {
  await nextTick()

  if (typeof window === 'undefined' || window.innerWidth <= 860) {
    visibleCount.value = navItems.length
    isMoreOpen.value = false
    return
  }

  const navAreaWidth = navAreaRef.value?.clientWidth ?? 0
  const itemWidths = measureItemRefs.value.map((el) => el.offsetWidth)
  const moreWidth = moreMeasureRef.value?.offsetWidth ?? 0

  if (!navAreaWidth || itemWidths.length !== navItems.length) {
    visibleCount.value = navItems.length
    return
  }

  const totalWidth = itemWidths.reduce((sum, width) => sum + width, 0)
  if (totalWidth <= navAreaWidth) {
    visibleCount.value = navItems.length
    isMoreOpen.value = false
    return
  }

  let usedWidth = moreWidth
  let nextVisibleCount = 0

  for (const width of itemWidths) {
    if (usedWidth + width > navAreaWidth) break
    usedWidth += width
    nextVisibleCount += 1
  }

  visibleCount.value = Math.max(0, Math.min(nextVisibleCount, navItems.length - 1))
}

const handleDocumentClick = () => {
  isMoreOpen.value = false
}

const handleResize = () => {
  void calculateVisibleItems()
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('resize', handleResize)
  document.addEventListener('click', handleDocumentClick)

  if ('ResizeObserver' in window && navAreaRef.value) {
    resizeObserver = new ResizeObserver(() => {
      void calculateVisibleItems()
    })
    resizeObserver.observe(navAreaRef.value)
  }

  void calculateVisibleItems()
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
  window.removeEventListener('resize', handleResize)
  document.removeEventListener('click', handleDocumentClick)
  resizeObserver?.disconnect()
})

watch(locale, () => {
  void calculateVisibleItems()
})

const goToHome = () => {
  closeMenu()
  if (route.path === '/') {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  } else {
    router.push('/')
  }
}
</script>

<style scoped>
@import '@/styles/NavBar.css';
</style>
