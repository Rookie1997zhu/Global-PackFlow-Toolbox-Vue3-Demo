<script setup lang="ts">
import { computed, inject, onBeforeUnmount, ref, watch, type Ref } from 'vue'
import type { Locale } from '../../i18n'
import { formatNumber } from '../../shared/format/number'
import { createNestingRunner } from './runNestingAsync'
import {
  buildNestingSvg,
  createSampleParts,
  exportNestingCsv,
  exportNestingSvg,
  runNesting,
  type NestingPartSpec,
  type NestingResult,
  type NestingStrategy,
} from './useNesting'

const props = defineProps<{
  t: (key: string) => string
}>()

const hostLocale = inject<Ref<Locale>>('hostLocale', ref('en'))
const format = (v: number, d = 2) => formatNumber(v, hostLocale.value, d)

const sheetWidth = ref(1200)
const sheetHeight = ref(900)
const margin = ref(10)
const kerf = ref(5)
const strategy = ref<NestingStrategy>('maxrects')
const parts = ref<NestingPartSpec[]>(createSampleParts())
const result = ref<NestingResult | null>(null)
const errorKey = ref('')
const busy = ref(false)
const activeSheet = ref(0)

const runner = createNestingRunner()

const svgMarkup = computed(() => {
  if (!result.value || result.value.sheetCount === 0) return ''
  return buildNestingSvg(result.value, activeSheet.value)
    .replace(/^<\?xml[^>]*>\s*/i, '')
    .replace('<svg ', '<svg style="max-width:100%;height:auto;display:block" ')
})

const strategyLabel = computed(() =>
  strategy.value === 'guillotine' ? props.t('strategyGuillotine') : props.t('strategyMaxRects'),
)

const addPart = () => {
  const n = parts.value.length + 1
  parts.value.push({
    id: `p${Date.now()}`,
    name: `Part ${n}`,
    width: 200,
    height: 150,
    qty: 4,
    allowRotate: true,
  })
}

const removePart = (index: number) => {
  parts.value.splice(index, 1)
}

const resetParts = () => {
  parts.value = createSampleParts()
}

const run = async () => {
  errorKey.value = ''
  busy.value = true
  runner.cancel()
  const input = {
    sheetWidth: sheetWidth.value,
    sheetHeight: sheetHeight.value,
    margin: margin.value,
    kerf: kerf.value,
    strategy: strategy.value,
    parts: parts.value.map((p) => ({ ...p })),
  }
  const instanceCount = input.parts.reduce((s, p) => s + Math.max(0, Math.floor(Number(p.qty) || 0)), 0)
  try {
    const out =
      instanceCount > 800
        ? await runner.run(input)
        : runNesting(input)
    if ('error' in out) {
      if (out.error === 'errNestingCancelled') return
      result.value = null
      errorKey.value = out.error
      return
    }
    result.value = out
    activeSheet.value = 0
  } catch (err) {
    result.value = null
    errorKey.value = err instanceof Error ? err.message : 'errNestingFailed'
  } finally {
    busy.value = false
  }
}

const cancel = () => {
  runner.cancel()
  busy.value = false
  errorKey.value = 'errNestingCancelled'
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null
const scheduleRun = () => {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    void run()
  }, 180)
}

watch([sheetWidth, sheetHeight, margin, kerf, strategy, parts], scheduleRun, { deep: true, immediate: true })

onBeforeUnmount(() => {
  if (debounceTimer) clearTimeout(debounceTimer)
  runner.dispose()
})

const exportCsv = () => {
  if (!result.value) return
  exportNestingCsv(
    result.value,
    {
      strategy: props.t('nestingStrategy'),
      sheets: props.t('sheetsNeeded'),
      util: props.t('nestingUtilization'),
      waste: props.t('nestingWaste'),
      part: props.t('nestingPartName'),
      required: props.t('partsRequired'),
      placed: props.t('nestingPlaced'),
      sheet: props.t('nestingSheetNo'),
      x: 'X',
      y: 'Y',
      w: props.t('width'),
      h: props.t('height'),
      rotated: props.t('orientation'),
      unplaced: props.t('nestingUnplaced'),
      reason: props.t('nestingReason'),
    },
    strategyLabel.value,
  )
}

