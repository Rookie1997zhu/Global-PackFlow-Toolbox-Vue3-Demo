<script setup lang="ts">
import { computed, onMounted, ref, watch, defineAsyncComponent, provide } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { type Locale, messages, categoryKeys } from './i18n'
import { useCargo } from './shared/cargo/useCargo'
import { formatNumber } from './shared/format/number'
import { unitDefs } from './shared/units'
import { buildScheme, type CargoScheme } from './shared/persistence/scheme'
import {
  deleteScheme,
  exportSchemeFile,
  getAutoRestoreEnabled,
  importSchemeFile,
  listSchemes,
  loadLatestScheme,
  saveCargoAsScheme,
  setAutoRestoreEnabled,
} from './shared/persistence/schemeStore'
import {
  GUIDES,
  isGuideId,
  type GuideId,
} from './seo/guides'
import {
  TOOL_BY_ID,
  TOOL_SEO,
  isLocale,
  slugFromToolId,
  storeLocale,
  toolIdFromSlug,
  type ToolId,
} from './seo/toolRegistry'
import { applyGuideMeta, applyHomeMeta, applyToolMeta } from './seo/applyPageMeta'
import GuidePage from './pages/GuidePage.vue'
import CbmCalculator from './tools/cbm-calculator/CbmCalculator.vue'
import FreightComparison from './tools/freight-comparison/FreightComparison.vue'
import SheetNesting from './tools/sheet-nesting/SheetNesting.vue'
import CostCalculator from './tools/cost-calculator/CostCalculator.vue'
import PackingList from './tools/packing-list/PackingList.vue'
import CommercialInvoice from './tools/commercial-invoice/CommercialInvoice.vue'
import ShippingLabel from './tools/shipping-label/ShippingLabel.vue'
import DocumentChecker from './tools/document-checker/DocumentChecker.vue'

const DielineTool = defineAsyncComponent(() => import('./integrations/dieline/DielineTool.vue'))
const PalletOptimizer = defineAsyncComponent(() => import('./integrations/pallet/PalletOptimizer.vue'))
const ContainerLoading = defineAsyncComponent(() => import('./tools/container-loading/ContainerLoading.vue'))

const route = useRoute()
const router = useRouter()

const locale = ref<Locale>('ko')
provide('hostLocale', locale)
const t = (key: string) => messages[locale.value][key] || key
const catLabel = (cat: string) => t(categoryKeys[cat] || cat)

