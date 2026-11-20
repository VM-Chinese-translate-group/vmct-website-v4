<template>
  <nav
    class="navbar sticky [top:0] w-full [background:var(--nav-bg,_#f7faf9)] [box-shadow:0_1px_2px_var(--nav-shadow,_rgba(0,_0,_0,_0.05))] z-[1000] [border-bottom:1px_solid_rgba(15,_23,_42,_0.06)] [&::before]:[content:none]"
    :class="{
      'is-menu-open max-[860px]:[.navbar&]:fixed max-[860px]:[.navbar&]:[right:0] max-[860px]:[.navbar&]:[left:0]':
        isMenuOpen,
    }"
  >
    <div
      class="navbar-container relative z-[1] flex items-center justify-between max-w-[1440px] m-[0_auto] p-[0_1.25rem] h-13 gap-[1rem] max-[860px]:p-[0_1rem] max-[860px]:h-16"
    >
      <a
        class="navbar-brand flex items-center cursor-pointer z-[1001] min-w-0 text-[inherit] no-underline"
        href="/"
        @click.prevent="goToHome"
      >
        <img
          v-lazy="siteLogo"
          alt="Logo"
          class="navbar-logo w-[var(--nav-logo-desktop,_28px)] h-[var(--nav-logo-desktop,_28px)] object-contain mr-[0.65rem] flex-none"
        />
        <span
          class="navbar-title text-[var(--text-dark)] font-600 text-[1rem] whitespace-nowrap max-[1180px]:text-[0.96rem]"
        >
          {{ $t('navbar.title') }}
        </span>
      </a>

      <div
        class="navbar-content flex items-center flex-1 justify-end min-w-0 max-[860px]:fixed max-[860px]:[top:64px] max-[860px]:[right:0] max-[860px]:[left:0] max-[860px]:z-[1000] max-[860px]:w-full max-[860px]:h-[calc(100dvh_-_64px)] max-[860px]:[background:var(--nav-bg,_#f7faf9)] max-[860px]:[backdrop-filter:none] max-[860px]:[-webkit-backdrop-filter:none] max-[860px]:flex-col max-[860px]:justify-start max-[860px]:items-stretch max-[860px]:p-[1.5rem_2rem] max-[860px]:box-border max-[860px]:overflow-y-auto max-[860px]:opacity-[0] max-[860px]:invisible max-[860px]:[transform:translateY(-10px)] max-[860px]:[transition:opacity_0.3s_cubic-bezier(0.4,_0,_0.2,_1),_visibility_0.3s_cubic-bezier(0.4,_0,_0.2,_1),_transform_0.3s_cubic-bezier(0.4,_0,_0.2,_1)]"
        :class="{
          'is-active max-[860px]:[.navbar-content&]:opacity-[1] max-[860px]:[.navbar-content&]:visible max-[860px]:[.navbar-content&]:[transform:translateY(0)]':
            isMenuOpen,
        }"
      >
        <div
          class="navbar-nav-area relative flex items-center justify-end [flex:1_1_auto] min-w-0 max-[860px]:block max-[860px]:w-full max-[860px]:[flex:none]"
          ref="navAreaRef"
        >
          <ul
            class="navbar-list flex items-center [list-style:none] m-0 p-0 gap-[0] [flex-shrink:1] min-w-0 max-[860px]:flex-col max-[860px]:items-stretch max-[860px]:gap-[0] max-[860px]:mb-[1rem] max-[860px]:[border-bottom:1px_solid_var(--nav-shadow,_rgba(0,_0,_0,_0.1))]"
          >
            <li
              v-for="item in visibleNavItems"
              :key="item.key"
              class="navbar-item [&_a]:inline-flex [&_a]:items-center [&_a]:text-[var(--nav-text,_#333)] [&_a]:text-[var(--nav-font-size-link,_0.88rem)] [&_a]:font-500 [&_a]:no-underline [&_a]:leading-[1.4] [&_a]:p-[0.45rem_0.58rem] [&_a]:rounded-md [&_a]:whitespace-nowrap [&_a]:[transition:background-color_0.2s_ease,_color_0.2s_ease] [.navbar-measure_&]:inline-flex [.navbar-measure_&]:items-center [.navbar-measure_&]:text-[var(--nav-text,_#333)] [.navbar-measure_&]:text-[var(--nav-font-size-link,_0.88rem)] [.navbar-measure_&]:font-500 [.navbar-measure_&]:no-underline [.navbar-measure_&]:leading-[1.4] [.navbar-measure_&]:p-[0.45rem_0.58rem] [.navbar-measure_&]:rounded-md [.navbar-measure_&]:whitespace-nowrap [.navbar-measure_&]:[transition:background-color_0.2s_ease,_color_0.2s_ease] [&_a:hover]:text-[var(--nav-primary)] [&_a:hover]:bg-[var(--nav-hover-bg,_#ffffff)] [&_a.router-link-active]:text-[var(--nav-primary)] [&_a.router-link-active]:font-600 [&_a:focus-visible]:[outline:2px_solid_var(--nav-primary)] [&_a:focus-visible]:[outline-offset:3px] max-[1180px]:[&_a]:text-[var(--nav-font-size-link,_0.84rem)] max-[1180px]:[&_a]:px-[0.48rem] max-[1180px]:[.navbar-measure_&]:text-[var(--nav-font-size-link,_0.84rem)] max-[1180px]:[.navbar-measure_&]:px-[0.48rem] max-[860px]:[&_a]:flex max-[860px]:[&_a]:p-[1rem_0] max-[860px]:[&_a]:text-[1.1rem] max-[860px]:[&_a]:rounded-[0] max-[860px]:[&_a]:[border-bottom:1px_solid_rgba(0,_0,_0,_0.03)] max-[860px]:[&:last-child_a]:[border-bottom:none]"
            >
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

          <div
            v-if="overflowNavItems.length"
            class="navbar-more relative flex-none max-[860px]:hidden"
            @click.stop
          >
            <button
              class="navbar-more-button inline-flex items-center text-[var(--nav-text,_#333)] text-[var(--nav-font-size-link,_0.88rem)] font-500 no-underline leading-[1.4] p-[0.45rem_0.58rem] rounded-md whitespace-nowrap [transition:background-color_0.2s_ease,_color_0.2s_ease] gap-[0.25rem] [border:none] [background:transparent] cursor-pointer focus-visible:[outline:2px_solid_var(--nav-primary)] focus-visible:[outline-offset:3px] hover:text-[var(--nav-primary)] hover:bg-[var(--nav-hover-bg,_#ffffff)] max-[1180px]:text-[var(--nav-font-size-link,_0.84rem)] max-[1180px]:px-[0.48rem]"
              type="button"
              :aria-expanded="isMoreOpen"
              aria-haspopup="menu"
              @click="toggleMore"
            >
              <span>{{ $t('navbar.more') }}</span>
              <Icon
                icon="lucide:chevron-down"
                class="navbar-more-icon w-[0.85rem] h-[0.85rem] opacity-[0.65] [transition:transform_0.2s_ease]"
                :class="{
                  'is-open [.navbar-more-icon&]:[transform:rotate(180deg)] [.navbar-more-menu&]:opacity-[1] [.navbar-more-menu&]:visible [.navbar-more-menu&]:[transform:translateY(0)]':
                    isMoreOpen,
                }"
              />
            </button>
            <ul
              class="navbar-more-menu absolute [right:0] [top:calc(100%_+_10px)] min-w-[168px] [list-style:none] m-0 p-[0.45rem] [border:1px_solid_rgba(0,_0,_0,_0.1)] rounded-lg [background:var(--nav-menu-bg,_#fff)] [box-shadow:0_12px_30px_rgba(0,_0,_0,_0.12)] opacity-[0] invisible [transform:translateY(-6px)] [transition:opacity_0.18s_ease,_visibility_0.18s_ease,_transform_0.18s_ease]"
              :class="{
                'is-open [.navbar-more-icon&]:[transform:rotate(180deg)] [.navbar-more-menu&]:opacity-[1] [.navbar-more-menu&]:visible [.navbar-more-menu&]:[transform:translateY(0)]':
                  isMoreOpen,
              }"
              role="menu"
            >
              <li
                v-for="item in overflowNavItems"
                :key="item.key"
                class="navbar-more-item [&_a]:flex [&_a]:items-center [&_a]:text-[var(--nav-text,_#333)] [&_a]:text-[var(--nav-font-size-link,_0.88rem)] [&_a]:font-500 [&_a]:no-underline [&_a]:p-[0.55rem_0.65rem] [&_a]:rounded-md [&_a]:whitespace-nowrap [&_a:hover]:text-[var(--nav-primary)] [&_a:hover]:bg-[var(--nav-hover-bg,_#ffffff)] [&_a.router-link-active]:text-[var(--nav-primary)] [&_a.router-link-active]:bg-[var(--nav-hover-bg,_#ffffff)] max-[1180px]:[&_a]:text-[var(--nav-font-size-link,_0.84rem)] max-[1180px]:[&_a]:px-[0.48rem]"
              >
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

          <div
            class="navbar-measure absolute [inset:auto_auto_0_0] flex invisible pointer-events-none whitespace-nowrap z-[-1] max-[860px]:hidden"
            aria-hidden="true"
          >
            <span
              v-for="item in navItems"
              :key="item.key"
              ref="measureItemRefs"
              class="navbar-item [&_a]:inline-flex [&_a]:items-center [&_a]:text-[var(--nav-text,_#333)] [&_a]:text-[var(--nav-font-size-link,_0.88rem)] [&_a]:font-500 [&_a]:no-underline [&_a]:leading-[1.4] [&_a]:p-[0.45rem_0.58rem] [&_a]:rounded-md [&_a]:whitespace-nowrap [&_a]:[transition:background-color_0.2s_ease,_color_0.2s_ease] [.navbar-measure_&]:inline-flex [.navbar-measure_&]:items-center [.navbar-measure_&]:text-[var(--nav-text,_#333)] [.navbar-measure_&]:text-[var(--nav-font-size-link,_0.88rem)] [.navbar-measure_&]:font-500 [.navbar-measure_&]:no-underline [.navbar-measure_&]:leading-[1.4] [.navbar-measure_&]:p-[0.45rem_0.58rem] [.navbar-measure_&]:rounded-md [.navbar-measure_&]:whitespace-nowrap [.navbar-measure_&]:[transition:background-color_0.2s_ease,_color_0.2s_ease] [&_a:hover]:text-[var(--nav-primary)] [&_a:hover]:bg-[var(--nav-hover-bg,_#ffffff)] [&_a.router-link-active]:text-[var(--nav-primary)] [&_a.router-link-active]:font-600 [&_a:focus-visible]:[outline:2px_solid_var(--nav-primary)] [&_a:focus-visible]:[outline-offset:3px] max-[1180px]:[&_a]:text-[var(--nav-font-size-link,_0.84rem)] max-[1180px]:[&_a]:px-[0.48rem] max-[1180px]:[.navbar-measure_&]:text-[var(--nav-font-size-link,_0.84rem)] max-[1180px]:[.navbar-measure_&]:px-[0.48rem] max-[860px]:[&_a]:flex max-[860px]:[&_a]:p-[1rem_0] max-[860px]:[&_a]:text-[1.1rem] max-[860px]:[&_a]:rounded-[0] max-[860px]:[&_a]:[border-bottom:1px_solid_rgba(0,_0,_0,_0.03)] max-[860px]:[&:last-child_a]:[border-bottom:none]"
            >
              <span>{{ $t(item.labelKey) }}</span>
            </span>
            <span
              ref="moreMeasureRef"
              class="navbar-more-button inline-flex items-center text-[var(--nav-text,_#333)] text-[var(--nav-font-size-link,_0.88rem)] font-500 no-underline leading-[1.4] p-[0.45rem_0.58rem] rounded-md whitespace-nowrap [transition:background-color_0.2s_ease,_color_0.2s_ease] gap-[0.25rem] [border:none] [background:transparent] cursor-pointer focus-visible:[outline:2px_solid_var(--nav-primary)] focus-visible:[outline-offset:3px] hover:text-[var(--nav-primary)] hover:bg-[var(--nav-hover-bg,_#ffffff)] max-[1180px]:text-[var(--nav-font-size-link,_0.84rem)] max-[1180px]:px-[0.48rem]"
            >
              <span>{{ $t('navbar.more') }}</span>
              <Icon
                icon="lucide:chevron-down"
                class="navbar-more-icon w-[0.85rem] h-[0.85rem] opacity-[0.65] [transition:transform_0.2s_ease]"
              />
            </span>
          </div>
        </div>

        <div
          class="navbar-divider w-[1px] h-6 bg-[var(--nav-shadow,_rgba(0,_0,_0,_0.15))] m-[0_0.75rem] flex-none max-[860px]:hidden"
        ></div>

        <div
          class="navbar-utils flex items-center gap-[0.5rem] flex-none max-[860px]:flex-col max-[860px]:items-stretch max-[860px]:justify-start max-[860px]:gap-[0.75rem] max-[860px]:w-full"
        >
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
          <button
            type="button"
            class="search-box-trigger focus-visible:[outline:2px_solid_var(--nav-primary)] focus-visible:[outline-offset:3px] flex items-center bg-[var(--search-trigger-hover,_rgba(0,_0,_0,_0.05))] [border:1px_solid_transparent] rounded-lg p-[0.35rem_0.6rem] w-[clamp(116px,_13vw,_176px)] min-w-0 cursor-pointer [transition:all_0.2s_ease] hover:bg-[var(--nav-hover-bg,_#ffffff)] hover:border-[var(--nav-primary)] desktop-search max-[860px]:hidden"
            @click="openSearch"
          >
            <Icon
              icon="lucide:search"
              class="search-icon text-[var(--nav-text)] opacity-[0.7] w-[17px] h-[17px] flex-none"
            />
            <span
              class="search-text ml-[0.5rem] text-[0.86rem] text-[var(--nav-text)] opacity-[0.6] flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap"
            >
              {{ $t('search.placeholder') }}
            </span>
            <span
              class="search-shortcut inline-flex items-center gap-[3px] text-[0.75rem] font-600 [background:var(--nav-bg)] text-[var(--nav-text)] p-[2px_6px] rounded [border:1px_solid_rgba(0,_0,_0,_0.1)] opacity-[0.5] flex-none"
              :aria-label="isApplePlatform ? 'Command K' : 'Ctrl K'"
            >
              <Icon
                v-if="isApplePlatform"
                icon="lucide:command"
                class="search-shortcut-icon w-[0.8rem] h-[0.8rem]"
                aria-hidden="true"
              />
              <span v-else>Ctrl</span>
              <span>K</span>
            </span>
          </button>
          <Switcher />
        </div>
      </div>

      <div
        class="navbar-mobile-actions hidden items-center gap-[0.5rem] z-[1001] flex-none max-[860px]:flex"
      >
        <button
          type="button"
          class="mobile-search-btn focus-visible:[outline:2px_solid_var(--nav-primary)] focus-visible:[outline-offset:3px] [background:transparent] [border:none] p-[0.5rem] cursor-pointer text-[var(--nav-text)] flex items-center justify-center rounded-lg"
          :aria-label="$t('search.placeholder')"
          @click="openSearch"
        >
          <Icon
            icon="lucide:search"
            class="search-icon text-[var(--nav-text)] opacity-[0.7] w-[17px] h-[17px] flex-none"
          />
        </button>
        <button
          type="button"
          class="hamburger focus-visible:[outline:2px_solid_var(--nav-primary)] focus-visible:[outline-offset:3px] flex flex-col justify-center items-center gap-[6px] w-[2rem] h-[2rem] [background:transparent] [border:none] cursor-pointer p-[0.4rem] rounded-lg"
          :class="{
            'is-active max-[860px]:[.navbar-content&]:opacity-[1] max-[860px]:[.navbar-content&]:visible max-[860px]:[.navbar-content&]:[transform:translateY(0)]':
              isMenuOpen,
          }"
          :aria-expanded="isMenuOpen"
          :aria-label="$t('navbar.menu')"
          @click="toggleMenu"
        >
          <span class="line vm-nav-line"></span>
          <span class="line vm-nav-line"></span>
          <span class="line vm-nav-line"></span>
        </button>
      </div>
    </div>
    <SearchOverlay :visible="isSearchOpen" @close="isSearchOpen = false" />
  </nav>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, onMounted, onUnmounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Icon } from '@iconify/vue'
import { navItems } from '@/data/navigation'
import { getAprilFoolsLogoPath } from '@/utils/aprilFools'
import { usePageScrollLock } from '@/composables/usePageScrollLock'
import Switcher from './Switcher.vue'
import SearchOverlay from './SearchOverlay.vue'

const { locale } = useI18n()

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
