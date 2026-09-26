import { loadEnv } from 'vite'
import { resolveSiteConfig } from './site.mjs'

export function loadSiteConfig(mode = 'production') {
  return resolveSiteConfig(loadEnv(mode, process.cwd(), 'VITE_'))
}
