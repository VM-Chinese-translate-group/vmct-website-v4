import { createGlobalState, useColorMode, useStorage } from '@vueuse/core'
import { computed } from 'vue'

export type ThemeMode = 'light' | 'dark'
export type ThemePreference = ThemeMode | 'auto'

const THEME_STORAGE_KEY = 'theme'

export const useTheme = createGlobalState(() => {
  // 保留旧存储键和纯文本格式；无效值回退到跟随系统。
  const preference = useStorage<ThemePreference>(THEME_STORAGE_KEY, 'auto', undefined, {
    serializer: {
      read: (value) => (value === 'light' || value === 'dark' ? value : 'auto'),
      write: (value) => value,
    },
    writeDefaults: false,
  })

  const mode = useColorMode<ThemeMode>({
    storageRef: preference,
    emitAuto: true,
    modes: { light: '', dark: 'dark' },
    onChanged(theme, defaultHandler) {
      defaultHandler(theme)
      if (typeof document === 'undefined') return

      document.documentElement.dataset.theme = theme
    },
  })

  const isDark = computed(() => mode.state.value === 'dark')
  const toggleTheme = () => {
    mode.value = isDark.value ? 'light' : 'dark'
  }

  return { mode, system: mode.system, theme: mode.state, isDark, toggleTheme }
})

export const getPreferredTheme = (): ThemeMode => useTheme().theme.value

export const applyTheme = (theme: ThemePreference) => {
  useTheme().mode.value = theme
}
