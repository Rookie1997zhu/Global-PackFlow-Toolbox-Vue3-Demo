<script setup lang="ts">
import { computed, inject, ref, type Ref } from 'vue'
import type { Locale } from '../../i18n'
import { useCargo } from '../../shared/cargo/useCargo'
import { formatNumber } from '../../shared/format/number'
import {
  exportDiffCsv,
  exportDiffXlsx,
  loadCheckerFile,
  matchCheckerRows,
  summarizeDiffs,
  type CheckerRow,
  type DiffRow,
} from './useChecker'

const props = defineProps<{ t: (key: string) => string }>()
const emit = defineEmits<{ editCargo: [] }>()

const hostLocale = inject<Ref<Locale>>('hostLocale', ref('en'))
const { qty, gross, goodsValue } = useCargo()
const format = (v: number, d = 2) => formatNumber(v, hostLocale.value, d)

const expected = ref<CheckerRow[]>([])
const actual = ref<CheckerRow[]>([])
const expectedError = ref('')
const actualError = ref('')
const expectedInput = ref<HTMLInputElement | null>(null)
const actualInput = ref<HTMLInputElement | null>(null)

const diffs = computed<DiffRow[]>(() => matchCheckerRows(expected.value, actual.value))
const summary = computed(() => summarizeDiffs(diffs.value))

const onLoad = async (side: 'expected' | 'actual', e: Event) => {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  const result = await loadCheckerFile(file, side)
  if (side === 'expected') {
    expectedError.value = result.errorCode ? props.t(result.errorCode) : ''
    expected.value = result.rows
  } else {
    actualError.value = result.errorCode ? props.t(result.errorCode) : ''
    actual.value = result.rows
  }
}

const seedFromCargo = () => {
  const rows: CheckerRow[] = [
    {
      key: 'sku::sample-total',
      sku: 'SAMPLE-TOTAL',
      carton: '',
      qty: qty.value,
      weight: gross.value,
      amount: goodsValue.value,
      unit: 'PCS',
      source: 'expected',
      rawIndex: 1,
    },
  ]
  expected.value = rows
  actual.value = rows.map((r) => ({ ...r, source: 'actual' as const }))
  expectedError.value = ''
  actualError.value = ''
}

const labels = computed(() => ({
  key: 'Key',
  sku: props.t('colSku'),
  carton: props.t('csvCarton'),
  kind: 'Kind',
  expected: props.t('expected'),
  actual: props.t('declared'),
  message: 'Message',
}))
</script>

<template>
  <div class="tool-layout">
    <div class="tool-settings">
      <div class="panel">
        <div class="panel-heading"><h3>{{ t('settings') }}</h3><span class="small-badge">{{ t('live') }}</span></div>
        <p class="field-hint">{{ t('checkerImportHint') }}</p>
        <button class="btn-secondary full" @click="expectedInput?.click()">{{ t('importExpected') }}</button>
        <input ref="expectedInput" type="file" accept=".csv,.xlsx,.xls" hidden @change="onLoad('expected', $event)" />
        <button class="btn-secondary full" @click="actualInput?.click()">{{ t('importActual') }}</button>
        <input ref="actualInput" type="file" accept=".csv,.xlsx,.xls" hidden @change="onLoad('actual', $event)" />
        <button class="btn-secondary full" @click="seedFromCargo">{{ t('matchComputed') }}</button>
        <p v-if="expectedError" class="field-hint warn">{{ expectedError }}</p>
        <p v-if="actualError" class="field-hint warn">{{ actualError }}</p>
        <p class="field-hint">{{ t('expected') }}: {{ expected.length }} · {{ t('declared') }}: {{ actual.length }}</p>
      </div>
      <div class="mini-panel">
        <span>✓</span>
        <div><strong>{{ qty }} {{ t('items') }} · {{ format(gross) }} kg</strong><p>{{ t('sharedDesc') }}</p></div>
        <button @click="emit('editCargo')">{{ t('edit') }} ↗</button>
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
            <span>
              <template v-if="d.expectedQty !== undefined || d.actualQty !== undefined">
                {{ t('quantity') }} {{ d.expectedQty ?? '-' }} / {{ d.actualQty ?? '-' }}
              </template>
              <template v-if="d.expectedWeight !== undefined || d.actualWeight !== undefined">
                · {{ t('weight') }} {{ d.expectedWeight ?? '-' }} / {{ d.actualWeight ?? '-' }}
              </template>
              <template v-if="d.expectedAmount !== undefined || d.actualAmount !== undefined">
                · {{ t('price') }} {{ d.expectedAmount ?? '-' }} / {{ d.actualAmount ?? '-' }}
              </template>
              <template v-if="d.expectedUnit || d.actualUnit">
                · {{ d.expectedUnit || '-' }} / {{ d.actualUnit || '-' }}
              </template>
            </span>
          </div>
          <p v-if="!diffs.length" class="field-hint">{{ t('checkerEmpty') }}</p>
        </div>
        <div class="action-row">
          <button class="btn-secondary" :disabled="!diffs.length" @click="exportDiffCsv(diffs, labels)">{{ t('export') }}</button>
          <button class="btn-secondary" :disabled="!diffs.length" @click="exportDiffXlsx(diffs, labels)">{{ t('exportXlsx') }}</button>
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
