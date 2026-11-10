<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { Locale } from '../../i18n'
import { ApiError } from '../../api/http'
import { uploadCargoFile } from '../../api/files'
import {
  importCommit,
  importPreview,
  listMappingTemplates,
  saveMappingTemplate,
  type ImportIssue,
  type ImportPreviewDto,
  type ImportSheetInfo,
  type MappingTemplateDto,
} from '../../api/imports'

const props = defineProps<{
  t: (key: string) => string
  locale: Locale
  target?: 'scheme' | 'shipment'
  targetShipmentId?: string
  targetSchemeId?: string
}>()

const emit = defineEmits<{
  done: [payload: { shipmentId?: string; schemeId?: string }]
}>()

const step = ref<1 | 2 | 3 | 4 | 5>(1)
const busy = ref(false)
const error = ref('')
const file = ref<File | null>(null)
const fileId = ref('')
const preview = ref<ImportPreviewDto | null>(null)
const mapping = ref<Record<string, number>>({})
const sheetIndex = ref(0)
const sheets = ref<ImportSheetInfo[]>([])
const templateName = ref('')
const templates = ref<MappingTemplateDto[]>([])
const commitResult = ref('')

const fields = [
  'sku',
  'description',
  'qty',
  'unit',
  'grossKg',
  'netKg',
  'lengthCm',
  'widthCm',
  'heightCm',
  'boxCount',
  'unitPrice',
  'po',
]

const headers = computed(() => preview.value?.headers || [])
const issues = computed(() => preview.value?.issues || [])
const blocking = computed(() =>
  issues.value.filter((i) =>
    ['CARGO_DIMENSIONS_REQUIRED', 'errImportEmptyKey', 'errImportSku', 'errImportQty'].includes(i.code),
  ),
)
const multiSheet = computed(() => sheets.value.length > 1)

const loadTemplates = async () => {
  try {
    templates.value = (await listMappingTemplates()).items
  } catch {
    templates.value = []
  }
}

const onPick = async (ev: Event) => {
  const input = ev.target as HTMLInputElement
  const f = input.files?.[0]
  if (!f) return
  file.value = f
  error.value = ''
  busy.value = true
  preview.value = null
  sheets.value = []
  sheetIndex.value = 0
  try {
    const asset = await uploadCargoFile(f)
    fileId.value = asset.id
    // Probe sheet list via preview of sheet 0 (returns sheets catalog)
    const probe = await importPreview(asset.id, undefined, 0)
    sheets.value = probe.sheets || [{ index: 0, name: f.name }]
    sheetIndex.value = probe.sheetIndex ?? 0
    preview.value = probe
    mapping.value = { ...(probe.mapping || probe.suggestedMapping || {}) }
    step.value = 2
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : props.t('importWizardUploadError')
  } finally {
    busy.value = false
    input.value = ''
  }
}

const runPreview = async () => {
  if (!fileId.value) return
  busy.value = true
  error.value = ''
  try {
    const map = Object.keys(mapping.value).length ? mapping.value : undefined
    preview.value = await importPreview(fileId.value, map, sheetIndex.value)
    sheets.value = preview.value.sheets || sheets.value
    sheetIndex.value = preview.value.sheetIndex ?? sheetIndex.value
    mapping.value = { ...(preview.value.mapping || preview.value.suggestedMapping || {}) }
    step.value = 3
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : props.t('importWizardPreviewError')
  } finally {
    busy.value = false
  }
}

const onSheetChange = () => {
  // Changing sheet invalidates current mapping preview; re-run preview before map step.
  preview.value = null
  mapping.value = {}
}

const applyTemplate = (tpl: MappingTemplateDto) => {
  mapping.value = { ...tpl.mapping }
  templateName.value = tpl.name
}

const saveTemplate = async () => {
  const name = templateName.value.trim()
  if (!name) return
  busy.value = true
  try {
    await saveMappingTemplate({
      name,
      mapping: mapping.value,
      sheetHint: sheets.value.find((s) => s.index === sheetIndex.value)?.name || '',
    })
    await loadTemplates()
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : props.t('importWizardTemplateError')
  } finally {
    busy.value = false
  }
}

const goReview = () => {
  step.value = 4
}

const commit = async () => {
  if (!preview.value) return
  busy.value = true
  error.value = ''
  commitResult.value = ''
  try {
    const res = await importCommit(preview.value.id, {
      mapping: mapping.value,
      target: props.target || 'scheme',
      targetShipmentId: props.targetShipmentId,
      targetSchemeId: props.targetSchemeId,
      name: file.value?.name,
      sheetIndex: sheetIndex.value,
    })
    step.value = 5
    const skipped = res.skippedRows || 0
    if (res.shipment) {
      commitResult.value = props.t('importWizardShipmentDone').replace('{no}', res.shipment.shipmentNo)
      emit('done', { shipmentId: res.shipment.id })
    } else if (res.scheme) {
      commitResult.value = props.t('importWizardSchemeDone').replace('{name}', res.scheme.name)
      emit('done', { schemeId: res.scheme.id })
    }
    if (skipped > 0) {
      commitResult.value += ` · ${props.t('importWizardSkipped').replace('{n}', String(skipped))}`
    }
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : props.t('importWizardCommitError')
  } finally {
    busy.value = false
  }
}