const titles: Record<ToolId, [string, string, string]> = {
  cbm: [TOOL_BY_ID.cbm.title.en, TOOL_BY_ID.cbm.title.zh, TOOL_BY_ID.cbm.title.ko],
  container: [TOOL_BY_ID.container.title.en, TOOL_BY_ID.container.title.zh, TOOL_BY_ID.container.title.ko],
  freight: [TOOL_BY_ID.freight.title.en, TOOL_BY_ID.freight.title.zh, TOOL_BY_ID.freight.title.ko],
  cost: [TOOL_BY_ID.cost.title.en, TOOL_BY_ID.cost.title.zh, TOOL_BY_ID.cost.title.ko],
  labels: [TOOL_BY_ID.labels.title.en, TOOL_BY_ID.labels.title.zh, TOOL_BY_ID.labels.title.ko],
  packing: [TOOL_BY_ID.packing.title.en, TOOL_BY_ID.packing.title.zh, TOOL_BY_ID.packing.title.ko],
  audit: [TOOL_BY_ID.audit.title.en, TOOL_BY_ID.audit.title.zh, TOOL_BY_ID.audit.title.ko],
  nesting: [TOOL_BY_ID.nesting.title.en, TOOL_BY_ID.nesting.title.zh, TOOL_BY_ID.nesting.title.ko],
  warehouse: [TOOL_BY_ID.warehouse.title.en, TOOL_BY_ID.warehouse.title.zh, TOOL_BY_ID.warehouse.title.ko],
  invoice: [TOOL_BY_ID.invoice.title.en, TOOL_BY_ID.invoice.title.zh, TOOL_BY_ID.invoice.title.ko],
  units: [TOOL_BY_ID.units.title.en, TOOL_BY_ID.units.title.zh, TOOL_BY_ID.units.title.ko],
  dieline: [TOOL_BY_ID.dieline.title.en, TOOL_BY_ID.dieline.title.zh, TOOL_BY_ID.dieline.title.ko],
  pallet: [TOOL_BY_ID.pallet.title.en, TOOL_BY_ID.pallet.title.zh, TOOL_BY_ID.pallet.title.ko],
}
const descriptions: Record<ToolId, [string, string, string]> = {
  cbm: [TOOL_BY_ID.cbm.description.en, TOOL_BY_ID.cbm.description.zh, TOOL_BY_ID.cbm.description.ko],
  container: [TOOL_BY_ID.container.description.en, TOOL_BY_ID.container.description.zh, TOOL_BY_ID.container.description.ko],
  freight: [TOOL_BY_ID.freight.description.en, TOOL_BY_ID.freight.description.zh, TOOL_BY_ID.freight.description.ko],
  cost: [TOOL_BY_ID.cost.description.en, TOOL_BY_ID.cost.description.zh, TOOL_BY_ID.cost.description.ko],
  labels: [TOOL_BY_ID.labels.description.en, TOOL_BY_ID.labels.description.zh, TOOL_BY_ID.labels.description.ko],
  packing: [TOOL_BY_ID.packing.description.en, TOOL_BY_ID.packing.description.zh, TOOL_BY_ID.packing.description.ko],
  audit: [TOOL_BY_ID.audit.description.en, TOOL_BY_ID.audit.description.zh, TOOL_BY_ID.audit.description.ko],
  nesting: [TOOL_BY_ID.nesting.description.en, TOOL_BY_ID.nesting.description.zh, TOOL_BY_ID.nesting.description.ko],
  warehouse: [TOOL_BY_ID.warehouse.description.en, TOOL_BY_ID.warehouse.description.zh, TOOL_BY_ID.warehouse.description.ko],
  invoice: [TOOL_BY_ID.invoice.description.en, TOOL_BY_ID.invoice.description.zh, TOOL_BY_ID.invoice.description.ko],
  units: [TOOL_BY_ID.units.description.en, TOOL_BY_ID.units.description.zh, TOOL_BY_ID.units.description.ko],
  dieline: [TOOL_BY_ID.dieline.description.en, TOOL_BY_ID.dieline.description.zh, TOOL_BY_ID.dieline.description.ko],
  pallet: [TOOL_BY_ID.pallet.description.en, TOOL_BY_ID.pallet.description.zh, TOOL_BY_ID.pallet.description.ko],
}

const idx = computed(() => (locale.value === 'en' ? 0 : locale.value === 'zh' ? 1 : 2))
const tools: { id: ToolId; icon: string; category: string; paid: boolean }[] = [
  { id: 'cbm', icon: '◫', category: 'Freight', paid: false },
  { id: 'container', icon: '▣', category: 'Loading', paid: true },
  { id: 'freight', icon: '⇄', category: 'Freight', paid: false },
  { id: 'cost', icon: '$', category: 'Packaging', paid: false },
  { id: 'labels', icon: '▤', category: 'Documents', paid: false },
  { id: 'packing', icon: '☷', category: 'Documents', paid: false },
  { id: 'audit', icon: '✓', category: 'Documents', paid: true },
  { id: 'nesting', icon: '▦', category: 'Packaging', paid: true },
  { id: 'warehouse', icon: '▥', category: 'Warehouse', paid: false },
  { id: 'invoice', icon: '▧', category: 'Documents', paid: false },
  { id: 'units', icon: '↔', category: 'Freight', paid: false },
  { id: 'dieline', icon: '◇', category: 'Packaging', paid: true },
  { id: 'pallet', icon: '▰', category: 'Loading', paid: true },
]

const search = ref('')
const category = ref('All')
const mobileNav = ref(false)
const categories = ['All', 'Packaging', 'Loading', 'Freight', 'Documents', 'Warehouse']

