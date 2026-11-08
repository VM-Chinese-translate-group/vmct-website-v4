import { createGlobalState, useColorMode, useStorage } from '@vueuse/core'
import { computed } from 'vue'
import githubMarkdownDarkHref from 'github-markdown-css/github-markdown-dark.css?url'
import githubMarkdownLightHref from 'github-markdown-css/github-markdown-light.css?url'

export type ThemeMode = 'light' | 'dark'
export type ThemePreference = ThemeMode | 'auto'

const THEME_STORAGE_KEY = 'theme'
const MARKDOWN_THEME_LINK_ID = 'github-markdown-theme'

const MARKDOWN_THEME_HREF: Record<ThemeMode, string> = {
  light: githubMarkdownLightHref,
  dark: githubMarkdownDarkHref,
}

const getMarkdownThemeLink = (): HTMLLinkElement => {
  const existing = document.getElementById(MARKDOWN_THEME_LINK_ID)

  if (existing instanceof HTMLLinkElement) {
    return existing
  }

  const link = document.createElement('link')
  link.id = MARKDOWN_THEME_LINK_ID
  link.rel = 'stylesheet'

  document.head.insertBefore(link, document.head.querySelector('link[rel="stylesheet"], style'))

  return link
}

const syncMarkdownTheme = (theme: ThemeMode) => {
  if (typeof document === 'undefined') return

  const link = getMarkdownThemeLink()
  const href = MARKDOWN_THEME_HREF[theme]

  if (link.getAttribute('href') !== href) {
    link.href = href
  }
}

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
      document.documentElement.style.colorScheme = theme
      syncMarkdownTheme(theme)
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
