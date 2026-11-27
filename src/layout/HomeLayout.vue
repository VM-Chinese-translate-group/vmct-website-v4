<template>
  <main
    class="home-shell min-h-[100vh] p-[18px_0_54px] [background:radial-gradient(circle_at_12%_8%,_rgba(57,_132,_68,_0.1),_transparent_26%),_linear-gradient(180deg,_#eef3f2_0%,_#e8efed_100%)] text-[var(--home-text)] box-border [&_*]:box-border dark:[background:#101417] max-[760px]:pt-4 [&_:is(a,_button):focus-visible]:[outline:2px_solid_var(--home-accent)] [&_:is(a,_button):focus-visible]:[outline-offset:3px] motion-reduce:[&_*]:[transition:none]! motion-reduce:[&_*]:[animation:none]! motion-reduce:[&_*::before]:[transition:none]! motion-reduce:[&_*::before]:[animation:none]!"
  >
    <section
      class="home-hero-panel w-[min(1320px,_calc(100%_-_40px))] m-[0_auto] grid grid-cols-[minmax(0,_0.95fr)_minmax(420px,_1.05fr)] gap-8 p-[clamp(34px,_5vw,_52px)_26px_26px] [border:1px_solid_var(--home-border)] rounded-lg [background:var(--home-surface)] max-[1120px]:grid-cols-1 max-[1120px]:min-h-0 max-[760px]:w-[min(100%_-_20px,_1320px)] max-[760px]:gap-[30px] max-[760px]:p-[24px_14px_16px] max-[760px]:rounded-lg"
    >
      <div
        class="hero-copy self-center min-w-0 p-[18px_0] [&_h1]:m-[28px_0_20px] [&_h1]:text-[clamp(2.4rem,_4.5vw,_3.55rem)] [&_h1]:font-900 [&_h1]:leading-[1.06] [&_h1]:tracking-[0] [&_p]:max-w-[58ch] [&_p]:m-0 [&_p]:text-[var(--home-muted)] [&_p]:text-[1.08rem] [&_p]:font-800 [&_p]:leading-[1.8] max-[1120px]:pb-0 max-[760px]:[&_h1]:mt-7 max-[760px]:[&_h1]:text-[clamp(2.35rem,_13vw,_3.55rem)] max-[760px]:[&_p]:text-[1rem]"
        :class="{
          'is-english [.hero-copy&_h1]:text-[clamp(2rem,_3.2vw,_3.05rem)] [.hero-copy&_h1]:leading-[1.12]':
            locale === 'en-US',
        }"
      >
        <span
          class="resource-kicker inline-flex items-center justify-center gap-2 min-h-[32px] p-[7px_12px] [border:1px_solid_rgba(46,_125,_50,_0.16)] rounded-lg [background:var(--home-accent-soft)] text-[var(--home-accent)] text-[0.84rem] font-800"
        >
          <Icon icon="lucide:blocks" />
          {{ $t('main.homeHub.kicker') }}
        </span>
        <h1>{{ $t('main.headline') }}</h1>
        <p>{{ $t('main.homeHub.description') }}</p>

        <div
          class="hero-actions flex flex-wrap gap-3 mt-8 max-[760px]:grid-cols-[1fr] max-[760px]:grid"
        >
          <RouterLink
            to="/modpacks"
            class="hero-button inline-flex items-center justify-center gap-[9px] min-h-[46px] p-[11px_18px] [border:1px_solid_var(--home-border)] rounded-lg [background:var(--home-button-bg)] text-[var(--home-text)] font-inherit [font-size:inherit] [line-height:inherit] font-850 no-underline cursor-pointer [transition:transform_0.2s_ease,_border-color_0.2s_ease,_background-color_0.2s_ease] hover:[transform:translateY(-2px)] max-[760px]:w-full max-[760px]:min-h-[46px] motion-reduce:hover:[transform:none] hero-button-primary [.hero-button-primary&]:border-transparent [.hero-button-primary&]:[background:#2f8531] [.hero-button-primary&]:text-[#ffffff]"
          >
            <Icon icon="lucide:package-open" />
            {{ $t('main.homeHub.browseModpacks') }}
          </RouterLink>
          <RouterLink
            to="/map"
            class="hero-button inline-flex items-center justify-center gap-[9px] min-h-[46px] p-[11px_18px] [border:1px_solid_var(--home-border)] rounded-lg [background:var(--home-button-bg)] text-[var(--home-text)] font-inherit [font-size:inherit] [line-height:inherit] font-850 no-underline cursor-pointer [transition:transform_0.2s_ease,_border-color_0.2s_ease,_background-color_0.2s_ease] hover:[transform:translateY(-2px)] max-[760px]:w-full max-[760px]:min-h-[46px] motion-reduce:hover:[transform:none]"
          >
            <Icon icon="lucide:map" />
            {{ $t('main.homeHub.browseMaps') }}
          </RouterLink>
        </div>

        <ul
          class="hero-trust-list flex flex-wrap gap-[9px] m-[24px_0_0] p-0 [list-style:none] [&_li]:inline-flex [&_li]:items-center [&_li]:gap-[7px] [&_li]:min-h-[32px] [&_li]:p-[6px_10px] [&_li]:[border:1px_solid_var(--home-border)] [&_li]:rounded-lg [&_li]:[background:var(--home-accent-soft)] [&_li]:text-[var(--home-text)] [&_li]:text-[0.8rem] [&_li]:font-800 [&_li]:leading-[1.25] [&_svg]:flex-none [&_svg]:text-[var(--home-accent)] [&_svg]:text-[0.95rem] max-[760px]:grid max-[760px]:grid-cols-[repeat(auto-fit,_minmax(140px,_1fr))] max-[760px]:[&_li]:justify-center max-[760px]:[&_li]:min-w-0 max-[760px]:[&_li]:px-[7px] max-[760px]:[&_li]:text-center"
        >
          <li v-for="item in trustItems" :key="item.label">
            <Icon :icon="item.icon" />
            <span>{{ item.label }}</span>
          </li>
        </ul>
      </div>

      <div
        class="hero-feature relative w-full h-[clamp(330px,_31vw,_430px)] self-center max-[1120px]:max-w-[860px] max-[1120px]:m-[0_auto] max-[760px]:h-[auto] max-[760px]:min-h-[270px] max-[760px]:aspect-[1.18_/_1]"
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
            class="hero-main-card overflow-hidden [border:1px_solid_var(--home-border)] rounded-lg [background:var(--home-surface-solid)] relative w-full h-full min-w-0 text-[var(--home-text)] no-underline [&_img]:w-full [&_img]:h-full [&_img]:object-cover [&_img]:block [&_img]:[transition:filter_0.25s_ease] [.dark_&_img]:[filter:var(--content-image-filter)] [.dark_&:hover_img]:[filter:var(--content-image-hover-filter)] [.dark_&:focus-visible_img]:[filter:var(--content-image-hover-filter)] max-[760px]:rounded-lg flex flex-col flex flex-col"
          >
            <span class="hero-main-image image-loading-frame min-h-0 flex-1">
              <img
                :src="getResourceImage(heroCarouselItem, true)"
                :alt="getDisplayName(heroCarouselItem)"
                :loading="heroCarouselIndex === 0 ? 'eager' : 'lazy'"
                :fetchpriority="heroCarouselIndex === 0 ? 'high' : 'auto'"
                decoding="async"
              />
              <span
                class="hero-main-overlay absolute [inset:0] [background:linear-gradient(180deg,_transparent_24%,_rgba(0,_0,_0,_0.7)_100%)] z-1 z-1"
              ></span>
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
          class="hero-carousel-indicators absolute right-6 z-2 flex items-center gap-2 max-[760px]:right-4 max-[760px]:gap-[7px] [&_button]:size-2 [&_button]:p-0 [&_button]:border-0 [&_button]:rounded-full [&_button]:bg-white/48 [&_button]:shadow-[0_1px_4px_rgba(0,0,0,0.3)] [&_button]:cursor-pointer [&_button]:transition-[transform,background-color] [&_button]:duration-200 [&_button:hover]:bg-white [&_button:hover]:scale-[1.22] [&_button.active]:bg-white [&_button.active]:scale-[1.22] [&_.catalog-filters_button:focus-visible]:bg-white [&_.catalog-filters_button:focus-visible]:scale-[1.22] [&_.catalog-filters_button:focus-visible]:outline-2 [&_.catalog-filters_button:focus-visible]:outline-[var(--home-accent)] [&_.catalog-filters_button:focus-visible]:outline-offset-3 top-4 max-[760px]:top-3 top-4 max-[760px]:top-3"
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

      <div
        class="home-stats col-[1_/_-1] grid grid-cols-[repeat(5,_minmax(0,_1fr))] gap-[10px] pt-[18px] [border-top:1px_solid_var(--home-border)] max-[1120px]:grid-cols-[repeat(3,_minmax(0,_1fr))] max-[760px]:grid-cols-[1fr] max-[760px]:gap-[10px] max-[760px]:pt-[18px]"
        :aria-label="$t('main.homeHub.statsLabel')"
      >
        <article
          v-for="item in statItems"
          :key="item.label"
          class="stat-card flex items-center gap-3 min-w-0 min-h-[58px] p-[10px_14px] rounded-lg [background:rgba(46,_125,_50,_0.08)] [&_small]:text-[var(--home-muted)] [&_small]:block [&_small]:min-w-0 [&_small]:text-[0.8rem] [&_strong]:block [&_strong]:min-w-0 [&_strong]:mt-[2px] [&_strong]:text-[var(--home-accent)] [&_strong]:text-[1.05rem] [&_strong]:leading-[1.1] max-[760px]:min-h-[58px] max-[760px]:p-[10px_14px] max-[760px]:rounded-lg"
        >
          <span
            class="stat-icon grid place-items-center w-[34px] h-[34px] flex-none rounded-lg [background:rgba(46,_125,_50,_0.1)] text-[var(--home-accent)] text-[1.1rem] max-[760px]:w-[34px] max-[760px]:h-[34px]"
          >
            <Icon :icon="item.icon" />
          </span>
          <span>
            <small>{{ item.label }}</small>
            <strong>{{ item.value }}</strong>
          </span>
        </article>
      </div>
    </section>

    <section
      class="resource-layout w-[min(1320px,_calc(100%_-_40px))] m-[0_auto] grid grid-cols-[minmax(0,_1fr)_320px] gap-11 mt-[54px] max-[1120px]:grid-cols-[1fr] max-[760px]:w-[min(100%_-_20px,_1320px)]"
    >
      <div class="resource-main">
        <div
          class="section-title-row flex items-center justify-between gap-[18px] mb-7 max-[760px]:items-start max-[760px]:flex-col"
        >
          <div
            class="section-title [&_small]:text-[var(--home-muted)] flex items-center gap-[14px] [&_h2]:m-0 [&_h2]:text-[1.45rem] [&_h2]:leading-[1.15] max-[760px]:[&_h2]:text-[1.25rem]"
          >
            <span
              class="section-icon grid place-items-center w-[34px] h-[34px] flex-none rounded-lg [background:rgba(46,_125,_50,_0.1)] text-[var(--home-accent)] text-[1.1rem]"
            >
              <Icon icon="lucide:package" />
            </span>
            <span>
              <h2>{{ $t('navbar.modpack') }}</h2>
              <small>{{ $t('main.homeHub.modpackSectionDesc') }}</small>
            </span>
          </div>
        </div>

        <div
          class="resource-tabs [&_button]:inline-flex [&_button]:items-center [&_button]:justify-center [&_button]:gap-2 [&_button]:border-0 [&_button]:rounded-lg [&_button]:[background:transparent] [&_button]:text-[var(--home-text)] [&_button]:font-inherit [&_button]:[font-size:inherit] [&_button]:[line-height:inherit] [&_button]:font-850 [&_button]:cursor-pointer [&_button]:[transition:transform_0.2s_ease,_border-color_0.2s_ease,_background-color_0.2s_ease] grid grid-cols-[repeat(2,_minmax(0,_1fr))] min-h-[46px] mb-[30px] p-[5px] [border:1px_solid_var(--home-border)] rounded-lg [background:var(--home-tabs-bg)] [&_.active]:[background:var(--home-tabs-active-bg)] [&_.active]:text-[var(--home-accent)] [&_button:hover]:[transform:translateY(-2px)] [&_button:focus-visible]:[outline:2px_solid_var(--home-accent)] [&_button:focus-visible]:[outline-offset:2px] max-[760px]:grid-cols-[repeat(2,_minmax(0,_1fr))] max-[760px]:min-h-[42px] max-[760px]:mb-[22px] max-[760px]:p-1 max-[760px]:[&_button]:min-w-0 max-[760px]:[&_button]:gap-[6px] max-[760px]:[&_button]:p-[8px_6px] max-[760px]:[&_button]:text-[0.92rem] max-[760px]:[&_button]:leading-[1.2]"
          :aria-label="$t('main.homeHub.sortLabel')"
        >
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

        <div
          class="resource-grid grid grid-cols-[repeat(3,_minmax(0,_1fr))] gap-6 max-[1120px]:grid-cols-[repeat(2,_minmax(0,_1fr))] max-[760px]:grid-cols-[1fr]"
        >
          <RouterLink
            v-for="item in resourceCards"
            :key="item.link"
            :to="item.link"
            class="resource-card overflow-hidden [border:1px_solid_var(--home-border)] rounded-lg [background:var(--home-surface-solid)] flex min-w-0 min-h-[332px] p-[14px] text-[var(--home-text)] no-underline flex-col [transition:transform_0.2s_ease,_border-color_0.2s_ease,_background-color_0.2s_ease] [&_h3]:m-[12px_0_10px] [&_h3]:text-[1.15rem] [&_h3]:leading-[1.3] [&_p]:[display:-webkit-box] [&_p]:overflow-hidden [&_p]:min-h-[43px] [&_p]:m-[12px_0_18px] [&_p]:text-[var(--home-muted)] [&_p]:text-[0.9rem] [&_p]:font-650 [&_p]:leading-[1.6] [&_p]:[-webkit-box-orient:vertical] [&_p]:[line-clamp:2] [&_p]:[-webkit-line-clamp:2] hover:[transform:translateY(-2px)] motion-reduce:hover:[transform:none]"
          >
            <span class="image-loading-frame resource-image-loading-frame">
              <img
                v-lazy="item.icon || '/imgs/missing.png'"
                :alt="getDisplayName(item)"
                class="resource-img dark:[filter:var(--content-image-filter)] [.dark_.resource-card:hover_&]:[filter:var(--content-image-hover-filter)] [.dark_.resource-card:focus-visible_&]:[filter:var(--content-image-hover-filter)] w-full aspect-[2.45_/_1] rounded-lg object-cover [transition:filter_0.25s_ease]"
              />
            </span>
            <div
              class="resource-meta text-[var(--home-muted)] flex items-center justify-end gap-[10px] mt-[13px] text-[0.82rem] font-700 [&_span]:min-w-0 [&_span]:overflow-hidden [&_span]:text-ellipsis [&_span]:whitespace-nowrap max-[760px]:items-start max-[760px]:flex-col"
            >
              <span v-if="item.displayDate">
                {{ $t('pack.updateDate', { date: formatUpdateDate(item.displayDate, locale) }) }}
              </span>
            </div>
            <h3>{{ getDisplayName(item) }}</h3>
            <div class="resource-tags flex flex-wrap gap-2">
              <span
                v-if="item.versions?.loader"
                :class="[
                  'tag vm-home-tag',
                  'strong [.tag&]:[background:#2f8531] [.tag&]:text-[#ffffff] [.tag&.loader-fabric]:[background:var(--loader-fabric-bg)] [.tag&.loader-fabric]:text-[var(--loader-fabric-color)] [.tag&.loader-forge]:[background:var(--loader-forge-bg)] [.tag&.loader-forge]:text-[var(--loader-forge-color)] [.tag&.loader-neoforge]:[background:var(--loader-neoforge-bg)] [.tag&.loader-neoforge]:text-[var(--loader-neoforge-color)] [.tag&.loader-vanilla]:[background:var(--loader-vanilla-bg)] [.tag&.loader-vanilla]:text-[var(--loader-vanilla-color)]',
                  getLoaderClass(item.versions.loader),
                ]"
              >
                <span
                  v-if="getLoaderIcon(item.versions.loader)"
                  class="tag-loader-icon w-[13px] h-[13px] bg-[currentColor] [-webkit-mask-position:center] [-webkit-mask-repeat:no-repeat] [-webkit-mask-size:contain] [mask-position:center] [mask-repeat:no-repeat] [mask-size:contain]"
                  :style="{
                    WebkitMaskImage: `url(${getLoaderIcon(item.versions.loader)})`,
                    maskImage: `url(${getLoaderIcon(item.versions.loader)})`,
                  }"
                  aria-hidden="true"
                />
                <Icon v-else icon="lucide:layers" />
                {{ getLoaderText(item.versions.loader) }}
              </span>
              <span v-if="item.versions?.mc" class="tag vm-home-tag">{{ item.versions.mc }}</span>
              <span
                v-if="item.status?.type"
                :class="['tag vm-home-tag', 'status-tag', `status-${item.status.type}`]"
                :title="getStatusDescription(item.status.type)"
              >
                {{ getStatusText(item.status.type) }}
              </span>
            </div>
            <p>{{ item.description || $t('main.emptyDescription') }}</p>
            <div
              class="resource-footer flex items-center justify-end gap-[10px] mt-auto text-[0.84rem] font-850 [&_span]:inline-flex [&_span]:items-center [&_span]:gap-[6px] [&_strong]:inline-flex [&_strong]:items-center [&_strong]:gap-[6px] [&_strong]:text-[var(--home-text)] max-[760px]:items-start max-[760px]:flex-col"
            >
              <strong>
                {{ $t('main.homeHub.viewResource') }}
                <Icon icon="lucide:chevron-right" />
              </strong>
            </div>
          </RouterLink>
        </div>
      </div>

      <aside
        class="resource-sidebar grid [align-content:start] gap-6 max-[1120px]:grid-cols-[repeat(3,_minmax(0,_1fr))] max-[760px]:grid-cols-[1fr]"
      >
        <section class="sidebar-panel vm-home-sidebar-panel">
          <h2>{{ $t('main.homeHub.siteSearch') }}</h2>
          <p>{{ $t('main.homeHub.searchDesc') }}</p>
          <button
            class="home-search-field flex items-center justify-between w-full min-h-[44px] p-[0_12px] [border:1px_solid_var(--home-border)] rounded-lg [background:transparent] text-[var(--home-muted)] font-inherit [font-size:inherit] [font-weight:inherit] [line-height:inherit] cursor-pointer"
            type="button"
            @click="isSearchOpen = true"
          >
            <span>{{ $t('search.placeholder') }}</span>
            <Icon icon="lucide:search" />
          </button>
        </section>

        <section class="sidebar-panel vm-home-sidebar-panel guide-panel grid gap-[14px]">
          <h2>{{ $t('main.homeHub.guideTitle') }}</h2>
          <RouterLink
            v-for="item in guideLinks"
            :key="item.link"
            :to="item.link"
            class="guide-link [&_small]:text-[var(--home-muted)] [&_small]:block [&_small]:mt-1 [&_small]:text-[0.82rem] [&_small]:leading-[1.45] [&_small]:[overflow-wrap:anywhere] flex items-start gap-3 min-w-0 p-3 rounded-lg [background:rgba(46,_125,_50,_0.08)] text-[var(--home-text)] no-underline [transition:transform_0.2s_ease,_border-color_0.2s_ease,_background-color_0.2s_ease] [&_>_span:last-child]:min-w-0 [&_strong]:block hover:[transform:translateY(-2px)] motion-reduce:hover:[transform:none]"
          >
            <span
              class="guide-icon grid place-items-center w-[34px] h-[34px] flex-none rounded-lg [background:rgba(46,_125,_50,_0.1)] text-[var(--home-accent)] text-[1.1rem]"
            >
              <Icon :icon="item.icon" />
            </span>
            <span>
              <strong>{{ item.title }}</strong>
              <small>{{ item.desc }}</small>
            </span>
          </RouterLink>
        </section>

        <section
          class="sidebar-panel vm-home-sidebar-panel compact-list [.dark_&_img]:[filter:var(--content-image-filter)] [.dark_&_a:hover_img]:[filter:var(--content-image-hover-filter)] [.dark_&_a:focus-visible_img]:[filter:var(--content-image-hover-filter)] grid gap-3 [&_a]:flex [&_a]:items-center [&_a]:gap-[10px] [&_a]:text-[var(--home-text)] [&_a]:font-800 [&_a]:no-underline [&_a]:[transition:transform_0.2s_ease,_border-color_0.2s_ease,_background-color_0.2s_ease] [&_img]:w-11 [&_img]:h-11 [&_img]:rounded-lg [&_img]:object-cover [&_img]:[transition:filter_0.25s_ease] [&_a:hover]:[transform:translateY(-2px)]"
        >
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
import { Icon } from '@/icons'
import { useSiteContent } from '@/content/store'
import { getLoaderClass, getLoaderIcon } from '@/data/loaderIcons'
import { formatUpdateDate } from '@/utils/dateFormat'
import { getLocalizedResourceName } from '@/utils/resourceDisplay'
import type { ResourceItem, ResourceStatusType } from '@/types/resource'