const view = computed(() => String(route.meta.view || 'home'))
const active = computed<ToolId | null>(() => {
  if (view.value !== 'tool') return null
  return toolIdFromSlug(String(route.params.slug || ''))
})
const showData = computed(() => view.value === 'shared')
const showPricing = computed(() => view.value === 'pricing')
const guideId = computed<GuideId | null>(() => {
  if (view.value !== 'guide') return null
  const id = String(route.params.guideId || '')
  return isGuideId(id) ? id : null
})

const visibleTools = computed(() =>
  tools.filter(
    (x) =>
      (category.value === 'All' || x.category === category.value) &&
      `${titles[x.id].join(' ')} ${descriptions[x.id].join(' ')}`.toLowerCase().includes(search.value.toLowerCase()),
  ),
)

const { cargo, cbm, gross, qty, goodsValue, addCargo, removeCargo, reset: resetCargo, setCargo, exportCargo: exportCargoRows, n } =
  useCargo()
const format = (v: number, d = 2) => formatNumber(v, locale.value, d)
const reset = () => {
  resetCargo()
}
const exportCargo = () =>
  exportCargoRows([t('colSku'), t('lengthCm'), t('widthCm'), t('heightCm'), t('weightKg'), t('colQty'), t('unitPriceUsd')])

const schemeName = ref('KR demo scheme')
const schemeList = ref<CargoScheme[]>([])
const schemeMsg = ref('')
const autoRestore = ref(getAutoRestoreEnabled())
const refreshSchemes = async () => {
  try {
    schemeList.value = await listSchemes()
  } catch {
    schemeList.value = []
  }
}
const saveScheme = async () => {
  schemeMsg.value = ''
  try {
    await saveCargoAsScheme({ name: schemeName.value, cargo: cargo.value, locale: locale.value })
    schemeMsg.value = t('schemeSaved')
    await refreshSchemes()
  } catch (err) {
    schemeMsg.value = err instanceof Error ? err.message : String(err)
  }
}
const restoreScheme = async (id: string) => {
  const found = schemeList.value.find((s) => s.id === id)
  if (!found) return
  setCargo(found.cargo.map((c) => ({ ...c })))
  schemeMsg.value = t('schemeRestored')
}
const exportSchemeJson = () => {
  exportSchemeFile(buildScheme({ name: schemeName.value, cargo: cargo.value, locale: locale.value }))
}
const onImportScheme = async (e: Event) => {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    const scheme = await importSchemeFile(file)
    setCargo(scheme.cargo.map((c) => ({ ...c })))
    schemeName.value = scheme.name
    schemeMsg.value = t('schemeRestored')
    await refreshSchemes()
  } catch (err) {
    schemeMsg.value = err instanceof Error ? err.message : t('errSchemeInvalid')
  }
}
const removeScheme = async (id: string) => {
  await deleteScheme(id)
  await refreshSchemes()
}
watch(autoRestore, (v) => setAutoRestoreEnabled(v))

watch(
  () => route.params.locale,
  (raw) => {
    const next = String(raw || 'ko')
    if (isLocale(next)) locale.value = next
  },
  { immediate: true },
)

watch(
  [locale, view, () => route.params.slug, () => route.params.guideId],
  () => {
    if (view.value === 'tool') {
      const entry = TOOL_SEO.find((x) => x.slug === String(route.params.slug))
      if (entry) applyToolMeta(locale.value, entry)
      else applyHomeMeta(locale.value)
    } else if (view.value === 'guide' && guideId.value) {
      applyGuideMeta(locale.value, guideId.value)
    } else {
      applyHomeMeta(locale.value)
    }
  },
  { immediate: true },
)

onMounted(async () => {
  await refreshSchemes()
  try {
    const latest = await loadLatestScheme()
    if (latest?.cargo?.length) {
      setCargo(latest.cargo.map((c) => ({ ...c })))
      schemeName.value = latest.name
    }
  } catch {
    /* ignore */
  }
})

