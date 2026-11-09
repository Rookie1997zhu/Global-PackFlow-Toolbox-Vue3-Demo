<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  Package,
  Boxes,
  Plus,
  Trash2,
  RotateCcw,
  Calculator,
  Download,
  Layers3,
  Info,
  ChevronLeft,
  ChevronRight,
} from 'lucide-vue-next'
import { parseCsv } from '../../shared/export/csv'
import {
  bucketLayersByZ,
  exportLoadGuideCsv,
  exportLoadGuidePdf,
} from '../../shared/export/loadGuide'
import SheetImportPanel from '../../shared/import/SheetImportPanel.vue'
import { applyMapping, detectColumnMapping, type MappedRow } from '../../shared/import/sheetMapping'
import { mappedToPalletCartons } from './mappedToPalletCartons'
import { pack, type Carton, type Config } from './packing'
import {
  DEFAULT_PALLET_PRESET,
  PALLET_PRESETS,
  configFromPreset,
  type PalletPresetId,
} from './presets'
import Pallet3D from './Pallet3D.vue'
import './pallet.css'

const props = defineProps<{ t: (key: string) => string }>()

const presetId = ref<PalletPresetId>(DEFAULT_PALLET_PRESET)
const config = ref<Config>(configFromPreset(DEFAULT_PALLET_PRESET))
const cartons = ref<Carton[]>([
  { id: 1, name: 'A · Electronics', l: 400, w: 300, h: 250, qty: 30, kg: 8, color: '#5385dc', stackable: true },
  { id: 2, name: 'B · Packaging', l: 300, w: 250, h: 200, qty: 40, kg: 5, color: '#33ad99', stackable: true },
  { id: 3, name: 'C · Display', l: 500, w: 400, h: 300, qty: 15, kg: 12, color: '#eead61', stackable: true },
])
const palette = ['#5385dc', '#33ad99', '#eead61', '#ad85e9', '#e9778e', '#6ba7bd']
const mode = ref<'mixed' | 'single'>('mixed')
const viewMode = ref<'2d' | '3d'>('3d')
const result = ref(pack(config.value, cartons.value))
const active = ref(0)
const level = ref(-1)
const computedAt = ref('')
const sampleError = ref('')
const pdfBusy = ref(false)

const selected = computed(() => result.value.pallets[active.value])
const layers = computed(() =>
  selected.value ? [...new Set(selected.value.boxes.map((b) => b.z))].sort((a, b) => a - b) : [],
)
const shown = computed(() => selected.value?.boxes.filter((b) => level.value === -1 || b.z === level.value) || [])
const packedVolume = computed(() =>
  result.value.pallets.reduce((s, p) => s + p.boxes.reduce((v, b) => v + (b.l * b.w * b.h) / 1e9, 0), 0),
)
const utilization = computed(() =>
  result.value.pallets.length
    ? (packedVolume.value /
        result.value.pallets.reduce(
          (s) => s + (config.value.l * config.value.w * (config.value.maxHeight - config.value.h)) / 1e9,
          0,
        )) *
      100
    : 0,
)
const hasChanged = ref(false)
watch([config, cartons, mode], () => (hasChanged.value = true), { deep: true })

const applyPreset = (id: PalletPresetId) => {
  presetId.value = id
  if (id === 'custom') return
  config.value = configFromPreset(id)
}

watch(presetId, (id) => {
  if (id !== 'custom') config.value = configFromPreset(id)
})

function calculate() {
  const inputs = mode.value === 'single' ? cartons.value.slice(0, 1) : cartons.value
  result.value = pack({ ...config.value }, inputs.map((x) => ({ ...x })))
  active.value = 0
  level.value = -1
  hasChanged.value = false
  computedAt.value = new Date().toLocaleTimeString()
}

function add() {
  cartons.value.push({
    id: Date.now(),
    name: `SKU-${cartons.value.length + 1}`,
    l: 400,
    w: 300,
    h: 200,
    qty: 10,
    kg: 5,
    color: palette[cartons.value.length % palette.length],
    stackable: true,
  })
}

function reset() {
  presetId.value = DEFAULT_PALLET_PRESET
  config.value = configFromPreset(DEFAULT_PALLET_PRESET)
  cartons.value = [
    { id: 1, name: 'A · Electronics', l: 400, w: 300, h: 250, qty: 30, kg: 8, color: '#5385dc', stackable: true },
    { id: 2, name: 'B · Packaging', l: 300, w: 250, h: 200, qty: 40, kg: 5, color: '#33ad99', stackable: true },
    { id: 3, name: 'C · Display', l: 500, w: 400, h: 300, qty: 15, kg: 12, color: '#eead61', stackable: true },
  ]
  mode.value = 'mixed'
  calculate()
}

