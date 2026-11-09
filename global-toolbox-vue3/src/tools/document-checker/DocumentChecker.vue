<script setup lang="ts">
import { computed, inject, ref, type Ref } from 'vue'
import type { Locale } from '../../i18n'
import { useCargo } from '../../shared/cargo/useCargo'
import { formatNumber } from '../../shared/format/number'
import SheetImportPanel from '../../shared/import/SheetImportPanel.vue'
import type { MappedRow } from '../../shared/import/sheetMapping'
import {
  exportDiffCsv,
  exportDiffPdf,
  exportDiffXlsx,
  loadSampleCsv,
  mappedToCheckerRows,
  matchCheckerRows,
  parseCheckerTable,
  summarizeDiffs,
  type CheckerRow,
  type DiffRow,
  type MatchKeyMode,
} from './useChecker'

const props = defineProps<{ t: (key: string) => string }>()
const emit = defineEmits<{ editCargo: [] }>()

const hostLocale = inject<Ref<Locale>>('hostLocale', ref('en'))
const { qty, gross, goodsValue } = useCargo()
const format = (v: number, d = 2) => formatNumber(v, hostLocale.value, d)

const matchMode = ref<MatchKeyMode>('sku+carton')
const expected = ref<CheckerRow[]>([])
const actual = ref<CheckerRow[]>([])
const loadError = ref('')
const pdfBusy = ref(false)

const diffs = computed<DiffRow[]>(() => matchCheckerRows(expected.value, actual.value, matchMode.value))
const summary = computed(() => summarizeDiffs(diffs.value))

const onExpectedApplied = (rows: MappedRow[]) => {
  expected.value = mappedToCheckerRows(rows, 'expected', matchMode.value)
}
const onActualApplied = (rows: MappedRow[]) => {
  actual.value = mappedToCheckerRows(rows, 'actual', matchMode.value)
}

const loadDemo = async () => {
  loadError.value = ''
  try {
    const [expTable, actTable] = await Promise.all([
      loadSampleCsv('/samples/kr-expected.csv'),
      loadSampleCsv('/samples/kr-actual.csv'),
    ])
    expected.value = parseCheckerTable(expTable, 'expected', matchMode.value).rows
    actual.value = parseCheckerTable(actTable, 'actual', matchMode.value).rows
  } catch (err) {
    loadError.value = err instanceof Error ? err.message : String(err)
  }
}

const seedFromCargo = () => {
  const rows: CheckerRow[] = [
    {
      key: 'sku::sample-total',
      sku: 'SAMPLE-TOTAL',
      carton: '',
      po: '',
      qty: qty.value,
      weight: gross.value,
      netKg: 0,
      amount: goodsValue.value,
      unit: 'PCS',
      source: 'expected',
      rawIndex: 1,
    },
  ]
  expected.value = rows
  actual.value = rows.map((r) => ({ ...r, source: 'actual' as const }))
}

const labels = computed(() => ({
  key: 'Key',
  sku: props.t('colSku'),
  carton: props.t('csvCarton'),
  po: props.t('poLabel'),
  kind: 'Kind',
  expected: props.t('expected'),
  actual: props.t('declared'),
  message: 'Message',
  fixHint: props.t('fixHint'),
  expectedRow: props.t('expectedRow'),
  actualRow: props.t('actualRow'),
}))

const exportPdf = async () => {
  pdfBusy.value = true
  try {
    await exportDiffPdf(diffs.value, props.t('diffReportTitle'))
  } finally {
    pdfBusy.value = false
  }
}
</script>

<template>
  <div class="tool-layout">
    <div class="tool-settings">
      <div class="panel">
        <div class="panel-heading"><h3>{{ t('settings') }}</h3><span class="small-badge">{{ t('live') }}</span></div>
        <label class="field">
          {{ t('matchKeyMode') }}
          <select v-model="matchMode">
            <option value="sku+carton">{{ t('matchSkuCarton') }}</option>
            <option value="sku">{{ t('matchSku') }}</option>
            <option value="carton">{{ t('matchCarton') }}</option>
            <option value="po+sku">{{ t('matchPoSku') }}</option>
          </select>
        </label>
        <p class="field-hint">{{ t('checkerImportHint') }}</p>
        <button class="btn-secondary full" type="button" @click="loadDemo">{{ t('loadDiffDemo') }}</button>
        <button class="btn-secondary full" type="button" @click="seedFromCargo">{{ t('matchComputed') }}</button>
        <p v-if="loadError" class="field-hint warn">{{ loadError }}</p>
        <p class="field-hint">{{ t('expected') }}: {{ expected.length }} · {{ t('declared') }}: {{ actual.length }}</p>

        <div style="margin-top: 14px; padding-top: 12px; border-top: 1px solid #e5ebf1">
          <SheetImportPanel :t="t" :title="t('importExpected')" @applied="onExpectedApplied" />
        </div>
        <div style="margin-top: 14px; padding-top: 12px; border-top: 1px solid #e5ebf1">
          <SheetImportPanel :t="t" :title="t('importActual')" @applied="onActualApplied" />
        </div>
      </div>
      <div class="mini-panel">
        <span>✓</span>
        <div><strong>{{ qty }} {{ t('items') }} · {{ format(gross) }} kg</strong><p>{{ t('sharedDesc') }}</p></div>
        <button type="button" @click="emit('editCargo')">{{ t('edit') }} ↗</button>
      </div>
    </div>
    <div class="tool-output">
      <div class="panel output-panel">
        <div class="panel-heading"><h3>{{ t('results') }}</h3><span class="small-badge light">{{ t('autoUpdated') }}</span></div>
        <div class="metric-grid">
          <div class="metric primary"><span>{{ t('checksPassed') }}</span><strong>{{ summary.passed }}<small> / {{ summary.totalKeys }}</small></strong></div>
          <div class="metric"><span>{{ t('checksFailed') }}</span><strong>{{ summary.failed }}</strong></div>
        </div>
        <div class="audit-list">
          <div v-for="(d, i) in diffs" :key="d.key + d.kind + i" :class="d.kind === 'ok' ? 'pass' : 'fail'">
            <span>{{ d.kind === 'ok' ? '✓' : '!' }} {{ t(d.messageCode) }} · {{ d.sku || d.carton || d.key }}</span>
            <span>{{ d.fixHint }}</span>
          </div>
          <p v-if="!diffs.length" class="field-hint">{{ t('checkerEmpty') }}</p>
        </div>
        <div class="action-row">
          <button class="btn-secondary" type="button" :disabled="!diffs.length" @click="exportDiffCsv(diffs, labels)">{{ t('export') }}</button>
          <button class="btn-secondary" type="button" :disabled="!diffs.length" @click="exportDiffXlsx(diffs, labels)">{{ t('exportXlsx') }}</button>
          <button class="btn-primary" type="button" :disabled="!diffs.length || pdfBusy" @click="exportPdf">
            {{ pdfBusy ? t('exporting') : t('exportPdf') }}
          </button>
        </div>
        <p class="field-hint">{{ t('auditHint') }}</p>
      </div>
      <div class="hint-box">ⓘ {{ t('disclaimer') }}</div>
    </div>
  </div>
</template>

<style scoped>
.action-row { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
.warn { color: #b45309; }
</style>
