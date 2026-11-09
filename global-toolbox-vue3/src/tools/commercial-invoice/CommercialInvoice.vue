<script setup lang="ts">
import { computed, inject, reactive, ref, watch, type Ref } from 'vue'
import type { Locale } from '../../i18n'
import { useCargo } from '../../shared/cargo/useCargo'
import { formatNumber } from '../../shared/format/number'
import {
  computeInvoiceTotals,
  exportInvoiceCsv,
  exportInvoicePdf,
  exportInvoiceXlsx,
  lineAmount,
  linesFromCargo,
  validateInvoice,
  type InvoiceLine,
  type InvoiceMeta,
} from './useInvoice'

const props = defineProps<{ t: (key: string) => string }>()
const emit = defineEmits<{ editCargo: [] }>()

const hostLocale = inject<Ref<Locale>>('hostLocale', ref('en'))
const { cargo } = useCargo()
const format = (v: number, d = 2) => formatNumber(v, hostLocale.value, d)

const meta = reactive<InvoiceMeta>({
  seller: 'YOUR COMPANY',
  buyer: 'CUSTOMER NAME',
  invoiceNo: 'INV-2026-001',
  po: 'PO-2026-001',
  currency: 'USD',
  incoterms: 'FOB',
  paymentTerms: 'T/T 30 days',
})

const lines = ref<InvoiceLine[]>(linesFromCargo(cargo.value))

watch(
  cargo,
  (rows) => {
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
  lines.value = linesFromCargo(cargo.value)
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
        <button class="btn-secondary full" @click="syncFromCargo">{{ t('syncFromCargo') }}</button>
        <p v-if="issues.length" class="field-hint warn">{{ issues.map((c) => t(c)).join(' · ') }}</p>
      </div>
      <div class="mini-panel">
        <span>▧</span>
        <div><strong>{{ lines.length }} {{ t('items') }} · {{ format(totals.computedTotal) }} {{ meta.currency }}</strong><p>{{ t('sharedDesc') }}</p></div>
        <button @click="emit('editCargo')">{{ t('edit') }} ↗</button>
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
                  <td><input v-model="line.sku" /></td>
                  <td><input v-model="line.description" /></td>
                  <td><input v-model.number="line.qty" type="number" min="0" /></td>
                  <td><input v-model="line.unit" /></td>
                  <td><input v-model.number="line.unitPrice" type="number" min="0" step="0.01" /></td>
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
          <button class="btn-secondary" @click="exportInvoiceCsv(meta, lines, labels)">{{ t('export') }}</button>
          <button class="btn-secondary" @click="exportInvoiceXlsx(meta, lines, labels)">{{ t('exportXlsx') }}</button>
          <button class="btn-primary" @click="exportInvoicePdf(meta, lines, t('commercialInvoice'), t('invoiceNoCustoms'))">{{ t('exportPdf') }}</button>
        </div>
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
