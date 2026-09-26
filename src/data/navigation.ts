import { siteConfig } from '@/config/site'
export interface NavItem {
  key: string
  labelKey: string
  to: string
}

export const navItems: NavItem[] = [
  { key: 'modpacks', labelKey: 'navbar.modpack', to: '/modpacks' },
  { key: 'map', labelKey: 'navbar.map', to: '/map' },
  { key: 'community', labelKey: 'navbar.community', to: '/community' },
  { key: 'support-us', labelKey: 'navbar.supportUs', to: '/support-us' },
  { key: 'tools', labelKey: 'navbar.tools', to: '/tools' },
  {
    key: 'install-guide',
    labelKey: 'navbar.installGuide',
    to: `${siteConfig.docsUrl}/tutorial/modpack/translation.html`,
  },
]
