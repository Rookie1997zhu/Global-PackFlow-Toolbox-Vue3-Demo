import { computed, ref } from 'vue'
import { createEmptyCargo, createSampleCargo, type Cargo, type CargoRow } from '../types/cargo'
import { sanitizeNonNegative } from '../validation'
import { csv, download } from '../export/csv'

const cargo = ref<Cargo[]>(createSampleCargo())

function n(v: unknown): number {
  return sanitizeNonNegative(v)
}

function volumeM3(c: Cargo): number {
  return (n(c.length) * n(c.width) * n(c.height)) / 1e6
}

export function useCargo() {
  const cbm = computed(() => cargo.value.reduce((s, c) => s + volumeM3(c) * n(c.qty), 0))
  const gross = computed(() => cargo.value.reduce((s, c) => s + n(c.weight) * n(c.qty), 0))
  const qty = computed(() => cargo.value.reduce((s, c) => s + n(c.qty), 0))
  const goodsValue = computed(() => cargo.value.reduce((s, c) => s + n(c.price) * n(c.qty), 0))
  const cargoRows = computed<CargoRow[]>(() =>
    cargo.value.map((c) => ({
      ...c,
      cbm: volumeM3(c) * n(c.qty),
      totalWeight: n(c.weight) * n(c.qty),
      totalPrice: n(c.price) * n(c.qty),
    })),
  )

  const addCargo = () => {
    cargo.value.push(createEmptyCargo(cargo.value.length + 1))
  }

  const removeCargo = (index: number) => {
    cargo.value.splice(index, 1)
  }

  const reset = () => {
    cargo.value = createSampleCargo()
  }

  const setCargo = (rows: Cargo[]) => {
    cargo.value = rows
  }

  const exportCargo = (headers: string[]) => {
    download(
      'cargo-data.csv',
      csv([
        headers,
        ...cargo.value.map((c) => [c.sku, c.length, c.width, c.height, c.weight, c.qty, c.price]),
      ]),
    )
  }

  return {
    cargo,
    cbm,
    gross,
    qty,
    goodsValue,
    cargoRows,
    volumeM3,
    addCargo,
    removeCargo,
    reset,
    setCargo,
    exportCargo,
    n,
  }
}
