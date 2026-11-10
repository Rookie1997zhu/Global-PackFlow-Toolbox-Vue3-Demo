<script setup lang="ts">
import { computed, inject, onBeforeUnmount, ref, watch, type Ref } from 'vue'
import type { Locale } from '../../i18n'
import { useCargo } from '../../shared/cargo/useCargo'
import { parseCsv } from '../../shared/export/csv'
import { bucketLayersByZ, exportLoadGuidePdf } from '../../shared/export/loadGuide'
import { formatNumber } from '../../shared/format/number'
import SheetImportPanel from '../../shared/import/SheetImportPanel.vue'
import { mappedToCargo } from '../../shared/import/mappedToCargo'
import { applyMapping, detectColumnMapping, type MappedRow } from '../../shared/import/sheetMapping'
import { CONTAINER_PRESETS } from './containers'
import Container2D from './Container2D.vue'
import Container3D from './Container3D.vue'
import type { PackResult } from './packing'
import { createPackingRunner } from './runPackingAsync'
import {
  cargoToSkus,
  exportPackCsv,
  exportPackJson,
  exportSvgPng,
  groupUnplacedReasons,
  resolveContainer,
  type LocalSku,
} from './useContainer'
import { isLoggedIn } from '../../shared/auth/session'
import { createCalculationJob, pollCalculationResult } from '../../api/calculations'
import { ensureSchemeId } from '../../shared/reports/cloudReport'

const props = defineProps<{
  t: (key: string) => string
}>()

const emit = defineEmits<{ editCargo: [] }>()

const hostLocale = inject<Ref<Locale>>('hostLocale', ref('en'))
const format = (v: number, d = 2) => formatNumber(v, hostLocale.value, d)
const { cargo, qty, cbm, setCargo } = useCargo()

const presetId = ref('40HQ')
const customL = ref(12000)
const customW = ref(2350)
const customH = ref(2690)
const customMax = ref(26000)
const skus = ref<LocalSku[]>(cargoToSkus(cargo.value))
const result = ref<PackResult | null>(null)
const errorKey = ref('')
const busy = ref(false)
const pdfBusy = ref(false)
const sampleError = ref('')
const viewMode = ref<'2d' | '3d'>('2d')
const view2d = ref<InstanceType<typeof Container2D> | null>(null)
const cloudBusy = ref(false)
const cloudMsg = ref('')
const serverVerified = ref(false)
const engineVersion = ref('')

const runner = createPackingRunner()

const resolved = computed(() =>
  resolveContainer(presetId.value, {
    length: customL.value,
    width: customW.value,
    height: customH.value,
    maxPayload: customMax.value,
  }),
)

const containerConfig = computed(() => ({
  length: resolved.value.length,
  width: resolved.value.width,
  height: resolved.value.height,
  maxPayload: resolved.value.maxPayload,
}))

const syncFromCargo = () => {
  const prev = new Map(skus.value.map((s) => [s.name, s]))
  const next = cargoToSkus(cargo.value).map((s) => {
    const old = prev.get(s.name)
    return old ? { ...s, allowRotate: old.allowRotate, stackable: old.stackable, color: old.color } : s
  })
  // Avoid deep-watch churn when App restores the same cargo snapshot.
  const same =
    next.length === skus.value.length &&
    next.every((s, i) => {
      const o = skus.value[i]
      return (
        o &&
        o.name === s.name &&
        o.length === s.length &&
        o.width === s.width &&
        o.height === s.height &&
        o.weight === s.weight &&
        o.qty === s.qty
      )
    })
  if (same) return
  skus.value = next
}

const run = async () => {
  errorKey.value = ''
  busy.value = true
  runner.cancel()
  const input = {
    container: { ...containerConfig.value },
    skus: skus.value.map((s) => ({ ...s })),
  }
  try {
    // Always offload to worker (falls back inside runner) so sample cargo (~240 pcs)
    // cannot freeze the main thread on first paint.
    const out = await runner.run(input)
    if ('error' in out) {
      if (out.error === 'errContainerCancelled') return
      result.value = null
      errorKey.value = out.error
      return
    }
    result.value = out
    serverVerified.value = false
    engineVersion.value = ''
  } catch (err) {
    result.value = null
    errorKey.value = err instanceof Error ? err.message : 'errContainerFailed'
  } finally {
    busy.value = false
  }
}

