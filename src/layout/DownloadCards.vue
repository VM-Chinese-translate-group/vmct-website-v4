<template>
  <div
    v-if="mods"
    class="DownloadCards [.DownloadCards&]:[min-height:100vh] [.DownloadCards&]:[background:var(--bg-off-white)]"
  >
    <div
      class="catalog-shell [.catalog-shell&]:grid [.catalog-shell&]:[grid-template-columns:260px_minmax(0,_1fr)] [.catalog-shell&]:[gap:20px] [.catalog-shell&]:[max-width:1480px] [.catalog-shell&]:[margin:0_auto] [.catalog-shell&]:[padding:24px_20px] max-[900px]:[.catalog-shell&]:[grid-template-columns:1fr] max-[900px]:[.catalog-shell&]:[padding:16px] max-[560px]:[.catalog-shell&]:[padding:12px]"
    >
      <button
        class="filter-backdrop [.filter-backdrop&]:hidden max-[900px]:[.filter-backdrop&]:fixed max-[900px]:[.filter-backdrop&]:[inset:0] max-[900px]:[.filter-backdrop&]:[z-index:1090] max-[900px]:[.filter-backdrop&]:block max-[900px]:[.filter-backdrop&]:pointer-events-none max-[900px]:[.filter-backdrop&]:cursor-pointer max-[900px]:[.filter-backdrop&]:[background:rgba(17,_24,_39,_0)] max-[900px]:[.filter-backdrop&]:[border:0] max-[900px]:[.filter-backdrop&]:[opacity:0] max-[900px]:[.filter-backdrop&]:[transition:opacity_0.2s_ease,_background-color_0.2s_ease] max-[900px]:[.filter-backdrop&.visible]:[pointer-events:auto] max-[900px]:[.filter-backdrop&.visible]:[background:rgba(17,_24,_39,_0.38)] max-[900px]:[.filter-backdrop&.visible]:[opacity:1]"
        :class="{ visible: filterDrawerOpen }"
        type="button"
        :aria-label="$t('DownloadCards.filters')"
        @click="closeFilterDrawer"
      />

      <aside
        class="filters-panel [.filters-panel&]:sticky [.filters-panel&]:[top:88px] [.filters-panel&]:[align-self:start] [.filters-panel&]:flex [.filters-panel&]:flex-col [.filters-panel&]:[gap:12px] max-[900px]:[.filters-panel&]:fixed max-[900px]:[.filters-panel&]:[inset:0_auto_auto_0] max-[900px]:[.filters-panel&]:[z-index:1100] max-[900px]:[.filters-panel&]:[width:min(88vw,_360px)] max-[900px]:[.filters-panel&]:[max-width:100%] max-[900px]:[.filters-panel&]:[height:100dvh] max-[900px]:[.filters-panel&]:[max-height:100dvh] max-[900px]:[.filters-panel&]:box-border max-[900px]:[.filters-panel&]:[padding:22px_18px_28px] max-[900px]:[.filters-panel&]:overflow-y-auto max-[900px]:[.filters-panel&]:[-webkit-overflow-scrolling:touch] max-[900px]:[.filters-panel&]:[touch-action:pan-y] max-[900px]:[.filters-panel&]:[background:var(--bg-alt)] max-[900px]:[.filters-panel&]:[border-right:1px_solid_var(--switcher-border)] max-[900px]:[.filters-panel&]:[box-shadow:22px_0_48px_rgba(0,_0,_0,_0.16)] max-[900px]:[.filters-panel&]:[transform:translateX(-105%)] max-[900px]:[.filters-panel&]:[transition:transform_0.22s_ease] max-[900px]:[.filters-panel&]:[overscroll-behavior:contain] max-[900px]:[.filters-panel&]:[overscroll-behavior-y:contain] max-[900px]:[.filters-panel&.open]:[transform:translateX(0)] max-[900px]:[.dark_.filters-panel&]:[background:#18191e] max-[900px]:[.dark_.filters-panel&]:[border-color:rgba(255,_255,_255,_0.08)] max-[900px]:[.dark_.filters-panel&]:[box-shadow:22px_0_48px_rgba(0,_0,_0,_0.42)]"
        :class="{ open: filterDrawerOpen }"
        :aria-label="$t('DownloadCards.filters')"
      >
        <div
          class="filters-drawer-header [.filters-drawer-header&]:hidden max-[900px]:[.filters-drawer-header&]:flex max-[900px]:[.filters-drawer-header&]:items-center max-[900px]:[.filters-drawer-header&]:justify-between max-[900px]:[.filters-drawer-header&]:[gap:16px] max-[900px]:[.filters-drawer-header&]:[padding:0_0_18px] max-[900px]:[.filters-drawer-header&]:[margin-bottom:6px] max-[900px]:[.filters-drawer-header&]:[border-bottom:1px_solid_var(--switcher-border)] max-[900px]:[.filters-drawer-header&_h2]:[margin:0] max-[900px]:[.filters-drawer-header&_h2]:[color:var(--text-1)] max-[900px]:[.filters-drawer-header&_h2]:[font-size:1.2rem] max-[900px]:[.filters-drawer-header&_h2]:[line-height:1.2]"
        >
          <h2>{{ $t('DownloadCards.filters') }}</h2>
          <button
            type="button"
            class="filters-close max-[900px]:[.filters-close&]:inline-flex max-[900px]:[.filters-close&]:items-center max-[900px]:[.filters-close&]:justify-center max-[900px]:[.filters-close&]:[flex:0_0_auto] max-[900px]:[.filters-close&]:[width:42px] max-[900px]:[.filters-close&]:[height:42px] max-[900px]:[.filters-close&]:[color:var(--text-1)] max-[900px]:[.filters-close&]:cursor-pointer max-[900px]:[.filters-close&]:[background:var(--bg-soft)] max-[900px]:[.filters-close&]:[border:1px_solid_var(--switcher-border)] max-[900px]:[.filters-close&]:[border-radius:50%] max-[900px]:[.filters-close&]:[box-shadow:var(--vp-shadow-1)] max-[900px]:[.filters-close&_svg]:[width:22px] max-[900px]:[.filters-close&_svg]:[height:22px] max-[900px]:[.dark_.filters-close&]:[background:#222329] max-[900px]:[.dark_.filters-close&]:[border-color:rgba(255,_255,_255,_0.08)]"
            :aria-label="$t('DownloadCards.filters')"
            @click="closeFilterDrawer"
          >
            <Icon icon="lucide:x" />
          </button>
        </div>

        <section class="filter-group catalog-filter-group">
          <button
            class="filter-group-title catalog-filter-group-title"
            type="button"
            @click="toggleGroup('mc')"
          >
            <span>{{ $t('DownloadCards.minecraftVersion') }}</span>
            <Icon :icon="openGroups.mc ? 'lucide:chevron-up' : 'lucide:chevron-down'" />
          </button>
          <div v-show="openGroups.mc" class="filter-options catalog-filter-options">
            <button
              class="catalog-filter-option [.mc-filter-option&]:[padding-block:6px]"
              v-for="option in visibleMcVersionOptions"
              :key="option.value"
              type="button"
              :class="[
                'filter-option',
                'mc-filter-option',
                { active: selectedMcVersions.includes(option.value) },
              ]"
              :title="getStatusDescription(option.value)"
              @click="toggleFilter(selectedMcVersions, option.value)"
            >
              <span>{{ option.label }}</span>
              <span class="filter-count catalog-filter-count">{{ option.count }}</span>
            </button>
            <button
              v-if="mcVersionOptions.length > COLLAPSED_OPTION_LIMIT"
              class="filter-more [.filter-more&]:inline-flex [.filter-more&]:items-center [.filter-more&]:[gap:6px] [.filter-more&]:[width:fit-content] [.filter-more&]:[padding:7px_10px] [.filter-more&]:[color:var(--text-medium)] [.filter-more&]:font-inherit [.filter-more&]:[font-size:14px] [.filter-more&]:[font-weight:inherit] [.filter-more&]:[line-height:inherit] [.filter-more&]:cursor-pointer [.filter-more&]:[background:transparent] [.filter-more&]:[border:0] [.filter-more&]:[border-radius:8px] [.filter-more&:hover]:[color:var(--text-1)] [.filter-more&:hover]:[background:var(--switcher-item-hover)]"
              type="button"
              @click="showAllMcVersions = !showAllMcVersions"
            >
              <Icon :icon="showAllMcVersions ? 'lucide:chevron-up' : 'lucide:chevron-down'" />
              <span>
                {{
                  showAllMcVersions ? $t('DownloadCards.showLess') : $t('DownloadCards.showMore')
                }}
              </span>
            </button>
          </div>
        </section>

        <section v-if="showLoaderFilter" class="filter-group catalog-filter-group">
          <button
            class="filter-group-title catalog-filter-group-title"
            type="button"
            @click="toggleGroup('loader')"
          >
            <span>{{ $t('DownloadCards.loader') }}</span>
            <Icon :icon="openGroups.loader ? 'lucide:chevron-up' : 'lucide:chevron-down'" />
          </button>
          <div v-show="openGroups.loader" class="filter-options catalog-filter-options">
            <button
              class="catalog-filter-option"
              v-for="option in loaderOptions"
              :key="option.value"
              type="button"
              :class="[
                'filter-option',
                getLoaderClass(option.value),
                { active: selectedLoaders.includes(option.value) },
              ]"
              @click="toggleFilter(selectedLoaders, option.value)"
            >
              <img
                v-if="getLoaderIcon(option.value)"
                :src="getLoaderIcon(option.value)"
                class="filter-loader-icon [.filter-loader-icon&]:[width:16px] [.filter-loader-icon&]:[height:16px] [.filter-loader-icon&]:object-contain"
                :alt="option.label"
              />
              <Icon v-else icon="lucide:layers" />
              <span>{{ option.label }}</span>
              <span class="filter-count catalog-filter-count">{{ option.count }}</span>
            </button>
          </div>
        </section>

        <section class="filter-group catalog-filter-group">
          <button
            class="filter-group-title catalog-filter-group-title"
            type="button"
            @click="toggleGroup('status')"
          >
            <span>{{ $t('DownloadCards.status') }}</span>
            <Icon :icon="openGroups.status ? 'lucide:chevron-up' : 'lucide:chevron-down'" />
          </button>
          <div v-show="openGroups.status" class="filter-options catalog-filter-options">
            <button
              class="catalog-filter-option"
              v-for="option in statusOptions"
              :key="option.value"
              type="button"
              :class="[
                'filter-option',
                `status-${option.value}`,
                { active: selectedStatuses.includes(option.value) },
              ]"
              @click="toggleFilter(selectedStatuses, option.value)"
            >
              <Icon :icon="getStatusIcon(option.value)" />
              <span>{{ option.label }}</span>
              <span class="filter-count catalog-filter-count">{{ option.count }}</span>
            </button>
          </div>
        </section>
      </aside>

      <div class="catalog-main [.catalog-main&]:min-w-0">
        <div
          class="controls-bar [.controls-bar&]:flex [.controls-bar&]:items-center [.controls-bar&]:justify-start [.controls-bar&]:flex-wrap [.controls-bar&]:box-border [.controls-bar&]:[margin:0_0_16px] [.controls-bar&]:[padding:12px] [.controls-bar&]:[gap:16px] [.controls-bar&]:[background:var(--bg-soft)] [.controls-bar&]:[border:1px_solid_var(--switcher-border)] [.controls-bar&]:[border-radius:8px] [.dark_.controls-bar&]:[background:#222329] [.dark_.controls-bar&]:[border-color:rgba(255,_255,_255,_0.08)] [.dark_.controls-bar&]:[box-shadow:0_12px_28px_rgba(0,_0,_0,_0.2)] max-[900px]:[.controls-bar&]:grid max-[900px]:[.controls-bar&]:[grid-template-columns:repeat(2,_minmax(0,_1fr))] max-[900px]:[.controls-bar&]:[gap:12px] max-[768px]:[.controls-bar&]:[grid-template-columns:minmax(0,_1.4fr)_minmax(116px,_0.6fr)] max-[768px]:[.controls-bar&]:[align-items:end] max-[560px]:[.controls-bar&]:[gap:10px] max-[560px]:[.controls-bar&]:[padding:10px]"
        >
          <div
            class="search-field [.search-field&]:relative [.search-field&]:[flex:1_1_320px] [.search-field&]:max-w-none [.search-field&]:flex [.search-field&]:items-center [.search-field&]:min-w-0 max-[900px]:[.search-field&]:[grid-column:1_/_-1] max-[900px]:[.search-field&]:[order:-1] max-[900px]:[.search-field&]:max-w-none max-[768px]:[.search-field&]:hidden"
          >
            <Icon
              icon="lucide:search"
              class="search-field-icon [.search-field-icon&]:absolute [.search-field-icon&]:[left:10px] [.search-field-icon&]:[font-size:1.1rem] [.search-field-icon&]:[color:var(--text-muted)] [.search-field-icon&]:pointer-events-none [.search-field-icon&]:[z-index:1]"
            />
            <input
              v-model="searchQuery"
              @input="handleSearchInput"
              class="search-input [.search-input&]:box-border [.search-input&]:w-full [.search-input&]:[height:38px] [.search-input&]:[padding:8px_32px_8px_34px] [.search-input&]:[font-size:14px] [.search-input&]:[line-height:1.2] [.search-input&]:[color:var(--text-1)] [.search-input&]:[background:var(--bg-alt)] [.search-input&]:[border:1px_solid_var(--switcher-border)] [.search-input&]:[border-radius:8px] [.search-input&]:[transition:border-color_0.2s_ease,_box-shadow_0.2s_ease] [.dark_.search-input&]:[background:#18191e] [.dark_.search-input&]:[border-color:#34353d] [.search-input&:focus]:[outline:none] [.search-input&:focus]:[border-color:var(--btn-primary-bg)] [.search-input&:focus]:[box-shadow:0_0_0_2px_var(--nav-shadow)] [.search-input&::placeholder]:[color:var(--text-muted)]"
              :placeholder="$t('DownloadCards.searchPlaceholder')"
            />
            <button
              v-if="searchQuery"
              @click="clearSearch"
              class="search-clear [.search-clear&]:absolute [.search-clear&]:[right:8px] [.search-clear&]:flex [.search-clear&]:items-center [.search-clear&]:justify-center [.search-clear&]:[width:20px] [.search-clear&]:[height:20px] [.search-clear&]:[padding:0] [.search-clear&]:[color:var(--text-light)] [.search-clear&]:cursor-pointer [.search-clear&]:[background:none] [.search-clear&]:[border:none] [.search-clear&]:[border-radius:8px] [.search-clear&]:[transition:all_0.2s_ease] [.search-clear&:hover]:[color:var(--text-1)] [.search-clear&:hover]:[background:var(--switcher-item-hover)]"
              type="button"
            >
              <Icon icon="lucide:x" />
            </button>
          </div>

          <div
            class="select-field [.select-field&]:flex [.select-field&]:items-center [.select-field&]:box-border [.select-field&]:[gap:8px] [.select-field&]:[flex-shrink:0] [.select-field&]:[font-size:14px] [.select-field&]:[color:var(--text-2)] [.select-field&_span]:[flex:0_0_auto] max-[900px]:[.select-field&]:justify-between max-[900px]:[.select-field&]:w-full max-[900px]:[.select-field&]:min-w-0 max-[900px]:[.select-field&]:[min-height:38px] max-[900px]:[.select-field&]:[padding:0] max-[900px]:[.select-field&]:[gap:10px] max-[900px]:[.select-field&]:[background:transparent] max-[900px]:[.select-field&]:[border:0] max-[900px]:[.select-field&_span]:overflow-hidden max-[900px]:[.select-field&_span]:text-ellipsis max-[900px]:[.select-field&_span]:whitespace-nowrap max-[900px]:[.select-field&_.catalog-select]:[flex:1_1_auto] max-[900px]:[.select-field&_.catalog-select]:w-full max-[900px]:[.select-field&_.catalog-select]:min-w-0 max-[900px]:[.select-field&_.catalog-select]:max-w-none max-[900px]:[.select-field&_.catalog-select]:[--select-width:100%] max-[768px]:[.select-field&]:flex max-[768px]:[.select-field&]:items-stretch max-[768px]:[.select-field&]:flex-col max-[768px]:[.select-field&]:[gap:6px] max-[768px]:[.select-field&_>_span]:w-full max-[768px]:[.select-field&_>_span]:[overflow:visible] max-[768px]:[.select-field&_>_span]:[color:var(--text-2)] max-[768px]:[.select-field&_>_span]:[font-size:12px] max-[768px]:[.select-field&_>_span]:[line-height:1.2] max-[768px]:[.select-field&_>_span]:[text-overflow:clip]"
          >
            <span>{{ $t('DownloadCards.sortBy') }}</span>
            <SelectMenu
              v-model="sortKey"
              class="catalog-select sort-select [.sort-select&]:[--select-width:220px] [.sort-select&]:[--select-menu-min-width:220px]"
              :ariaLabel="$t('DownloadCards.sortBy')"
              :options="sortOptions"
            />
          </div>

          <div
            class="select-field [.select-field&]:flex [.select-field&]:items-center [.select-field&]:box-border [.select-field&]:[gap:8px] [.select-field&]:[flex-shrink:0] [.select-field&]:[font-size:14px] [.select-field&]:[color:var(--text-2)] [.select-field&_span]:[flex:0_0_auto] max-[900px]:[.select-field&]:justify-between max-[900px]:[.select-field&]:w-full max-[900px]:[.select-field&]:min-w-0 max-[900px]:[.select-field&]:[min-height:38px] max-[900px]:[.select-field&]:[padding:0] max-[900px]:[.select-field&]:[gap:10px] max-[900px]:[.select-field&]:[background:transparent] max-[900px]:[.select-field&]:[border:0] max-[900px]:[.select-field&_span]:overflow-hidden max-[900px]:[.select-field&_span]:text-ellipsis max-[900px]:[.select-field&_span]:whitespace-nowrap max-[900px]:[.select-field&_.catalog-select]:[flex:1_1_auto] max-[900px]:[.select-field&_.catalog-select]:w-full max-[900px]:[.select-field&_.catalog-select]:min-w-0 max-[900px]:[.select-field&_.catalog-select]:max-w-none max-[900px]:[.select-field&_.catalog-select]:[--select-width:100%] max-[768px]:[.select-field&]:flex max-[768px]:[.select-field&]:items-stretch max-[768px]:[.select-field&]:flex-col max-[768px]:[.select-field&]:[gap:6px] max-[768px]:[.select-field&_>_span]:w-full max-[768px]:[.select-field&_>_span]:[overflow:visible] max-[768px]:[.select-field&_>_span]:[color:var(--text-2)] max-[768px]:[.select-field&_>_span]:[font-size:12px] max-[768px]:[.select-field&_>_span]:[line-height:1.2] max-[768px]:[.select-field&_>_span]:[text-overflow:clip]"
          >
            <span>{{ $t('DownloadCards.itemsPerPage') }}</span>
            <SelectMenu
              v-model="itemsPerPage"
              class="catalog-select page-count-select [.page-count-select&]:[--select-width:76px] [.page-count-select&]:[--select-menu-min-width:88px]"
              :ariaLabel="$t('DownloadCards.itemsPerPage')"
              :options="pageSizeOptions"
            />
          </div>

          <button
            class="mobile-filter-toggle [.mobile-filter-toggle&]:hidden max-[900px]:[.mobile-filter-toggle&]:inline-flex max-[900px]:[.mobile-filter-toggle&]:items-center max-[900px]:[.mobile-filter-toggle&]:justify-center max-[900px]:[.mobile-filter-toggle&]:box-border max-[900px]:[.mobile-filter-toggle&]:w-full max-[900px]:[.mobile-filter-toggle&]:min-w-0 max-[900px]:[.mobile-filter-toggle&]:[height:46px] max-[900px]:[.mobile-filter-toggle&]:[padding:0_12px] max-[900px]:[.mobile-filter-toggle&]:[gap:8px] max-[900px]:[.mobile-filter-toggle&]:[color:var(--text-1)] max-[900px]:[.mobile-filter-toggle&]:font-inherit max-[900px]:[.mobile-filter-toggle&]:[font-size:inherit] max-[900px]:[.mobile-filter-toggle&]:[font-weight:700] max-[900px]:[.mobile-filter-toggle&]:[line-height:inherit] max-[900px]:[.mobile-filter-toggle&]:cursor-pointer max-[900px]:[.mobile-filter-toggle&]:[background:var(--bg-alt)] max-[900px]:[.mobile-filter-toggle&]:[border:1px_solid_var(--switcher-border)] max-[900px]:[.mobile-filter-toggle&]:[border-radius:8px] max-[900px]:[.mobile-filter-toggle&_svg]:[width:18px] max-[900px]:[.mobile-filter-toggle&_svg]:[height:18px] max-[900px]:[.mobile-filter-toggle&_svg]:[flex:0_0_auto] max-[900px]:[.mobile-filter-toggle&_span:not(.filter-active-count)]:overflow-hidden max-[900px]:[.mobile-filter-toggle&_span:not(.filter-active-count)]:text-ellipsis max-[900px]:[.mobile-filter-toggle&_span:not(.filter-active-count)]:whitespace-nowrap max-[768px]:[.mobile-filter-toggle&]:[height:40px]"
            type="button"
            @click="openFilterDrawer"
          >
            <Icon icon="lucide:list-filter" />
            <span>{{ $t('DownloadCards.filters') }}</span>
            <span
              v-if="activeFilterCount"
              class="filter-active-count max-[900px]:[.filter-active-count&]:inline-flex max-[900px]:[.filter-active-count&]:items-center max-[900px]:[.filter-active-count&]:justify-center max-[900px]:[.filter-active-count&]:[min-width:20px] max-[900px]:[.filter-active-count&]:[height:20px] max-[900px]:[.filter-active-count&]:[padding:0_6px] max-[900px]:[.filter-active-count&]:[color:#fff] max-[900px]:[.filter-active-count&]:[font-size:12px] max-[900px]:[.filter-active-count&]:[line-height:1] max-[900px]:[.filter-active-count&]:[background:var(--btn-primary-bg)] max-[900px]:[.filter-active-count&]:[border-radius:999px]"
            >
              {{ activeFilterCount }}
            </span>
          </button>

          <div
            class="results-info [.results-info&]:[flex-shrink:0] [.results-info&]:[font-size:14px] [.results-info&]:[color:var(--text-2)] max-[900px]:[.results-info&]:flex max-[900px]:[.results-info&]:items-center max-[900px]:[.results-info&]:justify-center max-[900px]:[.results-info&]:box-border max-[900px]:[.results-info&]:min-w-0 max-[900px]:[.results-info&]:[min-height:46px] max-[900px]:[.results-info&]:text-center max-[768px]:[.results-info&]:[min-height:40px] max-[768px]:[.results-info&]:justify-end max-[768px]:[.results-info&]:[font-size:12px] max-[768px]:[.results-info&]:[line-height:1.35] max-[768px]:[.results-info&]:text-right"
          >
            {{
              $t('DownloadCards.resultsInfo', {
                total: filteredMods.length,
                start: filteredMods.length > 0 ? startIndex + 1 : 0,
                end: endIndex,
              })
            }}
          </div>
        </div>

        <div
          class="container [.container&]:[max-width:1200px] [.container&]:[margin:0_auto] [.container&]:[padding:24px_0] max-[560px]:[.container&]:[padding:16px_0]"
        >
          <div
            v-if="displayMods.length"
            class="grid-layout [.grid-layout&]:grid [.grid-layout&]:[grid-template-columns:repeat(2,_minmax(0,_1fr))] [.grid-layout&]:[gap:20px] [.grid-layout&_>_.card-item]:w-full max-[768px]:[.grid-layout&]:[grid-template-columns:1fr]"
          >
            <RouterLink
              v-for="mod in displayMods"
              :key="mod.name"
              :to="mod.link"
              class="card-item [.card-item&]:flex [.card-item&]:min-w-0 [.card-item&]:[color:inherit] [.card-item&]:[text-decoration:none]! [.card-item&:hover]:[text-decoration:none]! [.card-item&:focus-visible]:[text-decoration:none]! [.dark_.card-item&:hover_.card-icon_img]:[filter:var(--content-image-hover-filter)] [.dark_.card-item&:focus-visible_.card-icon_img]:[filter:var(--content-image-hover-filter)] max-[768px]:[.card-item&]:min-w-0"
            >
              <div
                class="card-box [.card-box&]:flex [.card-box&]:flex-row [.card-box&]:box-border [.card-box&]:w-full [.card-box&]:min-w-0 [.card-box&]:[min-height:150px] [.card-box&]:[padding:20px] [.card-box&]:[background-color:var(--bg-soft)] [.card-box&]:[border:1px_solid_var(--switcher-border)] [.card-box&]:[border-radius:8px] [.card-box&]:[transition:transform_0.3s_ease,_box-shadow_0.3s_ease,_border-color_0.3s_ease] [.dark_.card-box&]:[background:#222329] [.dark_.card-box&]:[border-color:rgba(255,_255,_255,_0.08)] [.dark_.card-box&]:[box-shadow:0_10px_26px_rgba(0,_0,_0,_0.18),_inset_0_1px_0_rgba(255,_255,_255,_0.025)] [.card-box&:hover]:[border-color:var(--btn-primary-bg)] [.card-box&:hover]:[box-shadow:var(--card-shadow)] [.card-box&:hover]:[transform:translateY(-2px)] [.dark_.card-box&:hover]:[background:#292a31] [.dark_.card-box&:hover]:[border-color:var(--info-1)] [.dark_.card-box&:hover]:[box-shadow:0_16px_34px_rgba(0,_0,_0,_0.26)] max-[768px]:[.card-box&]:[padding:16px] max-[560px]:[.card-box&]:[min-height:0] max-[560px]:[.card-box&]:[padding:12px]"
              >
                <figure
                  class="card-icon image-loading-frame [.card-icon&]:[flex-shrink:0] [.card-icon&]:[width:100px] [.card-icon&]:[height:100px] [.card-icon&]:[margin:0] [.card-icon&]:overflow-hidden [.card-icon&]:[background:var(--bg-alt)] [.card-icon&]:[border-radius:8px] [.dark_.card-icon&]:[background:#18191e] [.dark_.card-icon&]:[box-shadow:0_0_0_1px_rgba(255,_255,_255,_0.06)] [.card-icon&_img]:w-full [.card-icon&_img]:[height:100%] [.card-icon&_img]:object-cover [.card-icon&_img]:[transition:filter_0.25s_ease] [.dark_.card-icon&_img]:[filter:var(--content-image-filter)] max-[560px]:[.card-icon&]:[width:76px] max-[560px]:[.card-icon&]:[height:76px]"
                >
                  <img v-lazy="mod.icon" :alt="mod.name" />
                </figure>

                <div
                  class="card-content [.card-content&]:flex [.card-content&]:[flex:1] [.card-content&]:flex-col [.card-content&]:justify-between [.card-content&]:[margin-left:20px] [.card-content&]:min-w-0 max-[560px]:[.card-content&]:[margin-left:12px]"
                >
                  <div class="card-top">
                    <div class="card-header">
                      <span
                        class="card-name [.card-name&]:[font-size:1.125rem] [.card-name&]:[font-weight:700] [.card-name&]:[color:var(--text-1)] [.card-name&]:overflow-hidden [.card-name&]:text-ellipsis [.card-name&]:whitespace-nowrap max-[560px]:[.card-name&]:[font-size:1rem]"
                      >
                        {{ mod.displayName }}
                      </span>
                    </div>

                    <p
                      class="card-desc [.card-desc&]:[display:-webkit-box] [.card-desc&]:[margin:8px_0] [.card-desc&]:overflow-hidden [.card-desc&]:[font-size:0.95rem] [.card-desc&]:[line-height:1.5] [.card-desc&]:[color:var(--text-medium)] [.card-desc&]:[-webkit-box-orient:vertical] [.card-desc&]:[-webkit-line-clamp:2] [.card-desc&]:[line-clamp:2] max-[560px]:[.card-desc&]:[margin:4px_0] max-[560px]:[.card-desc&]:[font-size:0.88rem] max-[560px]:[.card-desc&]:[line-height:1.4]"
                    >
                      {{ mod.displayDesc }}
                    </p>
                  </div>

                  <div
                    class="card-footer [.card-footer&]:flex [.card-footer&]:justify-between [.card-footer&]:[align-items:flex-end] [.card-footer&]:[margin-top:12px] [.card-footer&]:[gap:12px] max-[768px]:[.card-footer&]:flex-col max-[768px]:[.card-footer&]:items-start"
                  >
                    <div
                      class="tag-group [.tag-group&]:flex [.tag-group&]:[gap:6px] [.tag-group&]:flex-wrap"
                    >
                      <span
                        class="[.status-badge&]:[padding:2px_8px] [.status-badge&]:[border-radius:8px] [.status-badge&]:[font-size:12px] [.status-badge&]:[font-weight:bold] [.status-badge&]:[color:#fff] [.status-badge&.maintaining]:[background-color:#007bff] [.status-badge&.translating]:[background-color:#b45309] [.status-badge&.stopped]:[border:1px_solid_var(--status-paused-border)] [.status-badge&.stopped]:[background-color:var(--status-paused-bg)] [.status-badge&.stopped]:[color:var(--status-paused-color)] [.dark_.status-badge&.maintaining]:[background-color:#338cff] [.dark_.status-badge&.maintaining]:[color:#fafafa] [.dark_.status-badge&.translating]:[background-color:#fbbf24] [.dark_.status-badge&.translating]:[color:#291800] [.dark_.status-badge&.stopped]:[border-color:var(--status-paused-border)] [.dark_.status-badge&.stopped]:[background-color:var(--status-paused-bg)] [.dark_.status-badge&.stopped]:[color:var(--status-paused-color)]"
                        v-if="mod.status?.type"
                        :class="['status-badge', mod.status.type]"
                        :title="getStatusDescription(mod.status.type)"
                      >
                        {{ mod.displayStatus }}
                      </span>

                      <span
                        class="[.loader-badge&]:inline-flex [.loader-badge&]:items-center [.loader-badge&]:[gap:5px] [.loader-badge&]:[padding:2px_8px] [.loader-badge&]:[border-radius:8px] [.loader-badge&]:[font-size:11px] [.loader-badge&]:[color:#6b5f58] [.loader-badge&]:[background-color:#f3eee9] [.loader-badge&.loader-fabric]:[color:var(--loader-fabric-color)] [.loader-badge&.loader-fabric]:[background:var(--loader-fabric-bg)] [.loader-badge&.loader-forge]:[color:var(--loader-forge-color)] [.loader-badge&.loader-forge]:[background:var(--loader-forge-bg)] [.loader-badge&.loader-neoforge]:[color:var(--loader-neoforge-color)] [.loader-badge&.loader-neoforge]:[background:var(--loader-neoforge-bg)] [.loader-badge&.loader-vanilla]:[color:var(--loader-vanilla-color)] [.loader-badge&.loader-vanilla]:[background:var(--loader-vanilla-bg)] [.loader-badge&_img]:[width:13px] [.loader-badge&_img]:[height:13px] [.loader-badge&_svg]:[width:13px] [.loader-badge&_svg]:[height:13px] [.loader-badge&_svg]:[color:currentColor] [.loader-badge&.loader-fabric_img]:[filter:var(--loader-fabric-icon-filter)] [.loader-badge&.loader-forge_img]:[filter:var(--loader-forge-icon-filter)] [.loader-badge&.loader-neoforge_img]:[filter:var(--loader-neoforge-icon-filter)] [.loader-badge&.loader-vanilla_img]:[filter:var(--loader-vanilla-icon-filter)]"
                        v-if="showLoaderFilter && mod.versions?.loader"
                        :class="['loader-badge', getLoaderClass(mod.versions.loader)]"
                      >
                        <img
                          v-if="getLoaderIcon(mod.versions.loader)"
                          :src="getLoaderIcon(mod.versions.loader)"
                          :alt="getLoaderText(mod.versions.loader)"
                        />
                        <Icon v-else icon="lucide:layers" />
                        {{ getLoaderText(mod.versions.loader) }}
                      </span>

                      <span
                        v-if="mod.versions?.mc"
                        class="version-badge mc [.version-badge&]:[padding:2px_8px] [.version-badge&]:[border-radius:8px] [.version-badge&]:[font-size:11px] [.version-badge&.mc]:[background-color:#d1fae5] [.version-badge&.mc]:[color:#065f46] [.version-badge&.pack]:[background-color:#ffedd5] [.version-badge&.pack]:[color:#9a3412] [.dark_.version-badge&.mc]:[background-color:rgba(61,_214,_140,_0.2)] [.dark_.version-badge&.mc]:[color:#8ff0bd] [.dark_.version-badge&.mc]:[border:1px_solid_rgba(61,_214,_140,_0.28)] [.dark_.version-badge&.pack]:[background-color:rgba(249,_180,_77,_0.22)] [.dark_.version-badge&.pack]:[color:#ffd08a] [.dark_.version-badge&.pack]:[border:1px_solid_rgba(249,_180,_77,_0.28)]"
                      >
                        MC {{ mod.versions.mc }}
                      </span>

                      <span
                        v-if="mod.versions?.pack"
                        class="version-badge pack [.version-badge&]:[padding:2px_8px] [.version-badge&]:[border-radius:8px] [.version-badge&]:[font-size:11px] [.version-badge&.mc]:[background-color:#d1fae5] [.version-badge&.mc]:[color:#065f46] [.version-badge&.pack]:[background-color:#ffedd5] [.version-badge&.pack]:[color:#9a3412] [.dark_.version-badge&.mc]:[background-color:rgba(61,_214,_140,_0.2)] [.dark_.version-badge&.mc]:[color:#8ff0bd] [.dark_.version-badge&.mc]:[border:1px_solid_rgba(61,_214,_140,_0.28)] [.dark_.version-badge&.pack]:[background-color:rgba(249,_180,_77,_0.22)] [.dark_.version-badge&.pack]:[color:#ffd08a] [.dark_.version-badge&.pack]:[border:1px_solid_rgba(249,_180,_77,_0.28)]"
                      >
                        {{ $t('pack.packVersion') }} {{ mod.versions.pack }}
                      </span>
                    </div>

                    <div
                      class="update-info [.update-info&]:flex [.update-info&]:items-center [.update-info&]:[gap:4px] [.update-info&]:[font-size:12px] [.update-info&]:[color:var(--text-2)] [.update-info&]:whitespace-nowrap max-[768px]:[.update-info&]:[margin-top:4px]"
                      v-if="mod.displayDate"
                    >
                      <Icon
                        icon="lucide:calendar-days"
                        class="update-icon [.update-icon&]:[font-size:14px] [.update-icon&]:[color:var(--text-muted)]"
                      />
                      <span>
                        {{
                          $t('pack.updateDate', {
                            date: formatUpdateDate(mod.displayDate, currentLocale),
                          })
                        }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </RouterLink>
          </div>
          <div
            v-else
            class="empty-state [.empty-state&]:flex [.empty-state&]:items-center [.empty-state&]:justify-center [.empty-state&]:[gap:10px] [.empty-state&]:[min-height:180px] [.empty-state&]:[color:var(--text-2)] [.empty-state&]:[background:var(--bg-soft)] [.empty-state&]:[border:1px_solid_var(--switcher-border)] [.empty-state&]:[border-radius:8px] [.empty-state&_svg]:[width:20px] [.empty-state&_svg]:[height:20px]"
          >
            <Icon icon="lucide:search-x" />
            <span>
              {{
                searchQuery
                  ? $t('DownloadCards.noResults', { query: searchQuery })
                  : $t('DownloadCards.noFilteredResults')
              }}
            </span>
          </div>
        </div>

        <div
          v-if="totalPages > 1"
          class="pagination-controls [.pagination-controls&]:flex [.pagination-controls&]:flex-wrap [.pagination-controls&]:items-center [.pagination-controls&]:justify-center [.pagination-controls&]:[gap:8px] [.pagination-controls&]:[padding:16px_0] [.pagination-controls&]:[margin-top:24px] max-[560px]:[.pagination-controls&]:[gap:6px]"
        >
          <button
            @click="goToPage(currentPage - 1)"
            :disabled="currentPage === 1"
            class="pagination-btn catalog-pagination-btn"
          >
            <Icon icon="lucide:chevron-left" />
            {{ $t('DownloadCards.previousPage') }}
          </button>

          <button
            class="catalog-pagination-btn"
            v-for="page in pageNumbers"
            :key="page"
            @click="goToPage(page)"
            :class="['pagination-btn', { active: page === currentPage }]"
          >
            {{ page }}
          </button>

          <button
            @click="goToPage(currentPage + 1)"
            :disabled="currentPage === totalPages"
            class="pagination-btn catalog-pagination-btn"
          >
            {{ $t('DownloadCards.nextPage') }}
            <Icon icon="lucide:chevron-right" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, watch, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Icon } from '@iconify/vue'
