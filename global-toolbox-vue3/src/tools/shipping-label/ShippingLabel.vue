<script setup lang="ts">
import { computed, inject, onMounted, reactive, ref, watch, type Ref } from 'vue'
import type { Locale } from '../../i18n'
import { useCargo } from '../../shared/cargo/useCargo'
import { renderBarcodeDataUrl } from './barcode'
import { buildLabelItems, defaultLabelSettings, exportLabelCsv } from './useLabel'

const props = defineProps<{ t: (key: string) => string }>()
const emit = defineEmits<{ editCargo: [] }>()

const hostLocale = inject<Ref<Locale>>('hostLocale', ref('en'))
void hostLocale
const { qty } = useCargo()

const settings = reactive(defaultLabelSettings(qty.value || 1))
watch(qty, (q) => {
  settings.totalCartons = Math.max(1, Math.floor(q) || 1)
})

const items = computed(() => buildLabelItems(settings))
const barcodeMap = ref<Record<string, string>>({})
const barcodeError = ref('')

const refreshBarcodes = async () => {
  barcodeError.value = ''
  const next: Record<string, string> = {}
  try {
    for (const item of items.value) {
      next[item.code] = await renderBarcodeDataUrl(item.code, item.barcodeKind)
    }
    barcodeMap.value = next
  } catch (err) {
    barcodeError.value = err instanceof Error ? err.message : String(err)
  }
}

watch(items, () => {
  void refreshBarcodes()
}, { deep: true })

onMounted(() => {
  void refreshBarcodes()
})

const onPrint = () => window.print()

const onExport = () =>
  exportLabelCsv(items.value, {
    po: props.t('poLabel'),
    shipper: props.t('shipper'),
    consignee: props.t('consignee'),
    carton: props.t('csvCarton'),
    code: props.t('barcodeValue'),
    madeIn: props.t('madeIn'),
  })
</script>

<template>
  <div class="tool-layout">
    <div class="tool-settings">
      <div class="panel">
        <div class="panel-heading"><h3>{{ t('settings') }}</h3><span class="small-badge">{{ t('live') }}</span></div>
        <label class="field">{{ t('shipper') }}<input v-model="settings.shipper" /></label>
        <label class="field">{{ t('consignee') }}<input v-model="settings.consignee" /></label>
        <label class="field">{{ t('poNumber') }}<input v-model="settings.po" /></label>
        <label class="field">{{ t('madeIn') }}<input v-model="settings.madeIn" /></label>
        <label class="field">{{ t('labelWidthMm') }}<input v-model.number="settings.widthMm" type="number" min="40" /></label>
        <label class="field">{{ t('labelHeightMm') }}<input v-model.number="settings.heightMm" type="number" min="30" /></label>
        <label class="field">{{ t('cartonFrom') }}<input v-model.number="settings.cartonFrom" type="number" min="1" /></label>
        <label class="field">{{ t('cartonTo') }}<input v-model.number="settings.cartonTo" type="number" min="1" /></label>
        <label class="field">{{ t('totalCartons') }}<input v-model.number="settings.totalCartons" type="number" min="1" /></label>
        <label class="field">{{ t('barcodeType') }}
          <select v-model="settings.barcodeKind">
            <option value="code128">Code128</option>
            <option value="qr">QR</option>
          </select>
        </label>
        <label class="field">{{ t('extraText') }}<input v-model="settings.extraText" /></label>
        <button class="btn-primary full" @click="onPrint">{{ t('printPdf') }} ↗</button>
      </div>
      <div class="mini-panel">
        <span>▤</span>
        <div><strong>{{ items.length }} {{ t('labelsCount') }}</strong><p>{{ t('sharedDesc') }}</p></div>
        <button @click="emit('editCargo')">{{ t('edit') }} ↗</button>
      </div>
    </div>
    <div class="tool-output">
      <div class="panel output-panel">
        <div class="panel-heading"><h3>{{ t('results') }}</h3><span class="small-badge light">{{ t('autoUpdated') }}</span></div>
        <p v-if="barcodeError" class="field-hint warn">{{ barcodeError }}</p>
        <div class="print-area label-print">
          <div class="document-top">{{ t('shippingMark') }}</div>
          <div class="label-grid">
            <div
              v-for="item in items"
              :key="item.code"
              class="label-sheet"
              :style="{ width: item.widthMm + 'mm', minHeight: item.heightMm + 'mm' }"
            >
              <strong>{{ item.consignee }}</strong>
              <span>{{ t('fromLabel') }}: {{ item.shipper }}</span>
              <span>{{ t('poLabel') }}: {{ item.po }}</span>
              <span>{{ t('ctnNo') }}: {{ item.label }}</span>
              <span>{{ t('madeIn') }}: {{ item.madeIn }}</span>
              <span v-if="item.extraText">{{ item.extraText }}</span>
              <img v-if="barcodeMap[item.code]" class="barcode-img" :src="barcodeMap[item.code]" :alt="item.code" />
              <small>{{ item.code }}</small>
            </div>
          </div>
        </div>
        <button class="btn-secondary" @click="onExport">{{ t('export') }}</button>
        <p class="field-hint">{{ t('labelsHint') }}</p>
      </div>
      <div class="hint-box">ⓘ {{ t('disclaimer') }}</div>
    </div>
  </div>
</template>

<style scoped>
.label-grid { display: flex; flex-wrap: wrap; gap: 12px; }
.label-sheet {
  border: 1px dashed #111;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  box-sizing: border-box;
  background: #fff;
}
.barcode-img { width: 100%; max-height: 48px; object-fit: contain; margin-top: 4px; }
.warn { color: #b45309; }
@media print {
  .tool-settings, .hint-box, .btn-secondary, .panel-heading, .field-hint, .mini-panel { display: none !important; }
  .label-print { box-shadow: none; }
}
</style>
