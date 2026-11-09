import { csv, download } from '../../shared/export/csv'
import { buildCartonCodes, type BarcodeKind } from './barcode'

export type LabelSettings = {
  shipper: string
  consignee: string
  po: string
  madeIn: string
  widthMm: number
  heightMm: number
  cartonFrom: number
  cartonTo: number
  totalCartons: number
  barcodeKind: BarcodeKind
  extraText: string
}

export type LabelPreviewItem = {
  index: number
  code: string
  label: string
  shipper: string
  consignee: string
  po: string
  madeIn: string
  extraText: string
  barcodeKind: BarcodeKind
  widthMm: number
  heightMm: number
}

export function buildLabelItems(settings: LabelSettings): LabelPreviewItem[] {
  const codes = buildCartonCodes(
    settings.po,
    settings.cartonFrom,
    settings.cartonTo,
    settings.totalCartons || settings.cartonTo,
  )
  return codes.map((c) => ({
    ...c,
    shipper: settings.shipper,
    consignee: settings.consignee,
    po: settings.po,
    madeIn: settings.madeIn,
    extraText: settings.extraText,
    barcodeKind: settings.barcodeKind,
    widthMm: Math.max(40, settings.widthMm),
    heightMm: Math.max(30, settings.heightMm),
  }))
}

export function exportLabelCsv(items: LabelPreviewItem[], labels: Record<string, string>): void {
  download(
    'shipping-marks.csv',
    csv([
      [labels.po, labels.shipper, labels.consignee, labels.carton, labels.code, labels.madeIn],
      ...items.map((item) => [item.po, item.shipper, item.consignee, item.label, item.code, item.madeIn]),
    ]),
  )
}

export function defaultLabelSettings(totalCartons: number): LabelSettings {
  const total = Math.max(1, Math.floor(totalCartons) || 1)
  return {
    shipper: 'YOUR COMPANY',
    consignee: 'CUSTOMER NAME',
    po: 'PO-2026-001',
    madeIn: 'CHINA',
    widthMm: 100,
    heightMm: 80,
    cartonFrom: 1,
    cartonTo: Math.min(total, 6),
    totalCartons: total,
    barcodeKind: 'code128',
    extraText: '',
  }
}