import SelectMenu from '@/components/SelectMenu.vue'
import { getLoaderClass, getLoaderIcon } from '@/data/loaderIcons'
import { formatUpdateDate } from '@/utils/dateFormat'
import { getLocalizedResourceName, isEnglishLocale } from '@/utils/resourceDisplay'
import { convertInlineText } from '@/utils/zhconv'
import { usePageScrollLock } from '@/composables/usePageScrollLock'
import type { ResourceItem } from '@/types/resource'

const props = withDefaults(
  defineProps<{
    mods: ResourceItem[]
    showLoaderFilter?: boolean
  }>(),
  {
    showLoaderFilter: true,
  },
)

const { locale, t } = useI18n()
const currentLocale = computed(() => locale.value)

const searchQuery = ref('')
const currentPage = ref(1)
const itemsPerPage = ref(12)
const sortKey = ref('updated-desc')
const showAllMcVersions = ref(false)
const COLLAPSED_OPTION_LIMIT = 3
const pageSizeOptions = [6, 12, 18].map((value) => ({ label: String(value), value }))
const selectedMcVersions = ref<string[]>([])
const selectedLoaders = ref<string[]>([])
const selectedStatuses = ref<string[]>([])
const filterDrawerOpen = ref(false)
const openGroups = reactive({
  mc: true,
  loader: true,
  status: true,
})
const { lock: lockPageScroll, unlock: unlockPageScroll } = usePageScrollLock()

