<script setup lang="ts">
import { computed, inject, reactive, ref, type Ref } from 'vue'
import type { Locale } from '../../i18n'
import { useCargo } from '../../shared/cargo/useCargo'
import { formatNumber } from '../../shared/format/number'
import { computeCbmTotals, type RoundingRule } from '../cbm-calculator/useCbm'
import {
  compareFreight,
  defaultFreightConfigs,
  exportFreightCsv,
  exportFreightPdf,
  type FreightRateConfig,
} from './useFreight'

const props = defineProps<{
  t: (key: string) => string
}>()

const emit = defineEmits<{ editCargo: [] }>()

const hostLocale = inject<Ref<Locale>>('hostLocale', ref('en'))
const { cargo, qty, cbm } = useCargo()

const dimDivisor = ref(6000)
const rounding = ref<RoundingRule>('none')
const rates = ref<FreightRateConfig[]>(defaultFreightConfigs())
const pdfBusy = ref(false)
const displayCurrency = ref('USD')
const fxAsOf = ref(new Date().toISOString().slice(0, 10))
const ratesToDisplay = reactive<Record<string, number>>({
  USD: 1,
  EUR: 1.08,
})

const format = (v: number, d = 2) => formatNumber(v, hostLocale.value, d)

const cbmTotals = computed(() => computeCbmTotals(cargo.value, dimDivisor.value, rounding.value))
const comparison = computed(() =>
  compareFreight(rates.value, cbmTotals.value.chargeableKg, cbmTotals.value.cbm, rounding.value, {
    displayCurrency: displayCurrency.value,
    ratesToDisplay: { ...ratesToDisplay },
    fxAsOf: fxAsOf.value,
  }),
)

const usedCurrencies = computed(() => {
  const set = new Set(rates.value.map((r) => String(r.currency || 'USD').trim().toUpperCase() || 'USD'))
  set.add(String(displayCurrency.value || 'USD').trim().toUpperCase() || 'USD')
  return [...set]
})

const updateRate = <K extends keyof FreightRateConfig>(index: number, key: K, value: FreightRateConfig[K]) => {
  const next = [...rates.value]
  next[index] = { ...next[index], [key]: value }
  rates.value = next
  if (key === 'currency') {
    const code = String(value || 'USD').trim().toUpperCase() || 'USD'
    if (ratesToDisplay[code] === undefined) ratesToDisplay[code] = code === displayCurrency.value ? 1 : 0
  }
}

const exportCsv = () => {
  exportFreightCsv(
    comparison.value,
    {
      chargeableKg: cbmTotals.value.chargeableKg,
      cbm: cbmTotals.value.cbm,
      rounding: rounding.value,
      disclaimer: props.t('freightSimDisclaimer'),
    },
    {
      mode: props.t('freightMode'),
      total: props.t('freightTotal'),
      converted: props.t('freightConverted'),
      delta: props.t('freightDelta'),
      currency: props.t('currency'),
      eta: props.t('freightEta'),
      rate: props.t('freightRate'),
      billable: props.t('freightBillable'),
      minCharge: props.t('freightMinCharge'),
      fixedFee: props.t('freightFixedFee'),
      surcharge: props.t('freightPercentSurcharge'),
      chargeable: props.t('chargeableWeight'),
      volume: props.t('totalCbm'),
      rounding: props.t('roundingRule'),
      note: props.t('note'),
      displayCurrency: props.t('freightDisplayCurrency'),
    },
    props.t,
  )
}

const exportPdf = async () => {
  pdfBusy.value = true
  try {
    await exportFreightPdf(
      comparison.value,
      {
        chargeableKg: cbmTotals.value.chargeableKg,
        cbm: cbmTotals.value.cbm,
        rounding: rounding.value,
        disclaimer: props.t('freightSimDisclaimer'),
        title: props.t('freightPdfTitle'),
      },
      props.t,
    )
  } finally {
    pdfBusy.value = false
  }
}
</script>