const resetWizard = () => {
  step.value = 1
  preview.value = null
  fileId.value = ''
  sheets.value = []
  mapping.value = {}
  sheetIndex.value = 0
  commitResult.value = ''
  error.value = ''
}

onMounted(() => {
  void loadTemplates()
})
</script>

<template>
  <div class="import-wizard">
    <p class="field-hint">{{ t('importWizardSteps') }} · {{ step }}/5</p>
    <p v-if="error" class="field-hint" style="color: #a33b25">{{ error }}</p>

    <div v-if="step === 1">
      <h3>{{ t('importWizardUpload') }}</h3>
      <label class="btn-secondary" style="display: inline-flex; cursor: pointer">
        {{ busy ? '…' : t('cloudImportPick') }}
        <input type="file" accept=".csv,.xlsx" hidden :disabled="busy" @change="onPick" />
      </label>
    </div>

    <div v-else-if="step === 2">
      <h3>{{ t('importWizardSheet') }}</h3>
      <p class="field-hint">{{ file?.name }}</p>
      <label v-if="multiSheet" class="field">
        {{ t('importWizardSheetSelect') }}
        <select v-model.number="sheetIndex" @change="onSheetChange">
          <option v-for="s in sheets" :key="s.index" :value="s.index">{{ s.index }}: {{ s.name }}</option>
        </select>
      </label>
      <p v-else class="field-hint">{{ t('importWizardSheetSingle') }}</p>
      <p class="field-hint">{{ t('importWizardSheetHint') }}</p>
      <div class="btn-row" style="gap: 8px">
        <button class="btn-secondary" type="button" @click="step = 1">←</button>
        <button class="btn-primary" type="button" :disabled="busy" @click="runPreview">
          {{ t('importWizardMap') }} →
        </button>
      </div>
    </div>

    <div v-else-if="step === 3">
      <h3>{{ t('importWizardMap') }}</h3>
      <p class="field-hint">
        {{ t('importWizardSheetSelect') }}:
        {{ sheets.find((s) => s.index === sheetIndex)?.name || sheetIndex }}
      </p>
      <div v-if="templates.length" style="margin-bottom: 10px">
        <p class="field-hint">{{ t('importWizardTemplates') }}</p>
        <div class="btn-row" style="gap: 6px; flex-wrap: wrap">
          <button
            v-for="tpl in templates"
            :key="tpl.id"
            class="btn-secondary"
            type="button"
            @click="applyTemplate(tpl)"
          >
            {{ tpl.name }}
          </button>
        </div>
      </div>
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>{{ t('importWizardField') }}</th>
              <th>{{ t('importWizardColumn') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="f in fields" :key="f">
              <td>{{ f }}</td>
              <td>
                <select v-model.number="mapping[f]">
                  <option :value="undefined">—</option>
                  <option v-for="(h, idx) in headers" :key="idx" :value="idx">{{ idx }}: {{ h }}</option>
                </select>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="btn-row" style="gap: 8px; margin-top: 10px; flex-wrap: wrap">
        <input v-model="templateName" :placeholder="t('importWizardTemplateName')" style="max-width: 180px" />
        <button class="btn-secondary" type="button" :disabled="busy" @click="saveTemplate">
          {{ t('importWizardSaveTemplate') }}
        </button>
        <button class="btn-secondary" type="button" @click="step = 2">←</button>
        <button class="btn-primary" type="button" @click="goReview">{{ t('importWizardReview') }} →</button>
      </div>
    </div>

    <div v-else-if="step === 4">
      <h3>{{ t('importWizardReview') }}</h3>
      <p>{{ t('importWizardRowCount') }}: {{ preview?.rowCount ?? 0 }}</p>
      <p v-if="blocking.length" class="field-hint" style="color: #a33b25">
        {{ t('importWizardBlocking') }}: {{ blocking.length }}
      </p>
      <ul v-if="issues.length">
        <li v-for="(iss, i) in issues.slice(0, 30)" :key="i">
          #{{ (iss as ImportIssue).rawIndex }} {{ (iss as ImportIssue).code }}
          <span v-if="(iss as ImportIssue).field"> ({{ (iss as ImportIssue).field }})</span>
        </li>
      </ul>
      <p v-else class="field-hint">{{ t('importWizardNoIssues') }}</p>
      <div class="btn-row" style="gap: 8px">
        <button class="btn-secondary" type="button" @click="step = 3">←</button>
        <button class="btn-primary" type="button" :disabled="busy || blocking.length > 0" @click="commit">
          {{ t('importWizardCommit') }}
        </button>
      </div>
    </div>

    <div v-else>
      <h3>{{ t('importWizardDone') }}</h3>
      <p>{{ commitResult }}</p>
      <button class="btn-secondary" type="button" @click="resetWizard">
        {{ t('importWizardAgain') }}
      </button>
    </div>
  </div>
</template>
