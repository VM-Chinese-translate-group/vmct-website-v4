import { createMemoryHistory, createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

import DefaultLayout from '@/layout/DefaultLayout.vue'
import Home from '@/layout/HomeLayout.vue'
import ContentAdmin from '@/pages/admin/index.vue'
import { routeMeta } from 'virtual:route-meta'

const mdComponents = {
  ...import.meta.glob('../pages/**/*.md'),
  ...import.meta.glob('../generated-pages/**/*.md'),
}

function fileToRoutePath(file: string) {
  let p = file.replace(/^\.\.\/(?:pages|generated-pages)/, '').replace(/\.md$/, '')
  if (p.endsWith('/index')) p = p.replace(/\/index$/, '')
  if (p === '') return '/'
  return p.startsWith('/') ? p : `/${p}`
}

const mdRouteMap = new Map<string, RouteRecordRaw>()

Object.keys(mdComponents).forEach((file) => {
  const routePath = fileToRoutePath(file)

  if (['/', '/modpacks', '/map'].includes(routePath)) return

  const isDocLayout = routePath.startsWith('/modpacks/fc5-wiki') || routePath.endsWith('/secret')

  mdRouteMap.set(routePath, {
    path: routePath,
    name: routePath.replace(/^\//, '').replace(/\//g, '-') || `md-${Math.random()}`,
    component: mdComponents[file],
    meta: {
      ...(routeMeta[file] || {}),
      layout: isDocLayout ? 'doc' : 'default',
      noindex: routePath.endsWith('/secret'),
    },
  })
})

const mdRoutes = [...mdRouteMap.values()]

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: DefaultLayout,
    children: [
      { path: '', name: 'Home', component: Home },
      { path: 'modpacks', name: 'modpacks-list', component: () => import('@/pages/modpacks.vue') },
      { path: 'map', name: 'map-list', component: () => import('@/pages/map.vue') },
      {
        path: 'admin',
        name: 'content-admin',
        component: ContentAdmin,
        meta: { noindex: true },
      },
      {
        path: 'admin/settings',
        name: 'content-admin-settings',
        component: ContentAdmin,
        meta: { noindex: true },
      },
      {
        path: 'translation-feedback',
        name: 'translation-feedback',
        component: () => import('@/layout/TranslationFeedbackLayout.vue'),
      },
      { path: 'join', name: 'join-redirect', redirect: '/community#加入汉化组' },
      {
        path: 'credits',
        name: 'credits',
        component: () => import('@/pages/credits.vue'),
      },

      ...mdRoutes,

      {
        path: '/:pathMatch(.*)*',
        name: 'not-found',
        component: () => import('@/layout/NotFoundLayout.vue'),
        meta: {
          noindex: true,
        },
      },
    ],
  },
]

export function createAppRouter(ssr = false) {
  return createRouter({
    history: ssr ? createMemoryHistory() : createWebHistory(),
    routes,
    scrollBehavior(to, from, savedPosition) {
      if (to.hash) {
        return {
          el: to.hash,
          behavior: 'smooth',
          top: 80,
        }
      }
      if (savedPosition) {
        return savedPosition
      }
      return { top: 0 }
    },
  })
}