const searchIndexTW = ref<Record<string, { name: string; desc: string }>>({})
const convertedDisplayData = ref<Record<string, { name: string; desc: string; status: string }>>({})
let searchIndexRequestId = 0
let displayTranslationRequestId = 0

type FilterOption = {
  count: number
  label: string
  value: string
}

type SortOption = {
  label: string
  value: string
}

const getStatusText = (statusType?: string) => {
  if (!statusType) return ''
  return t(`pack.status.${statusType}`)
}

const getStatusDescription = (statusType?: string) => {
  if (statusType !== 'stopped') return undefined
  return t('pack.statusDescription.stopped')
}

const getStatusIcon = (statusType?: string) => {
  if (statusType === 'maintaining') return 'lucide:check-circle-2'
  if (statusType === 'translating') return 'lucide:languages'
  return 'lucide:pause-circle'
}

const getLoaderText = (loader?: string) => {
  if (!loader) return ''
  const key = loader.toLowerCase()
  const label = t(`loader.${key}`)
  return label === `loader.${key}` ? loader : label
}

const normalizeVersionToken = (value?: string) => value?.trim().toLowerCase() || ''

const getMcTokens = (mod: ResourceItem) =>
  (mod.versions?.mc || '')
    .split(/[\s,，/]+/)
    .map((item) => item.trim())
    .filter(Boolean)