function downloadJson() {
  const payload = { version: 'DEMO-2.0', preset: presetId.value, config: config.value, cartons: cartons.value, result: result.value }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'packflow-pallet-plan.json'
  a.click()
  URL.revokeObjectURL(a.href)
}

const onImportApplied = (rows: MappedRow[]) => {
  cartons.value = mappedToPalletCartons(rows)
  mode.value = 'mixed'
  calculate()
}

const loadKrSample = async () => {
  sampleError.value = ''
  try {
    const res = await fetch('/samples/kr-pallet-cargo.csv')
    const table = parseCsv(await res.text())
    onImportApplied(applyMapping(table, detectColumnMapping(table[0] || [])))
    presetId.value = 'T11'
    config.value = configFromPreset('T11')
    calculate()
  } catch (err) {
    sampleError.value = err instanceof Error ? err.message : String(err)
  }
}

const guideInput = () => {
  const items =
    result.value.pallets.flatMap((p, pi) =>
      p.boxes.map((b) => ({
        sku: `${b.name} [P${pi + 1}]`,
        l: b.l,
        w: b.w,
        h: b.h,
        x: b.x,
        y: b.y,
        z: b.z,
      })),
    ) || []
  return {
    title: props.t('loadGuideTitlePallet'),
    specLabel: `${props.t('palletPreset')}: ${props.t(
      PALLET_PRESETS.find((p) => p.id === presetId.value)?.labelKey || 'palletPresetCustom',
    )} · ${config.value.l}×${config.value.w}×${config.value.h} mm`,
    utilizationLabel: `${props.t('volumeUtil')}: ${utilization.value.toFixed(1)}%`,
    packedLabel: `${props.t('containerPacked')}: ${result.value.packedBoxes} / ${result.value.totalBoxes}`,
    unplacedLabel: props.t('containerUnplaced'),
    layerLabel: props.t('loadGuideLayer'),
    disclaimer: props.t('palletSafetyHint'),
    layers: bucketLayersByZ(items),
    unplaced: result.value.unplaced.map((u) => ({
      name: u.name,
      qty: u.qty,
      reason: props.t(u.reasonCode),
    })),
    metaLines: [
      `${props.t('palletCount')}: ${result.value.pallets.length}`,
      `${props.t('strategy')}: ${result.value.strategy || '—'}`,
    ],
  }
}

const exportPdf = async () => {
  pdfBusy.value = true
  try {
    await exportLoadGuidePdf(guideInput(), 'pallet-load-guide.pdf')
  } finally {
    pdfBusy.value = false
  }
}

const exportCsvGuide = () => {
  exportLoadGuideCsv(guideInput(), 'pallet-load-guide.csv')
}

function boxStyle(b: { x: number; y: number; l: number; w: number; color: string }) {
  return {
    left: `${(b.x / config.value.l) * 100}%`,
    top: `${(b.y / config.value.w) * 100}%`,
    width: `${(b.l / config.value.l) * 100}%`,
    height: `${(b.w / config.value.w) * 100}%`,
    background: b.color,
  }
}

const warnText = (key: string) => {
  const translated = props.t(key)
  return translated === key ? key : translated
}

calculate()
</script>

