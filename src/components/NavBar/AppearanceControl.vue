<template>
  <fieldset class="appearance" :aria-describedby="`${id}-status`">
    <legend class="sr-only">{{ t('navbar.appearance') }}</legend>
    <div class="appearance-heading" aria-hidden="true">
      <span>{{ t('navbar.appearance') }}</span>
      <span class="appearance-status">{{ status }}</span>
    </div>
    <div class="appearance-options">
      <label
        v-for="option in options"
        :key="option.value"
        class="appearance-option"
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
        <span class="appearance-choice">
          <Icon :icon="option.icon" class="appearance-icon" aria-hidden="true" />
          <span class="appearance-label">{{ t(option.label) }}</span>
        </span>
      </label>
    </div>
    <span :id="`${id}-status`" class="sr-only" role="status">{{ status }}</span>
  </fieldset>
</template>

<script setup lang="ts">
import { computed, useId } from 'vue'
import { useMounted } from '@vueuse/core'
import { Icon } from '@iconify/vue'
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

<style scoped>
.appearance {
  min-width: 0;
  margin: 0 0 0 8px;
  padding: 0;
  border: 0;
}

.appearance-heading {
  display: none;
}

.appearance-options {
  display: flex;
  gap: 2px;
  padding: 3px;
  border: 1px solid var(--switcher-border);
  border-radius: 12px;
  background: var(--bg-soft);
}

.appearance-option {
  position: relative;
  flex: 1;
  min-width: 0;
}

.appearance-option input {
  position: absolute;
  inset: 0;
  z-index: 1;
  width: 100%;
  height: 100%;
  margin: 0;
  opacity: 0;
  cursor: pointer;
}

.appearance-choice {
  display: flex;
  min-width: 36px;
  min-height: 36px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  box-sizing: border-box;
  border: 1px solid transparent;
  border-radius: 8px;
  color: var(--text-2);
  transition:
    background-color 160ms ease,
    color 160ms ease,
    box-shadow 160ms ease;
}

.appearance-option input:hover + .appearance-choice {
  background: var(--switcher-item-hover);
  color: var(--nav-text);
}

.appearance-option input:checked + .appearance-choice {
  border-color: var(--appearance-selected-border);
  background: var(--bg-alt);
  box-shadow: var(--vp-shadow-1);
  color: var(--nav-primary);
}

.appearance-option input:focus-visible + .appearance-choice {
  outline: 2px solid var(--nav-primary);
  outline-offset: 3px;
}

.appearance-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.appearance-label {
  display: none;
}

@media (max-width: 860px) {
  .appearance {
    width: 100%;
    margin: 12px 0 4px;
  }

  .appearance-heading {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 4px 12px;
    margin-bottom: 10px;
    color: var(--nav-text);
    font-size: 14px;
  }

  .appearance-status {
    color: var(--text-2);
    font-size: 12px;
  }

  .appearance-choice {
    min-height: 44px;
    padding: 6px;
    gap: 6px;
    font-size: 13px;
    font-weight: 500;
  }

  .appearance-label {
    display: inline;
  }
}

@media (prefers-reduced-motion: reduce) {
  .appearance-choice {
    transition: none;
  }
}
</style>