const heroContainerVol = (1203 * 235 * 269) / 1e6
const volUtil = computed(() => (heroContainerVol ? (cbm.value / heroContainerVol) * 100 : 0))
const warehouseL = ref(30)
const warehouseW = ref(20)
const warehouseH = ref(6)
const aislePct = ref(35)
const rackLevels = ref(3)
const rackCapacity = ref(2.5)
const usableArea = computed(
  () => n(warehouseL.value) * n(warehouseW.value) * (1 - Math.min(100, n(aislePct.value)) / 100),
)
const warehousePositions = computed(
  () => Math.floor(usableArea.value / Math.max(0.1, n(rackCapacity.value))) * Math.max(1, Math.floor(n(rackLevels.value))),
)
const unitType = ref('length')
const unitValue = ref(100)
const unitFrom = ref('cm')
const unitTo = ref('in')
const converted = computed(
  () =>
    (n(unitValue.value) * (unitDefs[unitType.value as 'length' | 'mass' | 'volume']?.[unitFrom.value] || 1)) /
    (unitDefs[unitType.value as 'length' | 'mass' | 'volume']?.[unitTo.value] || 1),
)
watch(unitType, () => {
  const keys = Object.keys(unitDefs[unitType.value as 'length' | 'mass' | 'volume'])
  unitFrom.value = keys[0]
  unitTo.value = keys[1]
})
const pricingPlans = computed(() => [
  { nameKey: 'planFree', price: '$0', descKey: 'planFreeDesc', features: ['planFeatBasic', 'planFeatLocal', 'planFeatCsv'] },
  { nameKey: 'planPro', price: '$12', descKey: 'planProDesc', features: ['planFeatOpt', 'planFeatHistory', 'planFeatCad'] },
  {
    nameKey: 'planBusiness',
    price: '$39',
    descKey: 'planBusinessDesc',
    features: ['planFeatSeats', 'planFeatBatch', 'planFeatPriority'],
  },
])

const openTool = (id: ToolId) => {
  void router.push(`/${locale.value}/tools/${slugFromToolId(id)}/`)
  mobileNav.value = false
}
const back = () => {
  void router.push(`/${locale.value}/`)
  mobileNav.value = false
}
const openSharedData = () => {
  void router.push(`/${locale.value}/shared/`)
  mobileNav.value = false
}
const openPricing = () => {
  void router.push(`/${locale.value}/pricing/`)
  mobileNav.value = false
}
const openGuide = (id: GuideId) => {
  void router.push(`/${locale.value}/guides/${id}/`)
  mobileNav.value = false
}
const scrollToTools = () => {
  category.value = 'All'
  requestAnimationFrame(() => window.document.getElementById('tool-grid')?.scrollIntoView({ behavior: 'smooth' }))
}
const activeCategory = computed(() => tools.find((x) => x.id === active.value)?.category || '')
const activePaid = computed(() => !!tools.find((x) => x.id === active.value)?.paid)

const onLocaleSelect = (e: Event) => {
  const next = (e.target as HTMLSelectElement).value
  if (!isLocale(next) || next === locale.value) return
  storeLocale(next)
  const cur = String(route.params.locale || locale.value)
  const replaced = route.fullPath.replace(`/${cur}/`, `/${next}/`)
  void router.push(replaced.includes(`/${next}/`) ? replaced : `/${next}/`)
}

const breadcrumbTitle = computed(() => {
  if (active.value) return titles[active.value][idx.value]
  if (showPricing.value) return t('pricing')
  if (showData.value) return t('shared')
  if (guideId.value) return GUIDES.find((g) => g.id === guideId.value)?.title[locale.value] || t('guides')
  return t('tools')
})
</script>