const getLoaderValue = (mod: ResourceItem) => normalizeVersionToken(mod.versions?.loader)
const getStatusValue = (mod: ResourceItem) => normalizeVersionToken(mod.status?.type)

const makeOptions = (
  values: string[],
  getLabel: (value: string) => string = (value) => value,
): FilterOption[] => {
  const counts = new Map<string, number>()

  values.forEach((value) => {
    if (!value) return
    counts.set(value, (counts.get(value) || 0) + 1)
  })

  return Array.from(counts.entries())
    .map(([value, count]) => ({ value, count, label: getLabel(value) }))
    .sort((a, b) => compareVersionLike(b.value, a.value) || a.label.localeCompare(b.label))
}

const mcVersionOptions = computed(() =>
  makeOptions(
    props.mods.flatMap((mod) => getMcTokens(mod)),
    (value) => value,
  ),
)

const visibleMcVersionOptions = computed(() =>
  showAllMcVersions.value
    ? mcVersionOptions.value
    : [...mcVersionOptions.value]
        .sort((a, b) => b.count - a.count)
        .slice(0, COLLAPSED_OPTION_LIMIT),
)

const loaderOptions = computed(() =>
  makeOptions(
    props.mods.map((mod) => getLoaderValue(mod)),
    (value) => getLoaderText(value),
  ),
)