const exportSvg = () => {
  if (!result.value) return
  exportNestingSvg(result.value, activeSheet.value)
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
          {{ t('sheetWidth') }}
          <input v-model.number="sheetWidth" type="number" min="1" />
        </label>
        <label class="field">
          {{ t('sheetHeight') }}
          <input v-model.number="sheetHeight" type="number" min="1" />
        </label>
        <label class="field">
          {{ t('nestingMargin') }}
          <input v-model.number="margin" type="number" min="0" />
        </label>
        <label class="field">
          {{ t('gapMm') }}
          <input v-model.number="kerf" type="number" min="0" />
        </label>
        <label class="field">
          {{ t('nestingStrategy') }}
          <select v-model="strategy">
            <option value="maxrects">{{ t('strategyMaxRects') }}</option>
            <option value="guillotine">{{ t('strategyGuillotine') }}</option>
          </select>
        </label>
        <p class="field-hint">{{ t('nestingHint') }}</p>

        <div class="panel-heading" style="margin-top: 12px">
          <h3>{{ t('nestingParts') }}</h3>
          <div class="btn-row">
            <button class="btn-secondary" type="button" @click="resetParts">{{ t('reset') }}</button>
            <button class="btn-primary" type="button" @click="addPart">+ {{ t('add') }}</button>
          </div>
        </div>
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{{ t('nestingPartName') }}</th>
                <th>{{ t('width') }}</th>
                <th>{{ t('height') }}</th>
                <th>{{ t('colQty') }}</th>
                <th>{{ t('allowRotate') }}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(p, i) in parts" :key="p.id">
                <td><input v-model="p.name" class="cell-name" /></td>
                <td><input v-model.number="p.width" type="number" min="1" /></td>
                <td><input v-model.number="p.height" type="number" min="1" /></td>
                <td><input v-model.number="p.qty" type="number" min="0" step="1" /></td>
                <td><input v-model="p.allowRotate" type="checkbox" /></td>
                <td><button class="remove" type="button" @click="removePart(i)">×</button></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="btn-row" style="margin-top: 12px; flex-wrap: wrap; gap: 8px">
          <button class="btn-primary" type="button" :disabled="busy" @click="run">
            {{ busy ? t('nestingRunning') : t('run') }}
          </button>
          <button class="btn-secondary" type="button" :disabled="!busy" @click="cancel">{{ t('nestingCancel') }}</button>
        </div>
        <p v-if="errorKey" class="field-hint" style="color:#b42318">{{ t(errorKey) }}</p>
      </div>
    </div>

    <div class="tool-output">
      <div class="panel output-panel">
        <div class="panel-heading">
          <h3>{{ t('results') }}</h3>
          <span class="small-badge light">{{ busy ? t('nestingRunning') : t('autoUpdated') }}</span>
        </div>

        <template v-if="result">
          <div class="metric-grid">
            <div class="metric primary">
              <span>{{ t('sheetsNeeded') }}</span>
              <strong>{{ result.sheetCount || '—' }}</strong>
            </div>
            <div class="metric">
              <span>{{ t('nestingUtilization') }}</span>
              <strong>{{ format(result.utilizationPct, 1) }}<small> %</small></strong>
            </div>
            <div class="metric">
              <span>{{ t('nestingWaste') }}</span>
              <strong>{{ format(result.wasteArea, 0) }}<small> mm²</small></strong>
            </div>
            <div class="metric">
              <span>{{ t('nestingStrategy') }}</span>
              <strong style="font-size:14px">{{ strategyLabel }}</strong>
            </div>
          </div>

          <div v-if="result.sheetCount > 1" class="btn-row" style="margin: 10px 0; flex-wrap: wrap; gap: 6px">
            <button
              v-for="i in result.sheetCount"
              :key="i"
              class="btn-secondary"
              type="button"
              :style="activeSheet === i - 1 ? { outline: '2px solid #0e7490' } : undefined"
              @click="activeSheet = i - 1"
            >
              {{ t('nestingSheetNo') }} {{ i }}
            </button>
          </div>

          <div class="nesting-wrap" style="overflow:auto;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:10px">
            <div v-if="svgMarkup" v-html="svgMarkup" style="max-width:100%;line-height:0" />
            <p v-else class="field-hint">{{ t('nestingNoPlacement') }}</p>
          </div>

          <div class="table-scroll" style="margin-top:12px">
            <table>
              <thead>
                <tr>
                  <th>{{ t('nestingPartName') }}</th>
                  <th>{{ t('partsRequired') }}</th>
                  <th>{{ t('nestingPlaced') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="p in result.partSummaries" :key="p.partId">
                  <td>{{ p.name }}</td>
                  <td>{{ p.required }}</td>
                  <td>{{ p.placed }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div v-if="result.unplaced.length" class="alert" style="margin-top:12px">
            ⚠ {{ t('nestingUnplaced') }}: {{ result.unplaced.length }}
          </div>

          <div class="btn-row" style="margin-top:12px;flex-wrap:wrap;gap:8px">
            <button class="btn-secondary" type="button" @click="exportCsv">{{ t('export') }}</button>
            <button class="btn-secondary" type="button" :disabled="!result.sheetCount" @click="exportSvg">
              {{ t('exportSvg') }}
            </button>
          </div>
        </template>
        <p v-else class="field-hint">{{ t('nestingWaiting') }}</p>
        <p class="field-hint">{{ t('nestingResultHint') }}</p>
      </div>
      <div class="hint-box">ⓘ {{ t('disclaimer') }}</div>
    </div>
  </div>
</template>
