<template>
  <div
    class="flex h-80% items-center gap-1 max-[860px]:h-auto max-[860px]:w-full max-[860px]:flex-col max-[860px]:items-stretch max-[860px]:gap-0"
  >
    <div
      class="relative flex h-full items-center max-[860px]:h-auto max-[860px]:flex-col max-[860px]:items-stretch"
    >
      <button
        type="button"
        class="flex h-10 cursor-pointer items-center gap-2 border-none rounded-2 bg-transparent px-3 text-[var(--nav-text)] transition-colors duration-200 hover:bg-[var(--nav-hover-bg)] max-[860px]:h-12.5 max-[860px]:w-full max-[860px]:justify-between max-[860px]:border-b max-[860px]:border-b-[var(--switcher-border)] max-[860px]:px-0"
        aria-haspopup="listbox"
        :aria-expanded="isDropdownOpen"
        @click.stop="toggleDropdown"
      >
        <Icon icon="lucide:languages" class="text-4.8 opacity-80" />
        <span class="text-3.8 font-500">{{ currentLangName }}</span>
        <Icon
          icon="lucide:chevron-down"
          class="text-3.2 opacity-50 transition-transform duration-300"
          :class="{ 'rotate-180': isDropdownOpen }"
        />
      </button>

      <ul
        class="absolute right-0 top-[calc(100%+8px)] m-0 min-w-40 list-none rounded-3 border border-[var(--switcher-border)] bg-[var(--bg-alt)] p-1.5 shadow-[var(--switcher-shadow)] transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] max-[860px]:static max-[860px]:w-full max-[860px]:border-none max-[860px]:bg-transparent max-[860px]:p-0 max-[860px]:shadow-none"
        :class="
          isDropdownOpen
            ? 'visible translate-y-0 opacity-100 max-[860px]:mb-2.5 max-[860px]:block'
            : 'invisible -translate-y-2.5 opacity-0 max-[860px]:hidden'
        "
        role="listbox"
      >
        <li
          v-for="lang in AVAILABLE_LANGUAGES"
          :key="lang.code"
          class="flex cursor-pointer items-center justify-between rounded-2 px-3 py-2.5 text-3.6 text-[var(--nav-text)] transition-colors duration-200 hover:bg-[var(--switcher-item-hover)] max-[860px]:rounded-0 max-[860px]:border-l-2 max-[860px]:border-l-transparent max-[860px]:px-4 max-[860px]:py-3"
          :class="
            locale === lang.code
              ? 'bg-[rgba(64,158,255,0.1)] text-[var(--nav-primary)] font-600 max-[860px]:border-l-[var(--nav-primary)] max-[860px]:bg-transparent'
              : ''
          "
          role="option"
          :aria-selected="locale === lang.code"
          :tabindex="isDropdownOpen ? 0 : -1"
          @click.stop="selectLanguage(lang.code)"
          @keydown.enter.prevent.stop="selectLanguage(lang.code)"
          @keydown.space.prevent.stop="selectLanguage(lang.code)"
          @keydown.esc.stop="closeDropdown"
        >
          <span>{{ lang.name }}</span>
          <Icon
            v-if="locale === lang.code"
            icon="lucide:check"
            class="text-4 text-[var(--nav-primary)]"
          />
        </li>
      </ul>
    </div>

    <AppearanceControl />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Icon } from '@iconify/vue'
import AppearanceControl from './AppearanceControl.vue'

type LocaleCode = 'zh-CN' | 'zh-TW' | 'en-US'

interface LanguageOption {
  code: LocaleCode
  name: string
}

const AVAILABLE_LANGUAGES: LanguageOption[] = [
  { code: 'zh-CN', name: '简体中文' },
  { code: 'zh-TW', name: '繁體中文' },
  { code: 'en-US', name: 'English' },
]

const { locale } = useI18n<{ locale: LocaleCode }>()
const isDropdownOpen = ref(false)
const currentLangName = computed((): string => {
  return AVAILABLE_LANGUAGES.find((l) => l.code === locale.value)?.name ?? 'Language'
})

const toggleDropdown = () => (isDropdownOpen.value = !isDropdownOpen.value)
const closeDropdown = () => (isDropdownOpen.value = false)

const selectLanguage = (code: LocaleCode) => {
  locale.value = code
  localStorage.setItem('locale', code)
  isDropdownOpen.value = false
}

onMounted(() => {
  window.addEventListener('click', closeDropdown)
})

onUnmounted(() => {
  window.removeEventListener('click', closeDropdown)
})
</script>
