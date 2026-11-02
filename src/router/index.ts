import { createMemoryHistory, createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

import DefaultLayout from '@/layout/DefaultLayout.vue'
import type { createContentStore } from '@/content/store'

const ContentAdmin = () => import('@/pages/admin/index.vue')

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: DefaultLayout,
    children: [
      { path: '', name: 'Home', component: () => import('@/layout/HomeLayout.vue') },
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

      {
        path: '/:pathMatch(.*)*',
        name: 'content-page',
        component: () => import('@/content/ContentPage.vue'),
      },
    ],
  },
]

export function createAppRouter(content: ReturnType<typeof createContentStore>, ssr = false) {
  const router = createRouter({
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
  router.beforeResolve(async (to) => {
    await content.load(to.path)
    if (to.name === 'content-page') {
      const page = content.state.value.page
      to.meta = page
        ? { ...page.meta, noindex: page.meta.noindex === true || to.path.endsWith('/secret') }
        : { noindex: true, contentMissing: true }
    }
  })
  return router
}