const cloudVerify = async () => {
  cloudMsg.value = ''
  if (!isLoggedIn.value) {
    cloudMsg.value = props.t('cloudReportNeedLogin')
    return
  }
  cloudBusy.value = true
  serverVerified.value = false
  try {
    const cargoRows = skus.value.map((s) => ({
      sku: s.name,
      length: s.length / 10,
      width: s.width / 10,
      height: s.height / 10,
      weight: s.weight,
      qty: s.qty,
      price: 0,
    }))
    setCargo(cargoRows)
    const schemeId = await ensureSchemeId({
      name: `Container ${presetId.value}`,
      cargo: cargoRows,
      locale: hostLocale.value,
    })
    const job = await createCalculationJob({
      schemeId,
      idempotencyKey: `container-${schemeId}-${presetId.value}-${Date.now()}`,
      params: {
        containerPreset: presetId.value,
        allowRotate: skus.value.every((s) => s.allowRotate),
        custom:
          presetId.value === 'custom'
            ? {
                lengthMm: customL.value,
                widthMm: customW.value,
                heightMm: customH.value,
                maxPayload: customMax.value,
              }
            : undefined,
      },
    })
    const res = await pollCalculationResult(job.jobId)
    if (res.status !== 'succeeded' || !res.pack) {
      cloudMsg.value = props.t('cloudCalcFailed').replace('{msg}', res.message || res.status)
      return
    }
    result.value = res.pack as unknown as PackResult
    serverVerified.value = !!res.serverVerified
    engineVersion.value = res.engineVersion || ''
    cloudMsg.value = props.t('cloudCalcDone')
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    cloudMsg.value = props.t('cloudCalcFailed').replace('{msg}', msg)
  } finally {
    cloudBusy.value = false
  }
}

const cancel = () => {
  runner.cancel()
  busy.value = false
  errorKey.value = 'errContainerCancelled'
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null
const scheduleRun = () => {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    void run()
  }, 200)
}

watch([presetId, customL, customW, customH, customMax, skus], scheduleRun, { deep: true, immediate: true })
watch(cargo, () => syncFromCargo(), { deep: true })

onBeforeUnmount(() => {
  if (debounceTimer) clearTimeout(debounceTimer)
  runner.dispose()
})

const exportCsv = () => {
  if (!result.value) return
  exportPackCsv(result.value, props.t(resolved.value.preset.labelKey), props.t)
}

const exportJson = () => {
  if (!result.value) return
  exportPackJson(result.value, {
    container: containerConfig.value,
    preset: presetId.value,
    strategy: result.value.strategy,
  })
}

const exportPng = () => {
  const svg = view2d.value?.getTopSvg?.()
  if (!svg) return
  exportSvgPng(svg, 'container-top-view.png')
}

const warnText = (key: string) => {
  const translated = props.t(key)
  return translated === key ? key : translated
}

const unplacedGroups = computed(() =>
  result.value ? groupUnplacedReasons(result.value.unplaced, props.t) : [],
)

const onImportApplied = (rows: MappedRow[]) => {
  setCargo(mappedToCargo(rows))
  syncFromCargo()
}

const loadKrSample = async () => {
  sampleError.value = ''
  try {
    const res = await fetch('/samples/kr-container-cargo.csv')
    const table = parseCsv(await res.text())
    onImportApplied(applyMapping(table, detectColumnMapping(table[0] || [])))
  } catch (err) {
    sampleError.value = err instanceof Error ? err.message : String(err)
  }
}

