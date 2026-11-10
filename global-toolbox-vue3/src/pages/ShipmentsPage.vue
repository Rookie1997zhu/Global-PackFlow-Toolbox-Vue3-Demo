<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { Locale } from '../i18n'
import {
  createShipmentApi,
  emptyShipmentPayload,
  listShipmentsApi,
  type ApiShipment,
} from '../api/shipments'
import { ApiError } from '../api/http'

const props = defineProps<{
  t: (key: string) => string
  locale: Locale
  isLoggedIn: boolean
}>()

const emit = defineEmits<{ requestLogin: [] }>()

const router = useRouter()
const loading = ref(false)
const error = ref('')
const items = ref<ApiShipment[]>([])
const q = ref('')
const creating = ref(false)
const newNo = ref('')

const load = async () => {
  if (!props.isLoggedIn) {
    items.value = []
    return
  }
  loading.value = true
  error.value = ''
  try {
    const res = await listShipmentsApi({ q: q.value || undefined })
    items.value = res.items
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : props.t('shipmentsLoadError')
    items.value = []
  } finally {
    loading.value = false
  }
}

const openDetail = (id: string) => {
  void router.push(`/${props.locale}/shipments/${encodeURIComponent(id)}/`)
}

const createOne = async () => {
  if (!props.isLoggedIn) {
    emit('requestLogin')
    return
  }
  const no = (newNo.value || '').trim() || `SHP-${Date.now().toString(36).toUpperCase()}`
  creating.value = true
  error.value = ''
  try {
    const created = await createShipmentApi({
      shipmentNo: no,
      payload: emptyShipmentPayload(),
    })
    newNo.value = ''
    openDetail(created.id)
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : props.t('shipmentsCreateError')
  } finally {
    creating.value = false
  }
}

onMounted(() => {
  void load()
})
</script>

<template>
  <div class="page-heading">
    <button class="back" type="button" @click="router.push(`/${locale}/`)">← {{ t('all') }}</button>
    <div class="eyebrow dark">{{ t('shipmentsEyebrow') }}</div>
    <h1>{{ t('shipmentsTitle') }}</h1>
    <p>{{ t('shipmentsSub') }}</p>
  </div>

  <div v-if="!isLoggedIn" class="panel">
    <p>{{ t('shipmentsNeedLogin') }}</p>
    <button class="btn-primary" type="button" @click="emit('requestLogin')">{{ t('sign') }}</button>
  </div>

  <template v-else>
    <div class="panel shipment-list-toolbar" style="margin-bottom: 14px">
      <div class="panel-heading" style="gap: 10px; flex-wrap: wrap">
        <div class="search-wrap" style="flex: 1; min-width: 160px">
          <span>⌕</span>
          <input v-model="q" :placeholder="t('shipmentsSearch')" @keyup.enter="load" />
        </div>
        <button class="btn-secondary" type="button" :disabled="loading" @click="load">{{ t('refresh') }}</button>
        <input v-model="newNo" class="cell-name" :placeholder="t('shipmentsNoPlaceholder')" style="max-width: 160px" />
        <button class="btn-primary" type="button" :disabled="creating" @click="createOne">
          + {{ t('shipmentsCreate') }}
        </button>
      </div>
      <p v-if="error" class="field-hint" style="color: #a33b25">{{ error }}</p>
      <button
        v-if="error"
        class="btn-secondary"
        type="button"
        style="margin-top: 8px"
        :disabled="loading"
        @click="load"
      >
        {{ t('retry') }}
      </button>
    </div>

    <div class="panel">
      <p v-if="loading">{{ t('loading') }}</p>
      <p v-else-if="!items.length" class="empty">{{ t('shipmentsEmpty') }}</p>
      <div v-else class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>{{ t('shipmentsNo') }}</th>
              <th>{{ t('status') }}</th>
              <th>{{ t('shipmentsRevision') }}</th>
              <th>{{ t('shipmentsUpdated') }}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in items" :key="s.id">
              <td>{{ s.shipmentNo }}</td>
              <td>{{ s.status }}</td>
              <td>r{{ s.revisionNo ?? '—' }}</td>
              <td>{{ s.updatedAt?.slice(0, 19)?.replace('T', ' ') || '—' }}</td>
              <td>
                <button class="btn-secondary" type="button" @click="openDetail(s.id)">{{ t('open') }}</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </template>
</template>
