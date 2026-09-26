declare module 'markdown-it-table-of-contents'

declare const __SITE_CONFIG__: {
  readonly siteUrl: string
  readonly apiBaseUrl: string
  readonly contentOrigin: string
  readonly docsUrl: string
  readonly dictUrl: string
  readonly contactEmail: string
  readonly enableBeian: boolean
}

interface ImportMetaEnv {
  readonly VITE_FEEDBACK_API_BASE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module '*.md' {
  import type { ComponentOptions } from 'vue'
  const Component: ComponentOptions
  export default Component
}

declare module 'virtual:search-index' {
  import type { SearchIndexItem } from '@/types/search'

  export const searchIndex: SearchIndexItem[]
}

declare module 'virtual:resources' {
  import type { ResourceItem } from '@/types/resource'

  export const modpacks: ResourceItem[]
  export const maps: ResourceItem[]
}

declare module 'virtual:route-meta' {
  export const routeMeta: Record<
    string,
    {
      title?: string
      description?: string
      icon?: string
      image?: string
    }
  >
}

declare module 'opencc-js/core' {
  export function ConverterBuilder(
    preset: any,
  ): (options: { from: string; to: string }) => (text: string) => string
  export function ConverterFactory(from: any, to: any): (text: string) => string
  export function CustomConverter(
    dict: readonly (readonly [string, string])[],
  ): (text: string) => string
}

declare module 'opencc-js/preset' {
  export const from: { cn: any; tw: any; hk: any; [key: string]: any }
  export const to: { cn: any; tw: any; hk: any; [key: string]: any }
}

declare module 'opencc-js/preset/cn2t' {
  export const from: { cn: any; [key: string]: any }
  export const to: { tw: any; twp: any; hk: any; [key: string]: any }
  export const configs: Record<string, any>
}
