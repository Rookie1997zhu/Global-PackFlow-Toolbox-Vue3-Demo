<script setup lang="ts">
import { computed, inject, ref, watch, type Ref } from 'vue'
import type { Locale } from '../../i18n'
import { useCargo } from '../../shared/cargo/useCargo'
import { formatNumber } from '../../shared/format/number'
import {
  computePackingTotals,
  exportPackingCsv,
  exportPackingPdf,
  exportPackingXlsx,
  lineCbm,
  packingFromCargo,
  validatePackingLines,
  type PackingLine,
  cartonCountOf,
} from './usePacking'

const props = defineProps<{ t: (key: string) => string }>()
const emit = defineEmits<{ editCargo: [] }>()

const hostLocale = inject<Ref<Locale>>('hostLocale', ref('en'))
const { cargo } = useCargo()
const format = (v: number, d = 2) => formatNumber(v, hostLocale.value, d)

const shipper = ref('YOUR COMPANY')
const consignee = ref('CUSTOMER NAME')
const po = ref('PO-2026-001')
const lines = ref<PackingLine[]>(packingFromCargo(cargo.value))

watch(
  cargo,
  (rows) => {
    lines.value = packingFromCargo(rows)
  },
  { deep: true },
)

const totals = computed(() => computePackingTotals(lines.value))
const issues = computed(() => validatePackingLines(lines.value))

const labels = computed(() => ({
  shipper: props.t('shipper'),
  consignee: props.t('consignee'),
  po: props.t('poLabel'),
  sku: props.t('colSku'),
  cartonFrom: props.t('cartonFrom'),
  cartonTo: props.t('cartonTo'),
  cartons: props.t('cartonCount'),
  qtyPerCarton: props.t('qtyPerCarton'),
  gross: props.t('colGrossKg'),
  net: props.t('netKg'),
  l: props.t('lengthCm'),
  w: props.t('widthCm'),
  h: props.t('heightCm'),
  cbm: props.t('colCbm'),
  total: props.t('total'),
}))

const syncFromCargo = () => {
  lines.value = packingFromCargo(cargo.value)
}

const addLine = () => {
  const last = lines.value[lines.value.length - 1]
  const nextFrom = last ? Number(last.cartonTo) + 1 : 1
  lines.value.push({
    id: `pl-new-${Date.now()}`,
    sku: `SKU-${lines.value.length + 1}`,
    cartonFrom: nextFrom,
    cartonTo: nextFrom,
    qtyPerCarton: 1,
    grossKg: 1,
    netKg: 0.9,
    lengthCm: 40,
    widthCm: 30,
    heightCm: 20,
  })
}

const removeLine = (index: number) => {
  lines.value.splice(index, 1)
}
</script>

<template>
  <div class="tool-layout">
    <div class="tool-settings">
      <div class="panel">
        <div class="panel-heading"><h3>{{ t('settings') }}</h3><span class="small-badge">{{ t('live') }}</span></div>
        <label class="field">{{ t('shipper') }}<input v-model="shipper" /></label>
        <label class="field">{{ t('consignee') }}<input v-model="consignee" /></label>
        <label class="field">{{ t('poNumber') }}<input v-model="po" /></label>
        <button class="btn-secondary full" @click="syncFromCargo">{{ t('syncFromCargo') }}</button>
        <button class="btn-secondary full" @click="addLine">{{ t('add') }}</button>
        <p v-if="issues.length" class="field-hint warn">{{ issues.map((c) => t(c)).join(' · ') }}</p>
      </div>
      <div class="mini-panel">
        <span>☷</span>
        <div><strong>{{ totals.cartonCount }} {{ t('cartons') }} · {{ format(totals.cbm, 3) }} m³</strong><p>{{ t('sharedDesc') }}</p></div>
        <button @click="emit('editCargo')">{{ t('edit') }} ↗</button>
      </div>
    </div>
    <div class="tool-output">
      <div class="panel output-panel">
        <div class="panel-heading"><h3>{{ t('results') }}</h3><span class="small-badge light">{{ t('autoUpdated') }}</span></div>
        <div class="print-area">
          <div class="document-top">{{ t('packingList') }}</div>
          <div class="doc-meta">
            <span>{{ t('shipper') }}: {{ shipper }}</span>
            <span>{{ t('consignee') }}: {{ consignee }}</span>
            <span>{{ t('poLabel') }}: {{ po }}</span>
          </div>
          <div class="metric-grid">
            <div class="metric primary"><span>{{ t('cartonCount') }}</span><strong>{{ totals.cartonCount }}</strong></div>
            <div class="metric"><span>{{ t('quantity') }}</span><strong>{{ totals.totalQty }}</strong></div>
            <div class="metric"><span>{{ t('colGrossKg') }}</span><strong>{{ format(totals.grossKg) }}</strong></div>
            <div class="metric"><span>{{ t('colCbm') }}</span><strong>{{ format(totals.cbm, 3) }}</strong></div>
          </div>
          <div class="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>{{ t('colSku') }}</th>
                  <th>{{ t('cartonFrom') }}</th>
                  <th>{{ t('cartonTo') }}</th>
                  <th>{{ t('qtyPerCarton') }}</th>
                  <th>{{ t('colGrossKg') }}</th>
                  <th>{{ t('netKg') }}</th>
                  <th>L</th><th>W</th><th>H</th>
                  <th>{{ t('colCbm') }}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(line, i) in lines" :key="line.id">
                  <td><input v-model="line.sku" /></td>
                  <td><input v-model.number="line.cartonFrom" type="number" min="1" /></td>
                  <td><input v-model.number="line.cartonTo" type="number" min="1" /></td>
                  <td><input v-model.number="line.qtyPerCarton" type="number" min="1" /></td>
                  <td><input v-model.number="line.grossKg" type="number" min="0" step="0.1" /></td>
                  <td><input v-model.number="line.netKg" type="number" min="0" step="0.1" /></td>
                  <td><input v-model.number="line.lengthCm" type="number" min="0" /></td>
                  <td><input v-model.number="line.widthCm" type="number" min="0" /></td>
                  <td><input v-model.number="line.heightCm" type="number" min="0" /></td>
                  <td>{{ format(lineCbm(line), 3) }} <small>×{{ cartonCountOf(line) }}</small></td>
                  <td><button class="linkish" @click="removeLine(i)">×</button></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <div class="action-row">
          <button class="btn-secondary" @click="exportPackingCsv(lines, { shipper, consignee, po }, labels)">{{ t('export') }}</button>
          <button class="btn-secondary" @click="exportPackingXlsx(lines, { shipper, consignee, po }, labels)">{{ t('exportXlsx') }}</button>
          <button class="btn-primary" @click="exportPackingPdf(lines, { shipper, consignee, po, title: t('packingList') })">{{ t('exportPdf') }}</button>
        </div>
      </div>
      <div class="hint-box">ⓘ {{ t('disclaimer') }}</div>
    </div>
  </div>
</template>

<style scoped>
.action-row { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
.table-scroll input { width: 72px; max-width: 100%; }
.warn { color: #b45309; }
.linkish { border: 0; background: transparent; cursor: pointer; font-size: 16px; }
</style>
