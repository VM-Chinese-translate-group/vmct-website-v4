<template>
  <fieldset
    class="appearance min-w-0 m-[0_0_0_8px] p-0 border-0 max-[860px]:w-full max-[860px]:m-[12px_0_4px]"
    :aria-describedby="`${id}-status`"
  >
    <legend class="sr-only">{{ t('navbar.appearance') }}</legend>
    <div
      class="appearance-heading hidden max-[860px]:flex max-[860px]:flex-wrap max-[860px]:justify-between max-[860px]:gap-[4px_12px] max-[860px]:mb-[10px] max-[860px]:text-[var(--nav-text)] max-[860px]:text-[14px]"
      aria-hidden="true"
    >
      <span>{{ t('navbar.appearance') }}</span>
      <span class="appearance-status max-[860px]:text-[var(--text-2)] max-[860px]:text-[12px]">
        {{ status }}
      </span>
    </div>
    <div
      class="appearance-options flex gap-[2px] p-[3px] [border:1px_solid_var(--switcher-border)] rounded-xl [background:var(--bg-soft)]"
    >
      <label
        v-for="option in options"
        :key="option.value"
        class="appearance-option relative flex-1 min-w-0 [&_input]:absolute [&_input]:[inset:0] [&_input]:z-[1] [&_input]:w-full [&_input]:h-full [&_input]:m-0 [&_input]:opacity-[0] [&_input]:cursor-pointer"
        :title="t(option.label)"
      >
        <input
          type="radio"
          :name="`${id}-appearance`"
          :value="option.value"
          :checked="selectedMode === option.value"
          :aria-label="t(option.label)"
          @change="mode = option.value"
        />
        <span
          class="appearance-choice flex min-w-[36px] min-h-[36px] items-center justify-center gap-2 box-border [border:1px_solid_transparent] rounded-lg text-[var(--text-2)] [transition:background-color_160ms_ease,_color_160ms_ease,_box-shadow_160ms_ease] [.appearance-option_input:hover_+_&]:[background:var(--switcher-item-hover)] [.appearance-option_input:hover_+_&]:text-[var(--nav-text)] [.appearance-option_input:checked_+_&]:border-[var(--appearance-selected-border)] [.appearance-option_input:checked_+_&]:[background:var(--bg-alt)] [.appearance-option_input:checked_+_&]:[box-shadow:var(--vp-shadow-1)] [.appearance-option_input:checked_+_&]:text-[var(--nav-primary)] [.appearance-option_input:focus-visible_+_&]:[outline:2px_solid_var(--nav-primary)] [.appearance-option_input:focus-visible_+_&]:[outline-offset:3px] max-[860px]:min-h-[44px] max-[860px]:p-[6px] max-[860px]:gap-[6px] max-[860px]:text-[13px] max-[860px]:font-500 motion-reduce:[transition:none]"
        >
          <Icon
            :icon="option.icon"
            class="appearance-icon w-[18px] h-[18px] shrink-0"
            aria-hidden="true"
          />
          <span class="appearance-label hidden max-[860px]:[display:inline]">
            {{ t(option.label) }}
          </span>
        </span>
      </label>
    </div>
    <span :id="`${id}-status`" class="sr-only" role="status">{{ status }}</span>
  </fieldset>
</template>

<script setup lang="ts">
import { computed, useId } from 'vue'
import { useMounted } from '@vueuse/core'
import { Icon } from '@/icons'
import { useI18n } from 'vue-i18n'
import { useTheme } from '@/utils/theme'

const { t } = useI18n()
const { mode, theme } = useTheme()
const mounted = useMounted()
const id = useId()
const options = [
  { value: 'auto', icon: 'lucide:monitor', label: 'navbar.themeSystem' },
  { value: 'light', icon: 'lucide:sun', label: 'navbar.themeLight' },
  { value: 'dark', icon: 'lucide:moon', label: 'navbar.themeDark' },
] as const

// SSR 不知道浏览器偏好，挂载后再同步选中项，避免水合差异。
const selectedMode = computed(() => (mounted.value ? mode.value : 'auto'))
const status = computed(() => {
  if (!mounted.value) return t('navbar.themeSystem')
  const current = t(theme.value === 'dark' ? 'navbar.themeDark' : 'navbar.themeLight')
  return mode.value === 'auto' ? t('navbar.themeFollowing', { theme: current }) : current
})
</script>
