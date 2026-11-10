import { defineComponent, h } from 'vue'
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import {
  isLocale,
  readStoredLocale,
  storeLocale,
  toolIdFromSlug,
  type ToolId,
} from './seo/toolRegistry'
import { isGuideId } from './seo/guides'
import type { Locale } from './i18n'

/** Route table drives URL only; App.vue is mounted once in main.ts. */
const Empty = defineComponent({
  name: 'RouteEmpty',
  setup: () => () => h('span', { style: 'display:none', 'aria-hidden': 'true' }),
})

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'root',
    redirect: () => {
      const stored = readStoredLocale()
      return `/${stored || 'ko'}/`
    },
  },
  {
    path: '/:locale(en|zh|ko)/',
    name: 'home',
    component: Empty,
    meta: { view: 'home' },
  },
  {
    path: '/:locale(en|zh|ko)/tools/:slug/',
    name: 'tool',
    component: Empty,
    meta: { view: 'tool' },
  },
  {
    path: '/:locale(en|zh|ko)/tools/:slug',
    redirect: (to) => `/${to.params.locale}/tools/${to.params.slug}/`,
  },
  {
    path: '/:locale(en|zh|ko)/guides/:guideId/',
    name: 'guide',
    component: Empty,
    meta: { view: 'guide' },
  },
  {
    path: '/:locale(en|zh|ko)/guides/:guideId',
    redirect: (to) => `/${to.params.locale}/guides/${to.params.guideId}/`,
  },
  {
    path: '/:locale(en|zh|ko)/shared/',
    name: 'shared',
    component: Empty,
    meta: { view: 'shared' },
  },
  {
    path: '/:locale(en|zh|ko)/shared',
    redirect: (to) => `/${to.params.locale}/shared/`,
  },
  {
    path: '/:locale(en|zh|ko)/pricing/',
    name: 'pricing',
    component: Empty,
    meta: { view: 'pricing' },
  },
  {
    path: '/:locale(en|zh|ko)/pricing',
    redirect: (to) => `/${to.params.locale}/pricing/`,
  },
  {
    path: '/:locale(en|zh|ko)/legal/privacy/',
    name: 'privacy',
    component: Empty,
    meta: { view: 'privacy' },
  },
  {
    path: '/:locale(en|zh|ko)/legal/privacy',
    redirect: (to) => `/${to.params.locale}/legal/privacy/`,
  },
  {
    path: '/:locale(en|zh|ko)',
    redirect: (to) => `/${to.params.locale}/`,
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: () => `/${readStoredLocale() || 'ko'}/`,
  },
]

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior() {
    return { top: 0 }
  },
})

router.beforeEach((to) => {
  const localeParam = String(to.params.locale || '')
  if (localeParam && isLocale(localeParam)) {
    storeLocale(localeParam)
  }
  if (to.name === 'tool') {
    const slug = String(to.params.slug || '')
    if (!toolIdFromSlug(slug)) {
      return { path: `/${localeParam || 'ko'}/` }
    }
  }
  if (to.name === 'guide') {
    const id = String(to.params.guideId || '')
    if (!isGuideId(id)) {
      return { path: `/${localeParam || 'ko'}/` }
    }
  }
  return true
})

export function localeFromRoute(params: Record<string, string | string[]>): Locale {
  const raw = String(params.locale || 'ko')
  return isLocale(raw) ? raw : 'ko'
}

export function activeToolFromRoute(params: Record<string, string | string[]>): ToolId | null {
  const slug = String(params.slug || '')
  return toolIdFromSlug(slug)
}
