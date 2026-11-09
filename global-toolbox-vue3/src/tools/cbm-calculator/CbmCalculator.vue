<script setup lang="ts">
import { computed, inject, ref, type Ref } from 'vue'
import type { Locale } from '../../i18n'
import { useCargo } from '../../shared/cargo/useCargo'
import { formatNumber } from '../../shared/format/number'
import { lengthUnits, massUnits, type LengthUnit, type MassUnit } from '../../shared/units'
import {
  cargoToDisplay,
  computeCbmTotals,
  displayToCargo,
  exportCbmResultsCsv,
  importCargoCsv,
  type RoundingRule,
} from './useCbm'

const props = defineProps<{
  t: (key: string) => string
}>()

const emit = defineEmits<{ editCargo: [] }>()

const hostLocale = inject<Ref<Locale>>('hostLocale', ref('en'))
const { cargo, qty, setCargo } = useCargo()

const dimDivisor = ref(6000)
const rounding = ref<RoundingRule>('none')
const lengthUnit = ref<LengthUnit>('cm')
const massUnit = ref<MassUnit>('kg')
const importError = ref('')
const fileInput = ref<HTMLInputElement | null>(null)

const format = (v: number, d = 2) => formatNumber(v, hostLocale.value, d)

const totals = computed(() => computeCbmTotals(cargo.value, dimDivisor.value, rounding.value))

const displayRows = computed(() =>
  cargo.value.map((c) => cargoToDisplay(c, lengthUnit.value, massUnit.value)),
)

const updateFromDisplay = (index: number, field: keyof ReturnType<typeof cargoToDisplay>, raw: string | number) => {
  const current = displayRows.value[index]
  if (!current) return
  const next = { ...current, [field]: field === 'sku' ? String(raw) : Number(raw) }
  const stored = displayToCargo(next, lengthUnit.value, massUnit.value)
  cargo.value[index] = stored
}

const onImportClick = () => fileInput.value?.click()

const onFileChange = async (e: Event) => {
  importError.value = ''
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  const text = await file.text()
  const result = importCargoCsv(text, lengthUnit.value, massUnit.value)
  if (!result.ok) {
    importError.value = props.t(result.code)
    return
  }
  setCargo(result.rows)
}