const statusOptions = computed(() =>
  makeOptions(
    props.mods.map((mod) => getStatusValue(mod)),
    (value) => getStatusText(value),
  ).reverse(),
)

const activeFilterCount = computed(
  () =>
    selectedMcVersions.value.length +
    (props.showLoaderFilter ? selectedLoaders.value.length : 0) +
    selectedStatuses.value.length,
)

const sortOptions = computed<SortOption[]>(() => {
  const options = [
    { value: 'updated-desc', label: t('DownloadCards.sort.updatedDesc') },
    { value: 'updated-asc', label: t('DownloadCards.sort.updatedAsc') },
  ]

  if (selectedMcVersions.value.length !== 1) {
    options.push(
      { value: 'mc-desc', label: t('DownloadCards.sort.mcDesc') },
      { value: 'mc-asc', label: t('DownloadCards.sort.mcAsc') },
    )
  }

  return options
})

function compareVersionLike(a = '', b = '') {
  const aParts = a.match(/\d+|[a-z]+/gi) || []
  const bParts = b.match(/\d+|[a-z]+/gi) || []
  const length = Math.max(aParts.length, bParts.length)

  for (let i = 0; i < length; i++) {
    const left = aParts[i] || ''
    const right = bParts[i] || ''
    const leftNumber = Number(left)
    const rightNumber = Number(right)

    if (!Number.isNaN(leftNumber) && !Number.isNaN(rightNumber) && leftNumber !== rightNumber) {
      return leftNumber - rightNumber
    }

    const textCompare = left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' })
    if (textCompare) return textCompare
  }

  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
}