const exportLoadPdf = async () => {
  if (!result.value) return
  pdfBusy.value = true
  try {
    const items = result.value.placements.map((p) => ({
      sku: p.name,
      l: p.l,
      w: p.w,
      h: p.h,
      x: p.x,
      y: p.y,
      z: p.z,
    }))
    await exportLoadGuidePdf(
      {
        title: props.t('loadGuideTitleContainer'),
        specLabel: `${props.t('containerType')}: ${props.t(resolved.value.preset.labelKey)} · ${containerConfig.value.length}×${containerConfig.value.width}×${containerConfig.value.height} mm`,
        utilizationLabel: `${props.t('volumeUtil')}: ${result.value.volumeUtilPct.toFixed(1)}% · ${props.t('payloadUtil')}: ${result.value.weightUtilPct.toFixed(1)}%`,
        packedLabel: `${props.t('containerPacked')}: ${result.value.packedCount} / ${result.value.totalCount}`,
        unplacedLabel: props.t('containerUnplaced'),
        layerLabel: props.t('loadGuideLayer'),
        disclaimer: props.t('containerSafetyHint'),
        layers: bucketLayersByZ(items),
        unplaced: result.value.unplaced.map((u) => ({
          name: u.name,
          qty: u.qty,
          reason: props.t(u.reason),
        })),
        metaLines: [`${props.t('strategy')}: ${result.value.strategy}`],
      },
      'container-load-guide.pdf',
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
          {{ t('containerType') }}
          <select v-model="presetId">
            <option v-for="p in CONTAINER_PRESETS" :key="p.id" :value="p.id">{{ t(p.labelKey) }}</option>
          </select>
        </label>
        <template v-if="presetId === 'custom'">
          <label class="field">{{ t('containerLengthMm') }}<input v-model.number="customL" type="number" min="1" /></label>
          <label class="field">{{ t('containerWidthMm') }}<input v-model.number="customW" type="number" min="1" /></label>
          <label class="field">{{ t('containerHeightMm') }}<input v-model.number="customH" type="number" min="1" /></label>
          <label class="field">{{ t('containerPayloadKg') }}<input v-model.number="customMax" type="number" min="1" /></label>
        </template>
        <p class="field-hint">
          {{ resolved.length }} × {{ resolved.width }} × {{ resolved.height }} mm · {{ format(resolved.maxPayload, 0) }} kg
        </p>
        <p class="field-hint">{{ t('containerHint') }}</p>

        <div class="panel-heading" style="margin-top: 12px">
          <h3>{{ t('containerSkus') }}</h3>
          <div class="btn-row">
            <button class="btn-secondary" type="button" @click="syncFromCargo">{{ t('containerSyncCargo') }}</button>
            <button class="btn-secondary" type="button" @click="loadKrSample">{{ t('loadKrSample') }}</button>
            <button class="btn-secondary" type="button" @click="emit('editCargo')">{{ t('edit') }} ↗</button>
          </div>
        </div>
        <p v-if="sampleError" class="field-hint" style="color:#b42318">{{ sampleError }}</p>
        <div style="margin: 10px 0; padding-top: 8px; border-top: 1px solid #e5ebf1">
          <SheetImportPanel :t="t" :title="t('importContainerSheet')" @applied="onImportApplied" />
        </div>
        <p class="field-hint">{{ t('containerMaxUnitsHint') }}</p>
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{{ t('name') }}</th>
                <th>L</th>
                <th>W</th>
                <th>H</th>
                <th>{{ t('colQty') }}</th>
                <th>{{ t('allowRotate') }}</th>
                <th>{{ t('containerStackable') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="s in skus" :key="s.id">
                <td>{{ s.name }}</td>
                <td>{{ s.length }}</td>
                <td>{{ s.width }}</td>
                <td>{{ s.height }}</td>
                <td><input v-model.number="s.qty" type="number" min="0" step="1" /></td>
                <td><input v-model="s.allowRotate" type="checkbox" /></td>
                <td><input v-model="s.stackable" type="checkbox" /></td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="field-hint">{{ t('containerSkuHint') }}</p>

        <div class="btn-row" style="margin-top: 12px; flex-wrap: wrap; gap: 8px">
          <button class="btn-primary" type="button" :disabled="busy" @click="run">
            {{ busy ? t('containerRunning') : t('run') }}
          </button>
          <button class="btn-secondary" type="button" :disabled="!busy" @click="cancel">{{ t('containerCancel') }}</button>
          <button
            v-if="isLoggedIn"
            class="btn-secondary"
            type="button"
            :disabled="cloudBusy || busy"
            @click="cloudVerify"
          >
            {{ cloudBusy ? t('cloudCalcBusy') : t('cloudCalcVerify') }}
          </button>
        </div>
        <p v-if="errorKey" class="field-hint" style="color:#b42318">{{ t(errorKey) }}</p>
        <p v-if="cloudMsg" class="field-hint">{{ cloudMsg }}</p>
        <p v-if="!isLoggedIn" class="field-hint">{{ t('cloudCalcPreviewOnly') }}</p>
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
          <span class="small-badge light">{{ busy ? t('containerRunning') : t('autoUpdated') }}</span>
          <span v-if="serverVerified" class="small-badge">{{ t('serverVerified') }} · {{ engineVersion }}</span>
          <span v-else-if="result" class="small-badge light">{{ t('notServerVerified') }}</span>
        </div>

        <template v-if="result">
          <div class="metric-grid">
            <div class="metric primary">
              <span>{{ t('containerPacked') }}</span>
              <strong>{{ result.packedCount }}<small> / {{ result.totalCount }}</small></strong>
            </div>
            <div class="metric">
              <span>{{ t('volumeUtil') }}</span>
              <strong>{{ format(result.volumeUtilPct, 1) }}<small> %</small></strong>
            </div>
            <div class="metric">
              <span>{{ t('payloadUtil') }}</span>
              <strong>{{ format(result.weightUtilPct, 1) }}<small> %</small></strong>
            </div>
            <div class="metric">
              <span>{{ t('containerUnpacked') }}</span>
              <strong>{{ result.unplaced.reduce((s, u) => s + u.qty, 0) }}</strong>
            </div>
          </div>

          <div class="btn-row" style="margin: 10px 0; gap: 8px">
            <button class="btn-secondary" type="button" :style="viewMode === '2d' ? { outline: '2px solid #0e7490' } : undefined" @click="viewMode = '2d'">
              {{ t('containerView2d') }}
            </button>
            <button class="btn-secondary" type="button" :style="viewMode === '3d' ? { outline: '2px solid #0e7490' } : undefined" @click="viewMode = '3d'">
              {{ t('containerView3d') }}
            </button>
          </div>

          <Container2D v-if="viewMode === '2d'" ref="view2d" :container="containerConfig" :placements="result.placements" :t="t" />
          <Container3D v-else :container="containerConfig" :placements="result.placements" :t="t" />

          <div v-if="result.unplaced.length" class="alert" style="margin-top: 12px">
            ⚠ {{ t('containerUnplaced') }}:
            <span v-for="u in result.unplaced" :key="u.skuId"> {{ u.name }}×{{ u.qty }} ({{ warnText(u.reason) }}) </span>
          </div>
          <div v-if="unplacedGroups.length" class="field-hint" style="margin-top: 8px">
            <strong>{{ t('unplacedByReason') }}:</strong>
            <div v-for="g in unplacedGroups" :key="g.reason">{{ g.reason }} ×{{ g.qty }} — {{ g.names.join(', ') }}</div>
          </div>

          <div class="btn-row" style="margin-top: 12px; flex-wrap: wrap; gap: 8px">
            <button class="btn-secondary" type="button" @click="exportCsv">{{ t('export') }}</button>
            <button class="btn-secondary" type="button" @click="exportJson">{{ t('exportJson') }}</button>
            <button class="btn-secondary" type="button" :disabled="viewMode !== '2d'" @click="exportPng">{{ t('exportPng') }}</button>
            <button class="btn-primary" type="button" :disabled="pdfBusy" @click="exportLoadPdf">
              {{ pdfBusy ? t('exporting') : t('exportLoadGuidePdf') }}
            </button>
          </div>
          <p class="field-hint">{{ t('containerResultHint') }} · {{ t('containerSafetyHint') }}</p>
        </template>
        <p v-else class="field-hint">{{ t('containerWaiting') }}</p>
      </div>
      <div class="hint-box">ⓘ {{ t('disclaimer') }}</div>
    </div>
  </div>
</template>
