<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { Locale } from '../i18n'
import { ApiError } from '../api/http'
import {
  createShipmentReportApi,
  emptyShipmentPayload,
  getShipmentApi,
  linkShipmentPlanApi,
  listShipmentDocumentsApi,
  listShipmentEventsApi,
  listShipmentPlansApi,
  listShipmentRevisionsApi,
  restoreShipmentRevisionApi,
  transitionShipmentStatusApi,
  updateShipmentApi,
  type ApiShipment,
  type ShipmentCartonBatch,
  type ShipmentDocumentLink,
  type ShipmentEventItem,
  type ShipmentPlanLink,
  type ShipmentProductLine,
  type ShipmentStatus,
} from '../api/shipments'
import SheetImportWizard from '../shared/import/SheetImportWizard.vue'

const props = defineProps<{
  t: (key: string) => string
  locale: Locale
  isLoggedIn: boolean
}>()

const emit = defineEmits<{ requestLogin: [] }>()

const route = useRoute()
const router = useRouter()
const shipmentId = computed(() => String(route.params.shipmentId || ''))

const tab = ref<'order' | 'products' | 'packing' | 'documents' | 'plans' | 'history' | 'import'>('order')
const loading = ref(false)
const saving = ref(false)
const msg = ref('')
const error = ref('')
const conflict = ref(false)
const shipment = ref<ApiShipment | null>(null)
const docs = ref<ShipmentDocumentLink[]>([])
const plans = ref<ShipmentPlanLink[]>([])
const events = ref<ShipmentEventItem[]>([])
const revisions = ref<Array<{ revisionNo: number; contentHash: string; createdAt: string }>>([])
const jobId = ref('')

const parties = computed(() => shipment.value?.payload.parties || emptyShipmentPayload().parties)
const productLines = computed({
  get: () => shipment.value?.payload.productLines || [],
  set: (rows: ShipmentProductLine[]) => {
    if (!shipment.value) return
    shipment.value = {
      ...shipment.value,
      payload: { ...shipment.value.payload, productLines: rows },
    }
  },
})
const cartonBatches = computed({
  get: () => shipment.value?.payload.cartonBatches || [],
  set: (rows: ShipmentCartonBatch[]) => {
    if (!shipment.value) return
    shipment.value = {
      ...shipment.value,
      payload: { ...shipment.value.payload, cartonBatches: rows },
    }
  },
})

const isConflictErr = (err: unknown) =>
  err instanceof ApiError && (err.status === 409 || err.code === 'SHIPMENT_VERSION_CONFLICT')

const handleConflict = async () => {
  conflict.value = true
  error.value = props.t('shipmentsConflict')
  msg.value = props.t('shipmentsConflictHint')
  await load({ keepConflict: true })
}

const load = async (opts?: { keepConflict?: boolean }) => {
  if (!props.isLoggedIn || !shipmentId.value) {
    shipment.value = null
    return
  }
  loading.value = true
  if (!opts?.keepConflict) {
    error.value = ''
    conflict.value = false
  }
  try {
    shipment.value = await getShipmentApi(shipmentId.value)
    const [d, p, e, r] = await Promise.all([
      listShipmentDocumentsApi(shipmentId.value),
      listShipmentPlansApi(shipmentId.value),
      listShipmentEventsApi(shipmentId.value),
      listShipmentRevisionsApi(shipmentId.value),
    ])
    docs.value = d.items
    plans.value = p.items
    events.value = e.items
    revisions.value = r.items
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : props.t('shipmentsLoadError')
    shipment.value = null
  } finally {
    loading.value = false
  }
}

const save = async (reason = '') => {
  if (!shipment.value) return
  saving.value = true
  msg.value = ''
  error.value = ''
  conflict.value = false
  try {
    shipment.value = await updateShipmentApi(shipment.value.id, {
      payload: shipment.value.payload,
      rowVersion: shipment.value.rowVersion,
      shipmentNo: shipment.value.shipmentNo,
      reason,
    })
    msg.value = props.t('shipmentsSaved')
    await load()
  } catch (err) {
    if (isConflictErr(err)) await handleConflict()
    else error.value = err instanceof ApiError ? err.message : props.t('shipmentsSaveError')
  } finally {
    saving.value = false
  }
}

const setStatus = async (status: ShipmentStatus) => {
  if (!shipment.value) return
  saving.value = true
  error.value = ''
  conflict.value = false
  try {
    shipment.value = await transitionShipmentStatusApi(shipment.value.id, {
      status,
      rowVersion: shipment.value.rowVersion,
    })
    msg.value = props.t('shipmentsStatusOk')
    await load()
  } catch (err) {
    if (isConflictErr(err)) await handleConflict()
    else error.value = err instanceof ApiError ? err.message : props.t('shipmentsStatusError')
  } finally {
    saving.value = false
  }
}