function compareMods(a: ResourceItem, b: ResourceItem) {
  const aMc = getMcTokens(a)[0] || ''
  const bMc = getMcTokens(b)[0] || ''

  switch (sortKey.value) {
    case 'updated-asc':
      return (a.date || 0) - (b.date || 0)
    case 'mc-desc':
      return compareVersionLike(bMc, aMc)
    case 'mc-asc':
      return compareVersionLike(aMc, bMc)
    case 'updated-desc':
    default:
      return (b.date || 0) - (a.date || 0)
  }
}

async function initSearchIndex() {
  const requestId = ++searchIndexRequestId
  const nextSearchIndex: Record<string, { name: string; desc: string }> = {}

  for (const mod of props.mods) {
    const [nameTW, descTW] = await Promise.all([
      convertInlineText(getSearchableName(mod), 'zh-TW'),
      convertInlineText(mod.description || '', 'zh-TW'),
    ])

    if (requestId !== searchIndexRequestId) return
    nextSearchIndex[mod.name] = { name: nameTW, desc: descTW }
  }

  searchIndexTW.value = nextSearchIndex
}

async function refreshDisplayTranslations() {
  const targetLocale = currentLocale.value
  const requestId = ++displayTranslationRequestId

  const tasks = paginatedMods.value.map(async (mod) => {
    const localizedName = getLocalizedResourceName(mod, targetLocale)
    const [name, desc] = await Promise.all([
      isEnglishLocale(targetLocale)
        ? Promise.resolve(localizedName)
        : convertInlineText(localizedName, targetLocale),
      convertInlineText(mod.description || '', targetLocale),
    ])

    return { id: mod.name, name, desc, status: getStatusText(mod.status?.type) }
  })

  const results = await Promise.all(tasks)

  if (requestId !== displayTranslationRequestId || targetLocale !== currentLocale.value) return

  results.forEach((item) => {
    convertedDisplayData.value[item.id] = {
      name: item.name,
      desc: item.desc,
      status: item.status,
    }
  })
}

