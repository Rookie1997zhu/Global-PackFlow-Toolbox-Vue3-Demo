import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import { parseXlsx, parseXlsxAll } from '../shared/export/xlsx'

async function buildMultiSheetBuffer(): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook()
  const a = wb.addWorksheet('Alpha')
  a.addRow(['h1'])
  a.addRow(['a'])
  const b = wb.addWorksheet('Beta')
  b.addRow(['sku', 'qty'])
  b.addRow(['SKU-B', '12'])
  const buf = await wb.xlsx.writeBuffer()
  return buf as ArrayBuffer
}

describe('parseXlsx multi-sheet', () => {
  it('reads selected sheet index', async () => {
    const buf = await buildMultiSheetBuffer()
    const sheet0 = await parseXlsx(buf, 0)
    const sheet1 = await parseXlsx(buf, 1)
    expect(sheet0[0][0]).toBe('h1')
    expect(sheet1[0][0]).toBe('sku')
    expect(sheet1[1][0]).toBe('SKU-B')
  })

  it('falls back to sheet 0 when index is out of range', async () => {
    const buf = await buildMultiSheetBuffer()
    const rows = await parseXlsx(buf, 99)
    expect(rows[0][0]).toBe('h1')
  })

  it('parseXlsxAll returns all sheet names', async () => {
    const buf = await buildMultiSheetBuffer()
    const all = await parseXlsxAll(buf)
    expect(Object.keys(all).sort()).toEqual(['Alpha', 'Beta'])
    expect(all.Beta[1][1]).toBe('12')
  })
})