import SearchOverlay from '@/components/NavBar/SearchOverlay.vue'

const { locale, t } = useI18n()
const { home } = useSiteContent()
const isSearchOpen = ref(false)
const activeResourceTab = ref<'hot' | 'updated'>('hot')
const heroCarouselIndex = ref(0)
const isCarouselPaused = ref(false)
let carouselTimer: ReturnType<typeof setInterval> | undefined

const featuredMaps = computed(() => home.value?.maps || [])
const heroCarouselItems = computed(() => home.value?.carousel || [])
const heroCarouselItem = computed(() => heroCarouselItems.value[heroCarouselIndex.value])
const resourceCards = computed(() => home.value?.[activeResourceTab.value] || [])
const statItems = computed(() => [
  {
    label: t('main.homeHub.totalResources'),
    value: t('main.homeHub.countValue', {
      count: (home.value?.modpackCount || 0) + (home.value?.mapCount || 0),
    }),
    icon: 'lucide:boxes',
  },
  {
    label: t('main.homeHub.totalModpacks'),
    value: t('main.homeHub.countValue', { count: home.value?.modpackCount || 0 }),
    icon: 'lucide:package',
  },
  {
    label: t('main.homeHub.mapTranslations'),
    value: t('main.homeHub.countValue', { count: home.value?.mapCount || 0 }),
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