<template>
  <div class="tool-layout">
    <div class="tool-settings">
      <div class="panel">
        <div class="panel-heading">
          <h3>{{ t('settings') }}</h3>
          <span class="small-badge">{{ t('live') }}</span>
        </div>
        <label class="field">
          {{ t('dimDivisor') }}
          <select v-model.number="dimDivisor">
            <option :value="5000">5000</option>
            <option :value="6000">6000</option>
            <option :value="4000">4000</option>
          </select>
        </label>
        <label class="field">
          {{ t('roundingRule') }}
          <select v-model="rounding">
            <option value="none">{{ t('roundNone') }}</option>
            <option value="round">{{ t('roundNearest') }}</option>
            <option value="ceil">{{ t('roundCeil') }}</option>
          </select>
        </label>
        <label class="field">
          {{ t('freightDisplayCurrency') }}
          <input v-model="displayCurrency" />
        </label>
        <label class="field">
          {{ t('freightFxAsOf') }}
          <input v-model="fxAsOf" type="date" />
        </label>
        <div v-for="code in usedCurrencies" :key="code" class="field">
          <label>
            {{ t('freightFxRate') }} (1 {{ code }} → {{ displayCurrency }})
            <input
              :value="ratesToDisplay[code] ?? (code.toUpperCase() === displayCurrency.toUpperCase() ? 1 : 0)"
              type="number"
              min="0"
              step="0.0001"
              @change="ratesToDisplay[code] = Number(($event.target as HTMLInputElement).value)"
            />
          </label>
        </div>
        <p v-if="!comparison.comparable" class="field-hint warn">{{ t('freightFxMissing') }}</p>
        <p class="field-hint">{{ t('freightSimDisclaimer') }}</p>

        <div v-for="(rate, i) in rates" :key="rate.id" style="margin-top: 14px; padding-top: 12px; border-top: 1px solid #e5ebf1">
          <strong style="display:block;margin-bottom:8px;color:#0d526d">{{ t(rate.labelKey) }}</strong>
          <label class="field">
            {{ t('freightRate') }}
            <input
              :value="rate.rate"
              type="number"
              min="0"
              step="0.1"
              @change="updateRate(i, 'rate', Number(($event.target as HTMLInputElement).value))"
            />
          </label>
          <label class="field">
            {{ t('freightMinCharge') }}
            <input
              :value="rate.minCharge"
              type="number"
              min="0"
              step="0.1"
              @change="updateRate(i, 'minCharge', Number(($event.target as HTMLInputElement).value))"
            />
          </label>
          <label class="field">
            {{ t('freightFixedFee') }}
            <input
              :value="rate.fixedFee"
              type="number"
              min="0"
              step="0.1"
              @change="updateRate(i, 'fixedFee', Number(($event.target as HTMLInputElement).value))"
            />
          </label>
          <label class="field">
            {{ t('freightPercentSurcharge') }}
            <input
              :value="rate.percentSurcharge"
              type="number"
              min="0"
              step="0.1"
              @change="updateRate(i, 'percentSurcharge', Number(($event.target as HTMLInputElement).value))"
            />
          </label>
          <label class="field">
            {{ t('currency') }}
            <input
              :value="rate.currency"
              @change="updateRate(i, 'currency', ($event.target as HTMLInputElement).value)"
            />
          </label>
          <label class="field">
            {{ t('freightEta') }}
            <input
              :value="rate.etaDays"
              type="number"
              min="0"
              step="1"
              @change="updateRate(i, 'etaDays', Number(($event.target as HTMLInputElement).value))"
            />
          </label>
        </div>

        <div class="btn-row" style="margin-top: 14px; flex-wrap: wrap; gap: 8px">
          <button class="btn-secondary" type="button" @click="exportCsv">{{ t('export') }}</button>
          <button class="btn-primary" type="button" :disabled="pdfBusy" @click="exportPdf">
            {{ pdfBusy ? t('exporting') : t('exportPdf') }}
          </button>
        </div>
      </div>
      <div class="mini-panel">
        <span>▤</span>
        <div>
          <strong>{{ qty }} {{ t('items') }} · {{ format(cbm, 3) }} m³</strong>
          <p>{{ t('sharedDesc') }}</p>
        </div>
        <button type="button" @click="emit('editCargo')">{{ t('edit') }} ↗</button>
      </div>
    </div>
    <div class="tool-output">
      <div class="panel output-panel">
        <div class="panel-heading">
          <h3>{{ t('results') }}</h3>
          <span class="small-badge light">{{ t('autoUpdated') }}</span>
        </div>
        <div class="metric-grid">
          <div class="metric primary">
            <span>{{ t('chargeableWeight') }}</span>
            <strong>{{ format(cbmTotals.chargeableKg) }}<small> kg</small></strong>
          </div>
          <div class="metric">
            <span>{{ t('totalVolume') }}</span>
            <strong>{{ format(cbmTotals.cbm, 3) }}<small> m³</small></strong>
          </div>
          <div class="metric">
            <span>{{ t('freightCheapest') }}</span>
            <strong>{{ comparison.cheapestId ? t(comparison.options.find((o) => o.id === comparison.cheapestId)?.labelKey || '') : t('freightNoCheapest') }}</strong>
          </div>
        </div>
        <p class="field-hint">{{ t('freightSimDisclaimer') }}</p>
        <div class="freight-list">
          <div
            v-for="o in comparison.options"
            :key="o.id"
            :class="{ cheapest: comparison.comparable && o.id === comparison.cheapestId }"
          >
            <div>
              <strong>{{ t(o.labelKey) }} <span v-if="comparison.comparable && o.id === comparison.cheapestId">★</span></strong>
              <small>
                {{ t('illustrativeEstimate') }}
                · {{ t('freightEta') }} {{ o.etaDays }}d
                · Δ
                <template v-if="o.deltaFromCheapest === null">n/a</template>
                <template v-else>{{ comparison.displayCurrency }} {{ format(o.deltaFromCheapest) }}</template>
              </small>
              <small style="display:block;margin-top:4px">
                {{ t('freightBillable') }} {{ format(o.billableQty, 3) }}
                · {{ t('freightMinCharge') }} {{ format(o.minCharge) }}
                · {{ t('freightFixedFee') }} {{ format(o.fixedFee) }}
                · {{ t('freightPercentSurcharge') }} {{ format(o.percentSurcharge, 1) }}%
              </small>
              <small v-if="o.convertedTotal !== null" style="display:block;margin-top:2px">
                {{ t('freightConverted') }}: {{ comparison.displayCurrency }} {{ format(o.convertedTotal) }}
              </small>
            </div>
            <strong>{{ o.currency }} {{ format(o.total) }}</strong>
          </div>
        </div>
      </div>
      <div class="hint-box">ⓘ {{ t('disclaimer') }}</div>
    </div>
  </div>
</template>

<style scoped>
.warn { color: #b45309; }
.freight-list .cheapest {
  outline: 1px solid #0d8a7d;
  background: #f3fbfa;
  border-radius: 10px;
  padding: 8px;
}
</style>