const exportDoc = async (kind: 'packing_list' | 'commercial_invoice') => {
  if (!shipment.value) return
  saving.value = true
  error.value = ''
  conflict.value = false
  try {
    const hasNullNet = (shipment.value.payload.cartonBatches || []).some((b) => b.netKg == null)
    const report = await createShipmentReportApi(shipment.value.id, {
      kind,
      format: 'xlsx',
      locale: props.locale,
      formal: !hasNullNet,
    })
    msg.value = `${props.t('shipmentsReportOk')} · rev ${report.shipmentRevision?.revisionNo ?? shipment.value.revisionNo}`
    docs.value = (await listShipmentDocumentsApi(shipment.value.id)).items
  } catch (err) {
    if (isConflictErr(err)) await handleConflict()
    else error.value = err instanceof ApiError ? err.message : props.t('shipmentsReportError')
  } finally {
    saving.value = false
  }
}

const linkJob = async () => {
  if (!shipment.value || !jobId.value.trim()) return
  error.value = ''
  conflict.value = false
  try {
    await linkShipmentPlanApi(shipment.value.id, {
      calculationJobId: jobId.value.trim(),
      planType: 'container',
      label: props.t('shipmentsPlanDefaultLabel'),
    })
    jobId.value = ''
    plans.value = (await listShipmentPlansApi(shipment.value.id)).items
    msg.value = props.t('shipmentsPlanLinked')
  } catch (err) {
    if (isConflictErr(err)) await handleConflict()
    else error.value = err instanceof ApiError ? err.message : props.t('shipmentsPlanError')
  }
}

const restore = async (rev: number) => {
  if (!shipment.value) return
  error.value = ''
  conflict.value = false
  try {
    shipment.value = await restoreShipmentRevisionApi(shipment.value.id, rev)
    msg.value = props.t('shipmentsRestored')
    await load()
  } catch (err) {
    if (isConflictErr(err)) await handleConflict()
    else error.value = err instanceof ApiError ? err.message : props.t('shipmentsRestoreError')
  }
}

const addProduct = () => {
  productLines.value = [
    ...productLines.value,
    { sku: '', description: '', pieceQty: 0, unit: 'PCS', unitPrice: 0 },
  ]
}
const addBatch = () => {
  cartonBatches.value = [
    ...cartonBatches.value,
    {
      sku: '',
      piecesPerCarton: 0,
      cartonCount: 0,
      lastCartonQty: null,
      grossKg: 0,
      netKg: null,
      lengthCm: 0,
      widthCm: 0,
      heightCm: 0,
    },
  ]
}

watch(shipmentId, () => void load())
watch(
  () => props.isLoggedIn,
  (ok) => {
    if (ok) void load()
  },
)
onMounted(() => {
  if (!props.isLoggedIn) emit('requestLogin')
  void load()
})
</script>