const exportResults = () => {
  exportCbmResultsCsv(totals.value, dimDivisor.value, rounding.value, {
    sku: props.t('colSku'),
    qty: props.t('colQty'),
    cbm: props.t('colCbm'),
    gross: props.t('colGrossKg'),
    volumetric: props.t('volumetricWeight'),
    chargeable: props.t('chargeableWeight'),
    divisor: props.t('dimDivisor'),
    rounding: props.t('roundingRule'),
    total: props.t('total'),
  })
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
          {{ t('lengthUnit') }}
          <select v-model="lengthUnit">
            <option v-for="u in lengthUnits" :key="u" :value="u">{{ u }}</option>
          </select>
        </label>
        <label class="field">
          {{ t('massUnit') }}
          <select v-model="massUnit">
            <option v-for="u in massUnits" :key="u" :value="u">{{ u }}</option>
          </select>
        </label>
        <p class="field-hint">{{ t('dimDivisorHint') }}</p>
        <p class="field-hint">{{ t('cbmUnitHint') }}</p>
        <div class="btn-row" style="margin-top: 12px; flex-wrap: wrap; gap: 8px">
          <button class="btn-secondary" type="button" @click="onImportClick">{{ t('importCsv') }}</button>
          <button class="btn-secondary" type="button" @click="exportResults">{{ t('exportResults') }}</button>
          <input ref="fileInput" type="file" accept=".csv,text/csv" hidden @change="onFileChange" />
        </div>
        <p v-if="importError" class="field-hint" style="color: #b42318">{{ importError }}</p>
      </div>
      <div class="mini-panel">
        <span>▤</span>
        <div>
          <strong>{{ qty }} {{ t('items') }} · {{ format(totals.cbm, 3) }} m³</strong>
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
            <span>{{ t('totalCbm') }}</span>
            <strong>{{ format(totals.cbm, 3) }}<small> m³</small></strong>
          </div>
          <div class="metric">
            <span>{{ t('grossWeight') }}</span>
            <strong>{{ format(totals.grossKg) }}<small> kg</small></strong>
          </div>
          <div class="metric">
            <span>{{ t('volumetricWeight') }}</span>
            <strong>{{ format(totals.volumetricKg) }}<small> kg</small></strong>
          </div>
          <div class="metric">
            <span>{{ t('chargeableWeight') }}</span>
            <strong>{{ format(totals.chargeableKg) }}<small> kg</small></strong>
          </div>
        </div>
        <p class="field-hint">
          {{ t('roundingRule') }}: {{ t(rounding === 'none' ? 'roundNone' : rounding === 'round' ? 'roundNearest' : 'roundCeil') }}
          · {{ t('dimDivisor') }}: {{ dimDivisor }}
        </p>
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{{ t('colSku') }}</th>
                <th>{{ t('length') }} ({{ lengthUnit }})</th>
                <th>{{ t('width') }} ({{ lengthUnit }})</th>
                <th>{{ t('height') }} ({{ lengthUnit }})</th>
                <th>{{ t('weight') }} ({{ massUnit }})</th>
                <th>{{ t('colQty') }}</th>
                <th>{{ t('colCbm') }}</th>
                <th>{{ t('colGrossKg') }}</th>
                <th>{{ t('volumetricWeight') }}</th>
                <th>{{ t('chargeableWeight') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(row, i) in displayRows"
                :key="i"
                :style="totals.rows[i] && !totals.rows[i].valid ? { background: '#fff1f0' } : undefined"
              >
                <td>
                  <input :value="row.sku" class="cell-name" @change="updateFromDisplay(i, 'sku', ($event.target as HTMLInputElement).value)" />
                  <small v-if="totals.rows[i]?.errors.sku" style="color:#b42318;display:block">{{ t(totals.rows[i].errors.sku!) }}</small>
                </td>
                <td>
                  <input :value="row.length" type="number" min="0" step="any" @change="updateFromDisplay(i, 'length', ($event.target as HTMLInputElement).value)" />
                  <small v-if="totals.rows[i]?.errors.length" style="color:#b42318;display:block">{{ t(totals.rows[i].errors.length!) }}</small>
                </td>
                <td>
                  <input :value="row.width" type="number" min="0" step="any" @change="updateFromDisplay(i, 'width', ($event.target as HTMLInputElement).value)" />
                  <small v-if="totals.rows[i]?.errors.width" style="color:#b42318;display:block">{{ t(totals.rows[i].errors.width!) }}</small>
                </td>
                <td>
                  <input :value="row.height" type="number" min="0" step="any" @change="updateFromDisplay(i, 'height', ($event.target as HTMLInputElement).value)" />
                  <small v-if="totals.rows[i]?.errors.height" style="color:#b42318;display:block">{{ t(totals.rows[i].errors.height!) }}</small>
                </td>
                <td>
                  <input :value="row.weight" type="number" min="0" step="any" @change="updateFromDisplay(i, 'weight', ($event.target as HTMLInputElement).value)" />
                  <small v-if="totals.rows[i]?.errors.weight" style="color:#b42318;display:block">{{ t(totals.rows[i].errors.weight!) }}</small>
                </td>
                <td>
                  <input :value="row.qty" type="number" min="0" step="1" @change="updateFromDisplay(i, 'qty', ($event.target as HTMLInputElement).value)" />
                  <small v-if="totals.rows[i]?.errors.qty" style="color:#b42318;display:block">{{ t(totals.rows[i].errors.qty!) }}</small>
                </td>
                <td>{{ format(totals.rows[i]?.cbm ?? 0, 3) }}</td>
                <td>{{ format(totals.rows[i]?.grossKg ?? 0) }}</td>
                <td>{{ format(totals.rows[i]?.volumetricKg ?? 0) }}</td>
                <td>{{ format(totals.rows[i]?.chargeableKg ?? 0) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-if="totals.hasErrors" class="field-hint" style="color:#b42318">{{ t('cbmValidationHint') }}</p>
      </div>
      <div class="hint-box">ⓘ {{ t('disclaimer') }}</div>
    </div>
  </div>
</template>