const filteredMods = computed(() => {
  const term = searchQuery.value.toLowerCase().trim()

  return props.mods
    .filter((mod) => {
      if (selectedMcVersions.value.length) {
        const tokens = getMcTokens(mod).map((item) => item.toLowerCase())
        if (!selectedMcVersions.value.some((value) => tokens.includes(value.toLowerCase()))) {
          return false
        }
      }

      if (
        props.showLoaderFilter &&
        selectedLoaders.value.length &&
        !selectedLoaders.value.includes(getLoaderValue(mod))
      ) {
        return false
      }

      if (selectedStatuses.value.length && !selectedStatuses.value.includes(getStatusValue(mod))) {
        return false
      }

      if (!term) return true

      const tw = searchIndexTW.value[mod.name]

      const matchOriginal =
        mod.name.toLowerCase().includes(term) ||
        (mod.originalName || '').toLowerCase().includes(term) ||
        (mod.description || '').toLowerCase().includes(term) ||
        mod.author.toLowerCase().includes(term) ||
        (mod.versions?.mc || '').toLowerCase().includes(term) ||
        (mod.versions?.pack || '').toLowerCase().includes(term) ||
        getLoaderText(mod.versions?.loader).toLowerCase().includes(term)

      const matchTW = tw
        ? tw.name.toLowerCase().includes(term) || tw.desc.toLowerCase().includes(term)
        : false

      return matchOriginal || matchTW
    })
    .slice()
    .sort(compareMods)
})