<template>
  <div class="page-heading">
    <button class="back" type="button" @click="router.push(`/${locale}/shipments/`)">← {{ t('shipmentsTitle') }}</button>
    <div class="eyebrow dark">{{ t('shipmentsEyebrow') }}</div>
    <h1>{{ shipment?.shipmentNo || t('shipmentsDetail') }}</h1>
    <p v-if="shipment">
      {{ t('status') }}: {{ t(`shipmentsStatus_${shipment.status}`) }} · rev {{ shipment.revisionNo }} · row
      {{ shipment.rowVersion }}
    </p>
  </div>

  <div v-if="!isLoggedIn" class="panel">
    <p>{{ t('shipmentsNeedLogin') }}</p>
    <button class="btn-primary" type="button" @click="emit('requestLogin')">{{ t('sign') }}</button>
  </div>

  <template v-else>
    <p v-if="loading">{{ t('loading') }}</p>
    <div v-if="conflict || error" class="panel shipment-alert" :class="{ conflict }">
      <p class="field-hint" style="color: #a33b25; margin: 0">{{ error }}</p>
      <p v-if="conflict" class="field-hint" style="margin: 6px 0 0">{{ t('shipmentsConflictHint') }}</p>
      <div class="btn-row" style="margin-top: 10px; gap: 8px; flex-wrap: wrap">
        <button class="btn-secondary" type="button" :disabled="loading" @click="load()">{{ t('retry') }}</button>
      </div>
    </div>
    <p v-if="msg && !conflict" class="field-hint">{{ msg }}</p>

    <template v-if="shipment">
      <div class="chips shipment-tabs" style="margin-bottom: 12px">
        <button type="button" :class="{ active: tab === 'order' }" @click="tab = 'order'">{{ t('shipmentsTabOrder') }}</button>
        <button type="button" :class="{ active: tab === 'products' }" @click="tab = 'products'">{{ t('shipmentsTabProducts') }}</button>
        <button type="button" :class="{ active: tab === 'packing' }" @click="tab = 'packing'">{{ t('shipmentsTabPacking') }}</button>
        <button type="button" :class="{ active: tab === 'documents' }" @click="tab = 'documents'">{{ t('shipmentsTabDocuments') }}</button>
        <button type="button" :class="{ active: tab === 'plans' }" @click="tab = 'plans'">{{ t('shipmentsTabPlans') }}</button>
        <button type="button" :class="{ active: tab === 'history' }" @click="tab = 'history'">{{ t('shipmentsTabHistory') }}</button>
        <button type="button" :class="{ active: tab === 'import' }" @click="tab = 'import'">{{ t('shipmentsTabImport') }}</button>
      </div>

      <div class="btn-row shipment-actions" style="margin-bottom: 12px; gap: 8px; flex-wrap: wrap">
        <button class="btn-primary" type="button" :disabled="saving" @click="save()">{{ t('save') }}</button>
        <button class="btn-secondary" type="button" :disabled="saving" @click="setStatus('ready')">
          → {{ t('shipmentsStatus_ready') }}
        </button>
        <button class="btn-secondary" type="button" :disabled="saving" @click="setStatus('confirmed')">
          → {{ t('shipmentsStatus_confirmed') }}
        </button>
        <button class="btn-secondary" type="button" :disabled="saving" @click="setStatus('shipped')">
          → {{ t('shipmentsStatus_shipped') }}
        </button>
        <button class="btn-secondary" type="button" :disabled="saving" @click="setStatus('archived')">
          → {{ t('shipmentsStatus_archived') }}
        </button>
      </div>

      <div v-if="tab === 'order'" class="panel">
        <div class="panel-heading"><h3>{{ t('shipmentsTabOrder') }}</h3></div>
        <label class="field">{{ t('shipmentsNo') }}<input v-model="shipment.shipmentNo" /></label>
        <label class="field">{{ t('shipmentsPartyCustomer') }}<input v-model="parties.customer" /></label>
        <label class="field">{{ t('shipmentsPartySeller') }}<input v-model="parties.seller" /></label>
        <label class="field">{{ t('shipmentsPartyShipper') }}<input v-model="parties.shipper" /></label>
        <label class="field">{{ t('shipmentsPartyConsignee') }}<input v-model="parties.consignee" /></label>
        <label class="field">{{ t('shipmentsPartyPo') }}<input v-model="parties.po" /></label>
        <label class="field">{{ t('shipmentsPartyIncoterms') }}<input v-model="parties.incoterms" /></label>
        <label class="field">{{ t('shipmentsPartyCurrency') }}<input v-model="parties.currency" /></label>
      </div>

      <div v-else-if="tab === 'products'" class="panel">
        <div class="panel-heading">
          <h3>{{ t('shipmentsTabProducts') }}</h3>
          <button class="btn-secondary" type="button" @click="addProduct">+ {{ t('add') }}</button>
        </div>
        <p v-if="!productLines.length" class="empty">{{ t('shipmentsProductsEmpty') }}</p>
        <div v-else class="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{{ t('shipmentsColSku') }}</th>
                <th>{{ t('name') }}</th>
                <th>{{ t('shipmentsColPcs') }}</th>
                <th>{{ t('price') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, i) in productLines" :key="i">
                <td><input v-model="row.sku" class="cell-name" /></td>
                <td><input v-model="row.description" class="cell-name" /></td>
                <td><input v-model.number="row.pieceQty" type="number" min="0" /></td>
                <td><input v-model.number="row.unitPrice" type="number" min="0" step="0.01" /></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div v-else-if="tab === 'packing'" class="panel">
        <div class="panel-heading">
          <h3>{{ t('shipmentsTabPacking') }}</h3>
          <button class="btn-secondary" type="button" @click="addBatch">+ {{ t('add') }}</button>
        </div>
        <p class="field-hint">{{ t('shipmentsPackingHint') }}</p>
        <p v-if="!cartonBatches.length" class="empty">{{ t('shipmentsPackingEmpty') }}</p>
        <div v-else class="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{{ t('shipmentsColSku') }}</th>
                <th>{{ t('shipmentsColPcsPerCtn') }}</th>
                <th>{{ t('shipmentsColCtn') }}</th>
                <th>{{ t('shipmentsColLast') }}</th>
                <th>{{ t('shipmentsColGw') }}</th>
                <th>{{ t('shipmentsColNw') }}</th>
                <th>{{ t('length') }}</th>
                <th>{{ t('width') }}</th>
                <th>{{ t('height') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, i) in cartonBatches" :key="i">
                <td><input v-model="row.sku" class="cell-name" /></td>
                <td><input v-model.number="row.piecesPerCarton" type="number" min="0" /></td>
                <td><input v-model.number="row.cartonCount" type="number" min="0" /></td>
                <td><input v-model.number="row.lastCartonQty" type="number" min="0" /></td>
                <td><input v-model.number="row.grossKg" type="number" min="0" step="0.1" /></td>
                <td>
                  <input
                    :value="row.netKg ?? ''"
                    type="number"
                    min="0"
                    step="0.1"
                    @input="
                      row.netKg =
                        ($event.target as HTMLInputElement).value === ''
                          ? null
                          : Number(($event.target as HTMLInputElement).value)
                    "
                  />
                </td>
                <td><input v-model.number="row.lengthCm" type="number" min="0" /></td>
                <td><input v-model.number="row.widthCm" type="number" min="0" /></td>
                <td><input v-model.number="row.heightCm" type="number" min="0" /></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div v-else-if="tab === 'documents'" class="panel">
        <div class="panel-heading">
          <h3>{{ t('shipmentsTabDocuments') }}</h3>
          <div class="btn-row" style="gap: 8px; flex-wrap: wrap">
            <button class="btn-primary" type="button" :disabled="saving" @click="exportDoc('packing_list')">
              {{ t('shipmentsExportPl') }}
            </button>
            <button class="btn-primary" type="button" :disabled="saving" @click="exportDoc('commercial_invoice')">
              {{ t('shipmentsExportCi') }}
            </button>
          </div>
        </div>
        <p class="field-hint">{{ t('shipmentsDocsHint') }} · revision {{ shipment.revisionNo }}</p>
        <ul v-if="docs.length">
          <li v-for="d in docs" :key="d.id">
            {{ d.purpose.toUpperCase() }} · rev {{ d.revisionNo }} · {{ d.createdAt }}
          </li>
        </ul>
        <p v-else class="empty">{{ t('shipmentsDocsEmpty') }}</p>
      </div>

      <div v-else-if="tab === 'plans'" class="panel">
        <div class="panel-heading"><h3>{{ t('shipmentsTabPlans') }}</h3></div>
        <p class="field-hint">{{ t('shipmentsPlansHint') }}</p>
        <div class="btn-row" style="gap: 8px; margin-bottom: 10px; flex-wrap: wrap">
          <input v-model="jobId" :placeholder="t('shipmentsJobId')" style="flex: 1; min-width: 140px" />
          <button class="btn-secondary" type="button" @click="linkJob">{{ t('shipmentsLinkJob') }}</button>
        </div>
        <ul v-if="plans.length">
          <li v-for="p in plans" :key="p.id">
            {{ p.label || p.planType }} · job {{ p.calculationJobId || '—' }} · rev {{ p.revisionNo }}
          </li>
        </ul>
        <p v-else class="empty">{{ t('shipmentsPlansEmpty') }}</p>
      </div>

      <div v-else-if="tab === 'history'" class="panel">
        <div class="panel-heading"><h3>{{ t('shipmentsTabHistory') }}</h3></div>
        <h4 style="margin: 8px 0">{{ t('shipmentsRevisions') }}</h4>
        <p v-if="!revisions.length" class="empty">{{ t('shipmentsHistoryEmpty') }}</p>
        <ul v-else>
          <li v-for="r in revisions" :key="r.revisionNo" style="margin-bottom: 8px">
            r{{ r.revisionNo }} · {{ r.createdAt }}
            <button class="btn-secondary" type="button" style="margin-left: 8px" @click="restore(r.revisionNo)">
              {{ t('shipmentsRestore') }}
            </button>
          </li>
        </ul>
        <h4 style="margin: 12px 0 8px">{{ t('shipmentsEvents') }}</h4>
        <p v-if="!events.length" class="empty">{{ t('shipmentsHistoryEmpty') }}</p>
        <ul v-else>
          <li v-for="e in events" :key="e.id">{{ e.eventType }} · {{ e.reason || '—' }} · {{ e.createdAt }}</li>
        </ul>
      </div>

      <div v-else-if="tab === 'import'" class="panel">
        <div class="panel-heading"><h3>{{ t('shipmentsTabImport') }}</h3></div>
        <SheetImportWizard
          :t="t"
          :locale="locale"
          target="shipment"
          :target-shipment-id="shipment.id"
          @done="load()"
        />
      </div>
    </template>

    <div v-else-if="!loading" class="panel">
      <p class="empty">{{ error || t('shipmentsLoadError') }}</p>
      <button class="btn-secondary" type="button" @click="load()">{{ t('retry') }}</button>
    </div>
  </template>
</template>
