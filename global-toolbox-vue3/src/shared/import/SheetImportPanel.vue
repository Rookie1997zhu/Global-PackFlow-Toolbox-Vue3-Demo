<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  SHEET_FIELDS,
  applyMapping,
  detectColumnMapping,
  loadSheetFile,
  previewRows,
  validateMappedRows,
  type ColumnMapping,
  type MappedRow,
  type SheetField,
} from './sheetMapping'

const props = defineProps<{
  t: (key: string) => string
  title?: string
}>()

const emit = defineEmits<{
  applied: [rows: MappedRow[], mapping: ColumnMapping, headers: string[]]
}>()

const fileInput = ref<HTMLInputElement | null>(null)
const error = ref('')
const table = ref<string[][]>([])
const mapping = ref<ColumnMapping>({})
const issues = ref<ReturnType<typeof validateMappedRows>>([])

const headers = computed(() => (table.value[0] ? table.value[0].map(String) : []))
const preview = computed(() => previewRows(table.value, 10))
const mapped = computed(() => (table.value.length ? applyMapping(table.value, mapping.value) : []))

const fieldLabel = (field: SheetField) => props.t(`mapField_${field}`)

const onPick = () => fileInput.value?.click()

const onFile = async (e: Event) => {
  error.value = ''
  issues.value = []
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  const loaded = await loadSheetFile(file)
  if (loaded.errorCode) {
    error.value = props.t(loaded.errorCode)
    table.value = []
    mapping.value = {}
    return
  }
  if (!loaded.rows.length) {
    error.value = props.t('errCheckerEmpty')
    return
  }
  table.value = loaded.rows
  mapping.value = detectColumnMapping(loaded.rows[0] || [])
  issues.value = validateMappedRows(applyMapping(table.value, mapping.value))
}

const setField = (field: SheetField, raw: string) => {
  const next = { ...mapping.value }
  if (raw === '') {
    delete next[field]
  } else {
    next[field] = Number(raw)
  }
  mapping.value = next
  issues.value = validateMappedRows(applyMapping(table.value, mapping.value))
}

const apply = () => {
  if (!table.value.length) return
  const rows = applyMapping(table.value, mapping.value)
  issues.value = validateMappedRows(rows)
  emit('applied', rows, mapping.value, headers.value)
}
</script>

<template>
  <div class="sheet-import">
    <div class="panel-heading" style="margin-bottom: 8px">
      <h4 style="margin: 0; font-size: 13px">{{ title || t('sheetImport') }}</h4>
    </div>
    <button class="btn-secondary full" type="button" @click="onPick">{{ t('importCsvXlsx') }}</button>
    <input ref="fileInput" type="file" accept=".csv,.xlsx" hidden @change="onFile" />
    <p v-if="error" class="field-hint warn">{{ error }}</p>

    <template v-if="headers.length">
      <p class="field-hint">{{ t('sheetMappingHint') }}</p>
      <div class="map-grid">
        <label v-for="field in SHEET_FIELDS" :key="field" class="field">
          {{ fieldLabel(field) }}
          <select :value="mapping[field] ?? ''" @change="setField(field, ($event.target as HTMLSelectElement).value)">
            <option value="">—</option>
            <option v-for="(h, i) in headers" :key="field + '-' + i" :value="i">{{ h || `(col ${i + 1})` }}</option>
          </select>
        </label>
      </div>

      <div class="table-scroll" style="max-height: 220px; margin-top: 8px">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th v-for="(h, i) in preview[0]" :key="'h' + i">{{ h }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(row, ri) in preview.slice(1)"
              :key="'r' + ri"
              :class="{ bad: issues.some((x) => x.rawIndex === ri + 1) }"
            >
              <td>{{ ri + 1 }}</td>
              <td v-for="(cell, ci) in row" :key="'c' + ci">{{ cell }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p v-if="issues.length" class="field-hint warn">
        {{ t('sheetIssues') }} ({{ issues.length }}):
        {{ [...new Set(issues.map((i) => t(i.code)))].join(' · ') }}
      </p>
      <p class="field-hint">{{ t('sheetMappedCount') }}: {{ mapped.length }}</p>
      <button class="btn-primary full" type="button" @click="apply">{{ t('applyImport') }}</button>
    </template>
  </div>
</template>

<style scoped>
.map-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px 10px;
}
.warn { color: #b45309; }
tr.bad td { background: #fff4e8; }
@media (max-width: 700px) {
  .map-grid { grid-template-columns: 1fr; }
}
</style>
