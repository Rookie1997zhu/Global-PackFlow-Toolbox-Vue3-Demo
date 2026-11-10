<script setup lang="ts">
import { computed, inject, reactive, ref, watch, type Ref } from 'vue'
import type { Locale } from '../../i18n'
import { useCargo } from '../../shared/cargo/useCargo'
import { formatNumber } from '../../shared/format/number'
import { parseCsv } from '../../shared/export/csv'
import SheetImportPanel from '../../shared/import/SheetImportPanel.vue'
import { applyMapping, detectColumnMapping, type MappedRow } from '../../shared/import/sheetMapping'
import {
  computeInvoiceTotals,
  exportInvoiceCsv,
  exportInvoicePdf,
  exportInvoiceXlsx,
  lineAmount,
  linesFromCargo,
  linesFromMapped,
  validateInvoice,
  type InvoiceLine,
  type InvoiceMeta,
} from './useInvoice'
import { isLoggedIn } from '../../shared/auth/session'
import { cloudGenerateReport, ensureSchemeId } from '../../shared/reports/cloudReport'
import { buildConfirmedReportBody } from '../../shared/reports/confirmedReportBody'
import type { ReportFormat } from '../../api/reports'

const props = defineProps<{ t: (key: string) => string }>()
const emit = defineEmits<{ editCargo: [] }>()

const hostLocale = inject<Ref<Locale>>('hostLocale', ref('en'))
const { cargo } = useCargo()
const format = (v: number, d = 2) => formatNumber(v, hostLocale.value, d)
const cloudBusy = ref(false)
const cloudMsg = ref('')

const meta = reactive<InvoiceMeta>({
  seller: 'YOUR COMPANY',
  buyer: 'CUSTOMER NAME',
  invoiceNo: 'INV-2026-001',
  po: 'PO-2026-001',
  currency: 'USD',
  incoterms: 'FOB',
  paymentTerms: 'T/T 30 days',
})

const linesLocked = ref(false)
const lines = ref<InvoiceLine[]>(linesFromCargo(cargo.value))
const sampleError = ref('')

watch(
  cargo,
  (rows) => {
    if (linesLocked.value) return
    lines.value = linesFromCargo(rows)
  },
  { deep: true },
)

const totals = computed(() => computeInvoiceTotals(lines.value))
const issues = computed(() => validateInvoice(meta, lines.value))

const labels = computed(() => ({
  invoice: props.t('invoiceLabel'),
  seller: props.t('seller'),
  buyer: props.t('buyer'),
  po: props.t('poLabel'),
  currency: props.t('currency'),
  incoterms: props.t('incoterms'),
  payment: props.t('paymentTerms'),
  sku: props.t('colSku'),
  description: props.t('description'),
  qty: props.t('colQty'),
  unit: props.t('unitLabel'),
  unitPrice: props.t('unitPrice'),
  amount: props.t('amount'),
  total: props.t('total'),
}))

const syncFromCargo = () => {
  linesLocked.value = false
  lines.value = linesFromCargo(cargo.value)
}

const onImportApplied = (rows: MappedRow[]) => {
  linesLocked.value = true
  lines.value = linesFromMapped(rows)
  if (rows[0]?.po) meta.po = rows[0].po
}

const loadKrSample = async () => {
  sampleError.value = ''
  try {
    const res = await fetch('/samples/kr-invoice.csv')
    const table = parseCsv(await res.text())
    const mapping = detectColumnMapping(table[0] || [])
    onImportApplied(applyMapping(table, mapping))
    meta.seller = '한국수출(주)'
    meta.buyer = 'Buyer Co., Ltd.'
    meta.invoiceNo = 'INV-KR-2026-001'
    meta.currency = 'USD'
    meta.incoterms = 'FOB'
    meta.paymentTerms = 'T/T 30 days'
  } catch (err) {
    sampleError.value = err instanceof Error ? err.message : String(err)
  }
}

const cloudExport = async (format: ReportFormat) => {
  cloudMsg.value = ''
  if (!isLoggedIn.value) {
    cloudMsg.value = props.t('cloudReportNeedLogin')
    return
  }
  cloudBusy.value = true
  try {
    const schemeId = await ensureSchemeId({
      name: `CI ${meta.invoiceNo || 'scheme'}`,
      cargo: cargo.value,
      locale: hostLocale.value,
    })
    await cloudGenerateReport(
      buildConfirmedReportBody({
        kind: 'commercial_invoice',
        format,
        locale: hostLocale.value,
        schemeId,
        lines: lines.value,
        formal: false,
        meta: {
          seller: meta.seller,
          buyer: meta.buyer,
          invoiceNo: meta.invoiceNo,
          po: meta.po,
          currency: meta.currency,
          incoterms: meta.incoterms,
          paymentTerms: meta.paymentTerms,
          title: props.t('commercialInvoice'),
        },
      }),
    )
    cloudMsg.value = props.t('cloudReportDone')
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    cloudMsg.value = props.t('cloudReportError').replace('{msg}', props.t(msg) !== msg ? props.t(msg) : msg)
  } finally {
    cloudBusy.value = false
  }
}
</script>