<template>
  <div class="shell">
    <aside class="sidebar" :class="{ open: mobileNav }">
      <div class="brand" @click="back">
        <div class="brand-mark">P<span>·</span></div>
        <div>
          <strong>PackFlow</strong>
          <small>{{ t('brandTag') }}</small>
        </div>
      </div>
      <div class="sidebar-caption">{{ t('workspace') }}</div>
      <button class="nav-link" :class="{ selected: view === 'home' }" type="button" @click="back">
        <span>▦</span>{{ t('overview') }}
      </button>
      <button class="nav-link" :class="{ selected: showData }" type="button" @click="openSharedData">
        <span>▤</span>{{ t('shared') }}
      </button>
      <div class="sidebar-caption">{{ t('categories') }}</div>
      <button
        v-for="cat in categories.slice(1)"
        :key="cat"
        class="nav-link"
        :class="{ selected: active && tools.find((x) => x.id === active)?.category === cat }"
        type="button"
        @click="category = cat; back()"
      >
        <span>{{ cat === 'Packaging' ? '◇' : cat === 'Loading' ? '▣' : cat === 'Freight' ? '⇄' : cat === 'Documents' ? '☷' : '▥' }}</span
        >{{ catLabel(cat) }}
      </button>
      <div class="sidebar-bottom">
        <div class="plan-icon">✦</div>
        <strong>{{ t('sidebarTitle') }}</strong>
        <p>{{ t('sidebarDesc') }}</p>
        <button class="side-plan" type="button" @click="openPricing">{{ t('pricing') }} ↗</button>
      </div>
    </aside>
    <div class="main-wrap">
      <header class="topbar">
        <button class="hamburger" type="button" @click="mobileNav = !mobileNav">☰</button>
        <div class="breadcrumbs">
          <span @click="back">{{ t('home') }}</span><span class="slash">/</span><strong>{{ breadcrumbTitle }}</strong>
        </div>
        <div class="top-actions">
          <span class="live-dot"></span><span class="top-status">{{ t('status') }}</span>
          <select class="language" :value="locale" @change="onLocaleSelect">
            <option value="en">EN</option>
            <option value="zh">中文</option>
            <option value="ko">한국어</option>
          </select>
          <button class="login" type="button" @click="openPricing">{{ t('sign') }}</button>
        </div>
      </header>
      <main class="main">
        <template v-if="view === 'home'">
          <section class="hero">
            <div class="hero-content">
              <div class="eyebrow">✦ {{ t('heroEyebrow') }}</div>
              <h1>{{ t('hero') }}</h1>
              <p>{{ t('subtitle') }}</p>
              <button class="hero-btn" type="button" @click="scrollToTools">{{ t('try') }} <span>↗</span></button>
              <div class="hero-pills">
                <span>✓ 13 {{ t('toolsCount') }}</span><span>✓ EN / 中文 / 한국어</span><span>✓ {{ t('noInstall') }}</span>
              </div>
            </div>
            <div class="hero-art">
              <div class="art-grid"></div>
              <div class="floating-card card-a">
                <span>◫</span>
                <div>
                  <small>{{ t('volumeCalculated') }}</small>
                  <strong>{{ format(cbm) }} m³</strong>
                </div>
              </div>
              <div class="floating-card card-b">
                <span>▣</span>
                <div>
                  <small>{{ t('loadingAnalysis') }}</small>
                  <strong>{{ format(volUtil, 1) }}% {{ t('capacityLabel') }}</strong>
                </div>
              </div>
              <div class="art-box box-one"></div>
              <div class="art-box box-two"></div>
              <div class="art-box box-three"></div>
            </div>
          </section>
          <div class="stats">
            <div>
              <span class="stat-symbol">◫</span><strong>13</strong><small>{{ t('ready') }}</small>
            </div>
            <div>
              <span class="stat-symbol">◇</span><strong>2</strong><small>{{ t('tagPro') }}</small>
            </div>
            <div>
              <span class="stat-symbol">◎</span><strong>3</strong><small>{{ t('languages') }}</small>
            </div>
            <div>
              <span class="stat-symbol">↗</span><strong>100%</strong><small>{{ t('browserBased') }}</small>
            </div>
          </div>
          <div class="section-head" id="tool-grid">
            <div>
              <div class="eyebrow dark">{{ t('exploreCreate') }}</div>
              <h2>{{ t('library') }}</h2>
              <p>{{ t('librarySub') }}</p>
            </div>
            <div class="search-wrap"><span>⌕</span><input v-model="search" :placeholder="t('search')" /></div>
          </div>
          <div class="chips">
            <button v-for="cat in categories" :key="cat" type="button" :class="{ active: category === cat }" @click="category = cat">
              {{ catLabel(cat) }}
            </button>
          </div>
          <div class="tool-grid">
            <button v-for="tool in visibleTools" :key="tool.id" class="tool-card" type="button" @click="openTool(tool.id)">
              <div class="tool-card-top">
                <span class="tool-icon" :class="tool.category.toLowerCase()">{{ tool.icon }}</span>
                <span class="tag">{{ tool.paid ? t('tagPro') : t('tagFree') }}</span>
              </div>
              <h3>{{ titles[tool.id][idx] }}</h3>
              <p>{{ descriptions[tool.id][idx] }}</p>
              <div class="tool-card-bottom">
                <span>{{ catLabel(tool.category) }}</span><strong>↗</strong>
              </div>
            </button>
          </div>
          <p v-if="!visibleTools.length" class="empty">{{ t('empty') }}</p>

          <div class="section-head" style="margin-top: 28px">
            <div>
              <div class="eyebrow dark">{{ t('guidesEyebrow') }}</div>
              <h2>{{ t('guides') }}</h2>
              <p>{{ t('guidesSub') }}</p>
            </div>
          </div>
          <div class="tool-grid">
            <button v-for="g in GUIDES" :key="g.id" class="tool-card" type="button" @click="openGuide(g.id)">
              <div class="tool-card-top"><span class="tool-icon documents">?</span><span class="tag">{{ t('tagFree') }}</span></div>
              <h3>{{ g.title[locale] }}</h3>
              <p>{{ g.summary[locale] }}</p>
              <div class="tool-card-bottom"><span>{{ t('guides') }}</span><strong>↗</strong></div>
            </button>
          </div>

          <div class="bottom-banner">
            <div>
              <span class="eyebrow">{{ t('bannerEyebrow') }}</span>
              <h2>{{ t('bannerTitle') }}</h2>
              <p>{{ t('bannerDesc') }}</p>
            </div>
            <button type="button" @click="openPricing">{{ t('pricing') }} →</button>
          </div>
        </template>

        <template v-else-if="showPricing">
          <div class="page-heading">
            <button class="back" type="button" @click="back">← {{ t('all') }}</button>
            <div class="eyebrow dark">{{ t('pricingEyebrow') }}</div>
            <h1>{{ t('pricing') }}</h1>
            <p>{{ t('billing') }}</p>
          </div>
          <div class="pricing-grid">
            <div v-for="plan in pricingPlans" :key="plan.nameKey" class="price-card">
              <h3>{{ t(plan.nameKey) }}</h3>
              <strong>{{ plan.price }}<small> {{ t('perMonth') }}</small></strong>
              <p>{{ t(plan.descKey) }}</p>
              <ul>
                <li v-for="f in plan.features" :key="f">✓ {{ t(f) }}</li>
              </ul>
              <button disabled>{{ t('comingLater') }}</button>
            </div>
          </div>
        </template>

        <template v-else-if="showData">
          <div class="page-heading">
            <button class="back" type="button" @click="back">← {{ t('all') }}</button>
            <div class="eyebrow dark">{{ t('sharedEyebrow') }}</div>
            <h1>{{ t('shared') }}</h1>
            <p>{{ t('sharedDesc') }}</p>
          </div>
          <div class="panel">
            <div class="panel-heading">
              <h3>{{ t('cargoItems') }}</h3>
              <div class="btn-row">
                <button class="btn-secondary" type="button" @click="reset">{{ t('reset') }}</button>
                <button class="btn-secondary" type="button" @click="exportCargo">{{ t('export') }}</button>
                <button class="btn-primary" type="button" @click="addCargo">+ {{ t('add') }}</button>
              </div>
            </div>
            <div class="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>{{ t('name') }}</th>
                    <th>{{ t('length') }} cm</th>
                    <th>{{ t('width') }} cm</th>
                    <th>{{ t('height') }} cm</th>
                    <th>{{ t('weight') }} kg</th>
                    <th>{{ t('quantity') }}</th>
                    <th>{{ t('price') }} USD</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(c, i) in cargo" :key="i">
                    <td><input v-model="c.sku" class="cell-name" /></td>
                    <td><input v-model.number="c.length" type="number" min="0" /></td>
                    <td><input v-model.number="c.width" type="number" min="0" /></td>
                    <td><input v-model.number="c.height" type="number" min="0" /></td>
                    <td><input v-model.number="c.weight" type="number" min="0" step="0.1" /></td>
                    <td><input v-model.number="c.qty" type="number" min="0" step="1" /></td>
                    <td><input v-model.number="c.price" type="number" min="0" step="0.1" /></td>
                    <td><button class="remove" type="button" @click="removeCargo(i)">×</button></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="data-summary">
              <span>{{ qty }} {{ t('pcs') }}</span><span>{{ format(cbm) }} m³</span><span>{{ format(gross) }} kg</span
              ><span>${{ format(goodsValue) }}</span>
            </div>
            <div style="margin-top: 16px; padding-top: 14px; border-top: 1px solid #e5ebf1">
              <h3 style="margin: 0 0 8px; font-size: 14px">{{ t('schemeBackup') }}</h3>
              <p class="field-hint">{{ t('schemeBackupHint') }}</p>
              <label class="field">{{ t('schemeName') }}<input v-model="schemeName" /></label>
              <label class="field" style="display: flex; align-items: center; gap: 8px; margin-top: 8px">
                <input v-model="autoRestore" type="checkbox" /> {{ t('schemeAutoRestore') }}
              </label>
              <div class="btn-row" style="margin-top: 8px; flex-wrap: wrap; gap: 8px">
                <button class="btn-primary" type="button" @click="saveScheme">{{ t('schemeSave') }}</button>
                <button class="btn-secondary" type="button" @click="exportSchemeJson">{{ t('schemeExportJson') }}</button>
                <label class="btn-secondary" style="display: inline-flex; align-items: center; cursor: pointer">
                  {{ t('schemeImportJson') }}
                  <input type="file" accept=".json,application/json" hidden @change="onImportScheme" />
                </label>
              </div>
              <p v-if="schemeMsg" class="field-hint">{{ schemeMsg }}</p>
              <ul v-if="schemeList.length" style="margin: 10px 0 0; padding-left: 18px">
                <li v-for="s in schemeList" :key="s.id" style="margin: 6px 0">
                  <strong>{{ s.name }}</strong> <small>{{ s.updatedAt }}</small> ·
                  <button class="linkish" type="button" @click="restoreScheme(s.id)">{{ t('schemeRestore') }}</button> ·
                  <button class="linkish" type="button" @click="removeScheme(s.id)">{{ t('schemeDelete') }}</button>
                </li>
              </ul>
            </div>
          </div>
        </template>

        <GuidePage v-else-if="guideId" :t="t" :locale="locale" :guide-id="guideId" />

        <template v-else-if="active">
          <div class="page-heading">
            <button class="back" type="button" @click="back">← {{ t('all') }}</button>
            <div class="eyebrow dark">{{ catLabel(activeCategory) }} / {{ activePaid ? t('proTool') : t('freeTool') }}</div>
            <h1>{{ titles[active][idx] }}</h1>
            <p>{{ descriptions[active][idx] }}</p>
          </div>
          <DielineTool v-if="active === 'dieline'" />
          <PalletOptimizer v-else-if="active === 'pallet'" :t="t" />
          <CbmCalculator v-else-if="active === 'cbm'" :t="t" @edit-cargo="openSharedData" />
          <FreightComparison v-else-if="active === 'freight'" :t="t" @edit-cargo="openSharedData" />
          <SheetNesting v-else-if="active === 'nesting'" :t="t" />
          <ContainerLoading v-else-if="active === 'container'" :t="t" @edit-cargo="openSharedData" />
          <CostCalculator v-else-if="active === 'cost'" :t="t" @edit-cargo="openSharedData" />
          <PackingList v-else-if="active === 'packing'" :t="t" @edit-cargo="openSharedData" />
          <CommercialInvoice v-else-if="active === 'invoice'" :t="t" @edit-cargo="openSharedData" />
          <ShippingLabel v-else-if="active === 'labels'" :t="t" @edit-cargo="openSharedData" />
          <DocumentChecker v-else-if="active === 'audit'" :t="t" @edit-cargo="openSharedData" />
          <template v-else>
            <div class="tool-layout">
              <div class="tool-settings">
                <div class="panel">
                  <div class="panel-heading">
                    <h3>{{ t('settings') }}</h3>
                    <span class="small-badge">{{ t('live') }}</span>
                  </div>
                  <template v-if="active === 'warehouse'">
                    <label class="field">{{ t('warehouseLength') }}<input v-model.number="warehouseL" type="number" min="0" /></label>
                    <label class="field">{{ t('warehouseWidth') }}<input v-model.number="warehouseW" type="number" min="0" /></label>
                    <label class="field">{{ t('warehouseHeight') }}<input v-model.number="warehouseH" type="number" min="0" /></label>
                    <label class="field">{{ t('aislePct') }}<input v-model.number="aislePct" type="number" min="0" max="100" /></label>
                    <label class="field">{{ t('rackLevels') }}<input v-model.number="rackLevels" type="number" min="1" /></label>
                    <label class="field"
                      >{{ t('floorPerPosition') }}<input v-model.number="rackCapacity" type="number" min="0.1" step="0.1"
                    /></label>
                  </template>
                  <template v-if="active === 'units'">
                    <label class="field"
                      >{{ t('quantityType')
                      }}<select v-model="unitType">
                        <option value="length">{{ t('unitLength') }}</option>
                        <option value="mass">{{ t('unitMass') }}</option>
                        <option value="volume">{{ t('unitVolume') }}</option>
                      </select></label
                    >
                    <label class="field">{{ t('value') }}<input v-model.number="unitValue" type="number" /></label>
                    <label class="field"
                      >{{ t('from')
                      }}<select v-model="unitFrom">
                        <option v-for="u in Object.keys(unitDefs[unitType as 'length' | 'mass' | 'volume'])" :key="u">{{ u }}</option>
                      </select></label
                    >
                    <label class="field"
                      >{{ t('to')
                      }}<select v-model="unitTo">
                        <option v-for="u in Object.keys(unitDefs[unitType as 'length' | 'mass' | 'volume'])" :key="u">{{ u }}</option>
                      </select></label
                    >
                  </template>
                </div>
              </div>
              <div class="tool-output">
                <div class="panel output-panel">
                  <div class="panel-heading">
                    <h3>{{ t('results') }}</h3>
                    <span class="small-badge light">{{ t('autoUpdated') }}</span>
                  </div>
                  <template v-if="active === 'warehouse'">
                    <div class="metric-grid">
                      <div class="metric primary">
                        <span>{{ t('usableStorage') }}</span><strong>{{ format(usableArea) }}<small> m²</small></strong>
                      </div>
                      <div class="metric">
                        <span>{{ t('palletPositions') }}</span><strong>{{ format(warehousePositions, 0) }}</strong>
                      </div>
                      <div class="metric">
                        <span>{{ t('buildingVolume') }}</span
                        ><strong>{{ format(warehouseL * warehouseW * warehouseH) }}<small> m³</small></strong>
                      </div>
                      <div class="metric">
                        <span>{{ t('grossFloorArea') }}</span
                        ><strong>{{ format(warehouseL * warehouseW) }}<small> m²</small></strong>
                      </div>
                    </div>
                    <div class="warehouse-view">
                      <div class="aisle">{{ t('aisleOther') }}</div>
                      <div class="racks"><span v-for="i in 18" :key="i">▥</span></div>
                    </div>
                    <p class="field-hint">{{ t('warehouseHint') }}</p>
                  </template>
                  <template v-if="active === 'units'">
                    <div class="unit-answer">
                      <small>{{ t('convertedValue') }}</small><strong>{{ format(converted, 6) }}</strong><span>{{ unitTo }}</span>
                    </div>
                    <div class="unit-formula">{{ format(unitValue, 4) }} {{ unitFrom }} = {{ format(converted, 6) }} {{ unitTo }}</div>
                  </template>
                </div>
                <div class="hint-box">ⓘ {{ t('disclaimer') }}</div>
              </div>
            </div>
          </template>
        </template>
      </main>
      <footer class="footer">
        <span>{{ t('footerCopy') }}</span
        ><span>EN · 中文 · 한국어 &nbsp; | &nbsp; {{ t('footerTagline') }}</span>
      </footer>
    </div>
  </div>
</template>
