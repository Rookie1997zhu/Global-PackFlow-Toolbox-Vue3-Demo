import fontkit from '@pdf-lib/fontkit'
import { PDFDocument, type PDFFont, type PDFPage, rgb } from 'pdf-lib'

const A4: [number, number] = [595, 842]
const MARGIN_X = 40
const MARGIN_TOP = 800
const MARGIN_BOTTOM = 48
const FONT_URL = '/fonts/NotoSansKR-Regular.otf'

let fontBytesCache: ArrayBuffer | null = null

async function loadKoreanFontBytes(): Promise<ArrayBuffer> {
  if (fontBytesCache) return fontBytesCache
  const res = await fetch(FONT_URL)
  if (!res.ok) {
    throw new Error(`Failed to load Korean PDF font (${res.status})`)
  }
  fontBytesCache = await res.arrayBuffer()
  return fontBytesCache
}

export type PdfWriter = {
  doc: PDFDocument
  font: PDFFont
  bold: PDFFont
  page: PDFPage
  y: number
  pageNo: number
  drawLine: (text: string, size?: number, useBold?: boolean) => void
  ensureSpace: (needed: number) => void
  finish: (filename: string) => Promise<void>
}

/** Create an A4 PDF writer with embedded Korean-capable font and auto pagination. */
export async function createKoreanPdfWriter(): Promise<PdfWriter> {
  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)
  const bytes = await loadKoreanFontBytes()
  const font = await doc.embedFont(bytes, { subset: true })
  const bold = font
  let page = doc.addPage(A4)
  let y = MARGIN_TOP
  let pageNo = 1

  const paintFooter = (target: PDFPage, num: number) => {
    target.drawText(String(num), {
      x: A4[0] / 2 - 4,
      y: 28,
      size: 9,
      font,
      color: rgb(0.4, 0.45, 0.5),
    })
  }

  const newPage = () => {
    paintFooter(page, pageNo)
    page = doc.addPage(A4)
    pageNo += 1
    y = MARGIN_TOP
  }

  const ensureSpace = (needed: number) => {
    if (y - needed < MARGIN_BOTTOM) newPage()
  }

  const wrap = (text: string, size: number, maxWidth: number): string[] => {
    const raw = String(text ?? '').replace(/\s+/g, ' ').trim()
    if (!raw) return ['']
    const chars = [...raw]
    const lines: string[] = []
    let current = ''
    for (const ch of chars) {
      const trial = current + ch
      const width = font.widthOfTextAtSize(trial, size)
      if (width > maxWidth && current) {
        lines.push(current)
        current = ch
      } else {
        current = trial
      }
    }
    if (current) lines.push(current)
    return lines.length ? lines : ['']
  }

  const drawLine = (text: string, size = 10, useBold = false) => {
    const maxWidth = A4[0] - MARGIN_X * 2
    const parts = wrap(text, size, maxWidth)
    for (const part of parts) {
      ensureSpace(size + 8)
      page.drawText(part, {
        x: MARGIN_X,
        y,
        size,
        font: useBold ? bold : font,
        color: rgb(0.12, 0.2, 0.3),
      })
      y -= size + 6
    }
  }

  const finish = async (filename: string) => {
    paintFooter(page, pageNo)
    const out = await doc.save()
    const blob = new Blob([out], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename.endsWith('.pdf') ? filename : `${filename}.pdf`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return { doc, font, bold, page, y, pageNo, drawLine, ensureSpace, finish }
}