<template>
  <div class="tool-layout">
    <div class="tool-settings">
      <div class="panel">
        <div class="panel-heading"><h3>{{ t('settings') }}</h3><span class="small-badge">{{ t('live') }}</span></div>
        <label class="field">{{ t('seller') }}<input v-model="meta.seller" /></label>
        <label class="field">{{ t('buyer') }}<input v-model="meta.buyer" /></label>
        <label class="field">{{ t('invoiceNumber') }}<input v-model="meta.invoiceNo" /></label>
        <label class="field">{{ t('poNumber') }}<input v-model="meta.po" /></label>
        <label class="field">{{ t('currency') }}<input v-model="meta.currency" /></label>
        <label class="field">{{ t('incoterms') }}
          <select v-model="meta.incoterms">
            <option>EXW</option><option>FOB</option><option>CIF</option><option>DDP</option><option>DAP</option>
          </select>
        </label>
        <label class="field">{{ t('paymentTerms') }}<input v-model="meta.paymentTerms" /></label>
        <button class="btn-secondary full" type="button" @click="syncFromCargo">{{ t('syncFromCargo') }}</button>
        <button class="btn-secondary full" type="button" @click="loadKrSample">{{ t('loadKrSample') }}</button>
        <p v-if="linesLocked" class="field-hint">{{ t('linesLockedHint') }}</p>
        <p v-if="sampleError" class="field-hint warn">{{ sampleError }}</p>
        <p v-if="issues.length" class="field-hint warn">{{ issues.map((c) => t(c)).join(' · ') }}</p>
        <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e5ebf1">
          <SheetImportPanel :t="t" :title="t('importInvoiceSheet')" @applied="onImportApplied" />
        </div>
      </div>
      <div class="mini-panel">
        <span>▧</span>
        <div><strong>{{ lines.length }} {{ t('items') }} · {{ format(totals.computedTotal) }} {{ meta.currency }}</strong><p>{{ t('sharedDesc') }}</p></div>
        <button type="button" @click="emit('editCargo')">{{ t('edit') }} ↗</button>
      </div>
    </div>
    <div class="tool-output">
      <div class="panel output-panel">
        <div class="panel-heading"><h3>{{ t('results') }}</h3><span class="small-badge light">{{ t('autoUpdated') }}</span></div>
        <div class="print-area">
          <div class="document-top">{{ t('commercialInvoice') }}</div>
          <div class="doc-meta">
            <span>{{ t('invoiceLabel') }}: {{ meta.invoiceNo }}</span>
            <span>{{ t('poLabel') }}: {{ meta.po }}</span>
            <span>{{ t('seller') }}: {{ meta.seller }}</span>
            <span>{{ t('buyer') }}: {{ meta.buyer }}</span>
            <span>{{ t('incoterms') }}: {{ meta.incoterms }}</span>
            <span>{{ t('paymentTerms') }}: {{ meta.paymentTerms }}</span>
          </div>
          <div class="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>{{ t('colSku') }}</th>
                  <th>{{ t('description') }}</th>
                  <th>{{ t('colQty') }}</th>
                  <th>{{ t('unitLabel') }}</th>
                  <th>{{ t('unitPrice') }} {{ meta.currency }}</th>
                  <th>{{ t('amount') }} {{ meta.currency }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="line in lines" :key="line.sku + line.description">
                  <td><input v-model="line.sku" @input="linesLocked = true" /></td>
                  <td><input v-model="line.description" @input="linesLocked = true" /></td>
                  <td><input v-model.number="line.qty" type="number" min="0" @input="linesLocked = true" /></td>
                  <td><input v-model="line.unit" @input="linesLocked = true" /></td>
                  <td><input v-model.number="line.unitPrice" type="number" min="0" step="0.01" @input="linesLocked = true" /></td>
                  <td>{{ format(lineAmount(line)) }}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="5">{{ t('total') }} {{ meta.currency }}</td>
                  <td>{{ format(totals.computedTotal) }}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
        <div class="action-row">
          <button class="btn-secondary" type="button" @click="exportInvoiceCsv(meta, lines, labels)">{{ t('export') }}</button>
          <button class="btn-secondary" type="button" @click="exportInvoiceXlsx(meta, lines, labels)">{{ t('exportXlsx') }}</button>
          <button class="btn-primary" type="button" @click="exportInvoicePdf(meta, lines, t('commercialInvoice'), t('invoiceNoCustoms'))">{{ t('exportPdf') }}</button>
          <button
            v-if="isLoggedIn"
            class="btn-secondary"
            type="button"
            :disabled="cloudBusy || !!issues.length"
            @click="cloudExport('pdf')"
          >
            {{ cloudBusy ? t('cloudReportBusy') : t('cloudReportPdf') }}
          </button>
          <button
            v-if="isLoggedIn"
            class="btn-secondary"
            type="button"
            :disabled="cloudBusy || !!issues.length"
            @click="cloudExport('xlsx')"
          >
            {{ t('cloudReportXlsx') }}
          </button>
        </div>
        <p v-if="cloudMsg" class="field-hint">{{ cloudMsg }}</p>
        <p class="field-hint">{{ t('invoiceHint') }} · {{ t('invoiceNoCustoms') }}</p>
      </div>
      <div class="hint-box">ⓘ {{ t('disclaimer') }}</div>
    </div>
  </div>
</template>

<style scoped>
.action-row { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
.table-scroll input { width: 90px; max-width: 100%; }
.warn { color: #b45309; }
</style>
