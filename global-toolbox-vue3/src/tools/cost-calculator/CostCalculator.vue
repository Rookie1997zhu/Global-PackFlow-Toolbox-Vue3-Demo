<script setup lang="ts">
import { computed, inject, reactive, ref, watch, type Ref } from 'vue'
import type { Locale } from '../../i18n'
import { useCargo } from '../../shared/cargo/useCargo'
import { formatNumber } from '../../shared/format/number'
import {
  compareScenarios,
  computeCost,
  defaultCostInputs,
  exportCostComparisonCsv,
  exportCostComparisonXlsx,
  validateCostInputs,
  type CostInputs,
} from './useCost'

defineProps<{ t: (key: string) => string }>()
const emit = defineEmits<{ editCargo: [] }>()

const hostLocale = inject<Ref<Locale>>('hostLocale', ref('en'))
const { qty } = useCargo()
const format = (v: number, d = 2) => formatNumber(v, hostLocale.value, d)

const planA = reactive<CostInputs>(defaultCostInputs(qty.value))
const planB = reactive<CostInputs>(
  defaultCostInputs(qty.value, {
    materialPerUnit: 0.95,
    laborPerUnit: 0.28,
    wastePct: 5,
    storage: 55,
    transport: 320,
    taxPct: 2,
    markupPct: 12,
  }),
)

watch(
  qty,
  (q) => {
    planA.qty = q
    planB.qty = q
  },
  { immediate: true },
)

const resultA = computed(() => computeCost(planA))
const resultB = computed(() => computeCost(planB))
const issuesA = computed(() => validateCostInputs(planA))
const issuesB = computed(() => validateCostInputs(planB))
const comparison = computed(() =>
  compareScenarios(
    { name: 'A', input: { ...planA }, result: resultA.value },
    { name: 'B', input: { ...planB }, result: resultB.value },
  ),
)

const exportLabels = computed(() => ({
  scenario: 'Scenario',
  currency: 'Currency',
  qty: 'Qty',
  costTotal: 'Cost total',
  markedUp: 'Marked-up total',
  perUnit: 'Per unit',
  margin: 'Gross margin %',
}))

const onExportCsv = () =>
  exportCostComparisonCsv(
    [
      { name: 'A', input: { ...planA }, result: resultA.value },
      { name: 'B', input: { ...planB }, result: resultB.value },
    ],
    exportLabels.value,
  )

const onExportXlsx = () =>
  exportCostComparisonXlsx(
    [
      { name: 'A', input: { ...planA }, result: resultA.value },
      { name: 'B', input: { ...planB }, result: resultB.value },
    ],
    exportLabels.value,
  )
</script>

<template>
  <div class="tool-layout">
    <div class="tool-settings">
      <div class="panel">
        <div class="panel-heading"><h3>{{ t('settings') }}</h3><span class="small-badge">{{ t('live') }}</span></div>
        <div class="plan-grid">
          <div v-for="(plan, key) in { A: planA, B: planB }" :key="key" class="plan-block">
            <h4>{{ t('costPlan') }} {{ key }}</h4>
            <label class="field">{{ t('costPackaging') }}<input v-model.number="plan.materialPerUnit" type="number" min="0" step="0.1" /></label>
            <label class="field">{{ t('costLabor') }}<input v-model.number="plan.laborPerUnit" type="number" min="0" step="0.1" /></label>
            <label class="field">{{ t('costWastePct') }}<input v-model.number="plan.wastePct" type="number" min="0" max="100" step="0.1" /></label>
            <label class="field">{{ t('costStorage') }}<input v-model.number="plan.storage" type="number" min="0" step="1" /></label>
            <label class="field">{{ t('costShipping') }}<input v-model.number="plan.transport" type="number" min="0" step="1" /></label>
            <label class="field">{{ t('costTaxPct') }}<input v-model.number="plan.taxPct" type="number" min="0" max="100" step="0.1" /></label>
            <label class="field">{{ t('costMarkup') }}<input v-model.number="plan.markupPct" type="number" min="0" max="100" step="0.1" /></label>
            <label class="field">{{ t('currency') }}<input v-model="plan.currency" /></label>
          </div>
        </div>
        <p v-if="issuesA.length || issuesB.length" class="field-hint warn">{{ t('errCostPctRange') }} / {{ t('errCostCurrency') }}</p>
      </div>
      <div class="mini-panel">
        <span>$</span>
        <div><strong>{{ qty }} {{ t('items') }}</strong><p>{{ t('sharedDesc') }}</p></div>
        <button @click="emit('editCargo')">{{ t('edit') }} ↗</button>
      </div>
    </div>
    <div class="tool-output">
      <div class="panel output-panel">
        <div class="panel-heading"><h3>{{ t('results') }}</h3><span class="small-badge light">{{ t('autoUpdated') }}</span></div>
        <div class="metric-grid">
          <div class="metric primary"><span>{{ t('costCheaper') }}</span><strong>{{ comparison.cheaper === 'tie' ? t('costTie') : comparison.cheaper }}</strong></div>
          <div class="metric"><span>{{ t('costDeltaTotal') }}</span><strong>{{ format(Math.abs(comparison.deltaTotal)) }} {{ resultA.currency }}</strong></div>
        </div>
        <div class="compare-cards">
          <div v-for="(res, key) in { A: resultA, B: resultB }" :key="key" class="cost-card">
            <h4>{{ t('costPlan') }} {{ key }}</h4>
            <div class="cost-lines">
              <div><span>{{ t('linePackaging') }}</span><strong>{{ format(res.material) }}</strong></div>
              <div><span>{{ t('lineLabor') }}</span><strong>{{ format(res.labor) }}</strong></div>
              <div><span>{{ t('costWaste') }}</span><strong>{{ format(res.waste) }}</strong></div>
              <div><span>{{ t('costStorageLine') }}</span><strong>{{ format(res.storage) }}</strong></div>
              <div><span>{{ t('lineFreight') }}</span><strong>{{ format(res.transport) }}</strong></div>
              <div><span>{{ t('costTax') }}</span><strong>{{ format(res.tax) }}</strong></div>
              <div class="bold"><span>{{ t('subtotal') }}</span><strong>{{ format(res.costTotal) }}</strong></div>
              <div><span>{{ t('estimatedTotalMarkup') }}</span><strong>{{ format(res.markedUpTotal) }}</strong></div>
              <div><span>{{ t('costPerItem') }}</span><strong>{{ format(res.markedUpPerUnit, 4) }}</strong></div>
              <div><span>{{ t('costGrossMargin') }}</span><strong>{{ format(res.grossMarginPct) }}%</strong></div>
            </div>
          </div>
        </div>
        <div class="action-row">
          <button class="btn-secondary" @click="onExportCsv">{{ t('export') }}</button>
          <button class="btn-secondary" @click="onExportXlsx">{{ t('exportXlsx') }}</button>
        </div>
      </div>
      <div class="hint-box">ⓘ {{ t('disclaimer') }}</div>
    </div>
  </div>
</template>

<style scoped>
.plan-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.plan-block h4 { margin: 0 0 8px; font-size: 13px; }
.compare-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 12px; }
.cost-card { border: 1px solid var(--border, #e5e7eb); border-radius: 10px; padding: 12px; }
.action-row { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
.warn { color: #b45309; }
@media (max-width: 900px) {
  .plan-grid, .compare-cards { grid-template-columns: 1fr; }
}
</style>