const totalPages = computed(() => Math.ceil(filteredMods.value.length / itemsPerPage.value))
const startIndex = computed(() => (currentPage.value - 1) * itemsPerPage.value)
const endIndex = computed(() =>
  Math.min(startIndex.value + itemsPerPage.value, filteredMods.value.length),
)

const paginatedMods = computed(() => filteredMods.value.slice(startIndex.value, endIndex.value))

const displayMods = computed(() =>
  paginatedMods.value.map((mod) => ({
    ...mod,
    displayName: convertedDisplayData.value[mod.name]?.name || mod.name,
    displayDesc: convertedDisplayData.value[mod.name]?.desc || mod.description,
    displayStatus: convertedDisplayData.value[mod.name]?.status || getStatusText(mod.status?.type),
  })),
)

const pageNumbers = computed(() => {
  const pages: number[] = []
  const max = 5

  let start = Math.max(1, currentPage.value - 2)
  let end = Math.min(totalPages.value, start + max - 1)

  if (end - start < max - 1) start = Math.max(1, end - max + 1)

  for (let i = start; i <= end; i++) pages.push(i)

  return pages
})

const toggleGroup = (group: keyof typeof openGroups) => {
  openGroups[group] = !openGroups[group]
}

const openFilterDrawer = () => {
  filterDrawerOpen.value = true
}

const closeFilterDrawer = () => {
  filterDrawerOpen.value = false
}

const toggleFilter = (target: string[], value: string) => {
  const index = target.indexOf(value)
  if (index >= 0) target.splice(index, 1)
  else target.push(value)

  if (
    target === selectedMcVersions.value &&
    target.length === 1 &&
    sortKey.value.startsWith('mc-')
  ) {
    sortKey.value = 'updated-desc'
  }

  currentPage.value = 1
}

const resetFilters = () => {
  selectedMcVersions.value = []
  selectedLoaders.value = []
  selectedStatuses.value = []
  searchQuery.value = ''
  sortKey.value = 'updated-desc'
  currentPage.value = 1
}

onMounted(() => {
  void initSearchIndex()
})

watch(
  () => props.mods,
  () => {
    void initSearchIndex()
  },
  { deep: true },
)

watch(
  [paginatedMods, currentLocale],
  () => {
    void refreshDisplayTranslations()
  },
  { immediate: true },
)

watch(
  [searchQuery, sortKey, itemsPerPage, selectedMcVersions, selectedLoaders, selectedStatuses],
  () => {
    currentPage.value = 1
  },
)

watch(
  () => props.showLoaderFilter,
  (showLoaderFilter) => {
    if (!showLoaderFilter) selectedLoaders.value = []
  },
)

watch(filteredMods, () => {
  if (currentPage.value > totalPages.value) currentPage.value = Math.max(totalPages.value, 1)
})

watch(filterDrawerOpen, (isOpen) => {
  if (isOpen) lockPageScroll()
  else unlockPageScroll()
})

onUnmounted(() => {
  searchIndexRequestId += 1
  displayTranslationRequestId += 1
  unlockPageScroll()
})

const goToPage = (page: number) => {
  if (page >= 1 && page <= totalPages.value) {
    currentPage.value = page

    const element = document.querySelector('.DownloadCards')

    if (element) {
      window.scrollTo({
        top: element.getBoundingClientRect().top + window.scrollY - 20,
        behavior: 'smooth',
      })
    }
  }
}

const handleSearchInput = () => {
  currentPage.value = 1
}

const clearSearch = () => {
  searchQuery.value = ''
  currentPage.value = 1
}

const getSearchableName = (mod: ResourceItem) =>
  [mod.name, mod.originalName].filter(Boolean).join(' ')
</script>
