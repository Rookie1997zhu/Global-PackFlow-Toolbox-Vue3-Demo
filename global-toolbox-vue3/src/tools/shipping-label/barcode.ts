import bwipjs from 'bwip-js/browser'

export type BarcodeKind = 'code128' | 'qr'

/** Render a barcode/QR as a PNG data URL using bwip-js. */
export async function renderBarcodeDataUrl(
  text: string,
  kind: BarcodeKind = 'code128',
  scale = 2,
): Promise<string> {
  const value = String(text || '').trim() || 'EMPTY'
  const canvas = document.createElement('canvas')
  await bwipjs.toCanvas(canvas, {
    bcid: kind === 'qr' ? 'qrcode' : 'code128',
    text: value,
    scale,
    height: kind === 'qr' ? undefined : 12,
    includetext: kind === 'code128',
    textxalign: 'center',
  })
  return canvas.toDataURL('image/png')
}

export function buildCartonCodes(
  po: string,
  from: number,
  to: number,
  total: number,
): { index: number; code: string; label: string }[] {
  const start = Math.max(1, Math.floor(from))
  const end = Math.max(start, Math.floor(to))
  const totalSafe = Math.max(end, Math.floor(total) || end)
  const out: { index: number; code: string; label: string }[] = []
  for (let i = start; i <= end; i++) {
    const padded = String(i).padStart(3, '0')
    const totalPadded = String(totalSafe).padStart(3, '0')
    out.push({
      index: i,
      code: `${po || 'PO'}-${padded}`,
      label: `${padded} / ${totalPadded}`,
    })
  }
  return out
}
