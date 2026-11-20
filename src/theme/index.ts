import { siteShortcuts as sharedShortcuts } from './shortcuts.ts'
import { catalogShortcuts } from './catalog.ts'

export const siteShortcuts = { ...sharedShortcuts, ...catalogShortcuts }