<template>
  <div class="pallet-tool">
    <div class="headline">
      <div>
        <div class="eyebrow">LOGISTICS PLANNING</div>
        <h1>{{ t('palletTitle') }} <span class="demo">DEMO</span></h1>
        <p>{{ t('palletSubtitle') }}</p>
      </div>
      <div class="actions">
        <button class="btn secondary" type="button" @click="reset"><RotateCcw :size="15" /> {{ t('reset') }}</button>
        <button class="btn secondary" type="button" @click="downloadJson"><Download :size="15" /> JSON</button>
        <button class="btn secondary" type="button" :disabled="pdfBusy" @click="exportPdf">
          {{ pdfBusy ? t('exporting') : t('exportLoadGuidePdf') }}
        </button>
        <button class="btn secondary" type="button" @click="exportCsvGuide">{{ t('exportLoadGuideCsv') }}</button>
      </div>
    </div>
    <div class="workspace">
      <section class="settings">
        <div class="panel">
          <div class="panelhead"><span class="step">01</span><div><h2>{{ t('palletMode') }}</h2><small>{{ t('palletModeHint') }}</small></div></div>
          <div class="modegroup">
            <button type="button" :class="['mode', mode === 'single' ? 'selected' : '']" @click="mode = 'single'">
              <Package :size="20" /><b>{{ t('palletModeSingle') }}</b><small>{{ t('palletModeSingleHint') }}</small>
            </button>
            <button type="button" :class="['mode', mode === 'mixed' ? 'selected' : '']" @click="mode = 'mixed'">
              <Boxes :size="20" /><b>{{ t('palletModeMixed') }}</b><small>{{ t('palletModeMixedHint') }}</small>
            </button>
          </div>
        </div>
        <div class="panel">
          <div class="panelhead"><span class="step">02</span><div><h2>{{ t('palletParams') }}</h2><small>mm / kg</small></div></div>
          <label class="field" style="display:block;margin-bottom:8px">
            {{ t('palletPreset') }}
            <select :value="presetId" @change="applyPreset(($event.target as HTMLSelectElement).value as any)">
              <option v-for="p in PALLET_PRESETS" :key="p.id" :value="p.id">{{ t(p.labelKey) }}</option>
            </select>
          </label>
          <p class="fieldnote">{{ t('palletPresetHint') }}</p>
          <div class="formgrid three">
            <label>{{ t('length') }} (mm)<input v-model.number="config.l" type="number" min="1" :disabled="presetId !== 'custom'" @input="presetId = 'custom'" /></label>
            <label>{{ t('width') }} (mm)<input v-model.number="config.w" type="number" min="1" :disabled="presetId !== 'custom'" @input="presetId = 'custom'" /></label>
            <label>{{ t('palletDeckHeight') }} (mm)<input v-model.number="config.h" type="number" min="0" /></label>
          </div>
          <div class="formgrid two">
            <label>{{ t('palletMaxHeight') }} (mm)<input v-model.number="config.maxHeight" type="number" /></label>
            <label>{{ t('palletMaxWeight') }} (kg)<input v-model.number="config.maxWeight" type="number" /></label>
          </div>
          <div class="formgrid two">
            <label>{{ t('palletSelfWeight') }} (kg)<input v-model.number="config.palletKg" type="number" /></label>
            <div class="fieldnote">{{ t('palletMaxIncludes') }}</div>
          </div>
        </div>
        <div class="panel">
          <div class="panelhead row">
            <span class="step">03</span>
            <div><h2>{{ t('palletCartons') }}</h2><small>{{ t('palletRotateHint') }}</small></div>
            <button v-if="mode === 'mixed'" class="textbtn" type="button" @click="add"><Plus :size="15" /> {{ t('add') }}</button>
          </div>
          <button class="btn secondary" type="button" style="width:100%;margin-bottom:8px" @click="loadKrSample">{{ t('loadKrSample') }}</button>
          <p v-if="sampleError" class="error">{{ sampleError }}</p>
          <SheetImportPanel :t="t" :title="t('importPalletSheet')" @applied="onImportApplied" />
          <div v-for="(c, i) in mode === 'single' ? cartons.slice(0, 1) : cartons" :key="c.id" class="carton">
            <div class="cartontop">
              <span class="color" :style="{ background: c.color }"></span>
              <input class="name" v-model="c.name" />
              <button v-if="cartons.length > 1 && mode === 'mixed'" class="delete" type="button" @click="cartons.splice(i, 1)">
                <Trash2 :size="15" />
              </button>
            </div>
            <div class="formgrid three">
              <label>L<input v-model.number="c.l" type="number" /></label>
              <label>W<input v-model.number="c.w" type="number" /></label>
              <label>H<input v-model.number="c.h" type="number" /></label>
            </div>
            <div class="formgrid two">
              <label>{{ t('colQty') }}<input v-model.number="c.qty" type="number" min="0" /></label>
              <label>{{ t('weightKg') }}<input v-model.number="c.kg" type="number" min="0" /></label>
            </div>
            <label class="check"><input v-model="c.stackable" type="checkbox" /> {{ t('palletStackable') }}</label>
          </div>
          <button v-if="mode === 'mixed'" class="addline" type="button" @click="add"><Plus :size="16" /> {{ t('add') }}</button>
        </div>
        <button class="calculate" type="button" @click="calculate">
          <Calculator :size="18" /> {{ t('palletCalculate') }} <span v-if="hasChanged">· {{ t('palletDirty') }}</span>
        </button>
      </section>
      <section class="results">
        <div class="stats">
          <div class="stat">
            <span>{{ t('palletCount') }}</span>
            <strong>{{ result.pallets.length }} <small>PLT</small></strong>
          </div>
          <div class="stat">
            <span>{{ t('containerPacked') }}</span>
            <strong>{{ result.packedBoxes }} <small>/ {{ result.totalBoxes }}</small></strong>
          </div>
          <div class="stat">
            <span>{{ t('volumeUtil') }}</span>
            <strong>{{ utilization.toFixed(1) }}<small>%</small></strong>
            <div class="progress"><i :style="{ width: Math.min(100, utilization) + '%' }"></i></div>
          </div>
          <div class="stat">
            <span>{{ t('volume') }}</span>
            <strong>{{ result.volume.toFixed(3) }} <small>m³</small></strong>
          </div>
        </div>
        <div class="panel visual">
          <div class="visualhead">
            <div>
              <h2><Layers3 :size="19" /> {{ t('palletPreview') }}</h2>
              <p>{{ t('palletPreviewHint') }}</p>
            </div>
            <div class="view-toggle">
              <button type="button" :class="{ active: viewMode === '2d' }" @click="viewMode = '2d'">2D</button>
              <button type="button" :class="{ active: viewMode === '3d' }" @click="viewMode = '3d'">3D</button>
            </div>
          </div>
          <div class="toolbar">
            <div class="palnav">
              <button type="button" :disabled="active === 0" @click="active = Math.max(0, active - 1); level = -1"><ChevronLeft :size="16" /></button>
              <b>{{ active + (result.pallets.length ? 1 : 0) }} / {{ result.pallets.length }}</b>
              <button
                type="button"
                :disabled="active >= result.pallets.length - 1"
                @click="active = Math.min(result.pallets.length - 1, active + 1); level = -1"
              >
                <ChevronRight :size="16" />
              </button>
            </div>
            <div class="level">
              <span>{{ t('loadGuideLayer') }}:</span>
              <select v-model.number="level">
                <option :value="-1">{{ t('palletAllLayers') }}</option>
                <option v-for="(z, i) in layers" :key="z" :value="z">{{ i + 1 }} ({{ z }}mm)</option>
              </select>
            </div>
          </div>
          <div class="visualbody">
            <div class="canvaswrap">
              <Pallet3D v-if="viewMode === '3d' && selected" :boxes="selected.boxes" :config="config" :selected-level="level" />
              <div v-if="viewMode === '2d' && selected" class="board" :style="{ aspectRatio: `${config.l}/${config.w}` }">
                <div
                  v-for="(b, i) in shown"
                  :key="i"
                  class="box"
                  :style="boxStyle(b)"
                  :title="`${b.name} · ${b.l}×${b.w}×${b.h} mm · Z=${b.z}`"
                >
                  <span>{{ b.name.split(' · ')[0] }}</span>
                </div>
              </div>
              <div v-if="!selected" class="empty">{{ t('palletEmpty') }}</div>
              <div class="dimension">{{ config.l }} × {{ config.w }} mm</div>
            </div>
            <div class="details">
              <h3>{{ t('palletDetail') }}</h3>
              <template v-if="selected">
                <div class="detailrow"><span>{{ t('containerPacked') }}</span><b>{{ selected.boxes.length }}</b></div>
                <div class="detailrow"><span>{{ t('weight') }}</span><b>{{ selected.weight.toFixed(1) }} kg</b></div>
                <div class="detailrow"><span>{{ t('palletUsedHeight') }}</span><b>{{ selected.usedHeight }} mm</b></div>
                <div class="detailrow"><span>{{ t('loadGuideLayer') }}</span><b>{{ layers.length }}</b></div>
              </template>
            </div>
          </div>
        </div>
        <div class="notice">
          <Info :size="18" />
          <div>
            <b>{{ t('palletSafetyTitle') }}</b>
            <p>{{ t('palletSafetyHint') }}</p>
            <p v-if="result.unplaced.length" class="error">
              {{ t('containerUnplaced') }}:
              <span v-for="u in result.unplaced" :key="u.name + u.reasonCode">
                {{ u.name }}×{{ u.qty }} ({{ warnText(u.reasonCode) }})
              </span>
            </p>
            <p v-if="hasChanged" class="pending">{{ t('palletDirty') }}</p>
          </div>
        </div>
        <div class="footer">{{ result.strategy || '—' }} · {{ computedAt }}</div>
      </section>
    </div>
  </div>
</template>
