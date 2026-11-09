import ExcelJS from 'exceljs'

export type XlsxSheet = {
  name: string
  rows: (string | number | boolean | null | undefined)[][]
}

/** Download one or more worksheets as an .xlsx file. */
export async function downloadXlsx(filename: string, sheets: XlsxSheet[]): Promise<void> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'PackFlow'
  workbook.created = new Date()

  for (const sheet of sheets) {
    const ws = workbook.addWorksheet(sheet.name.slice(0, 31) || 'Sheet1')
    for (const row of sheet.rows) {
      ws.addRow(row.map((cell) => (cell === null || cell === undefined ? '' : cell)))
    }
  }

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Parse the first worksheet (or all) of an .xlsx file into string rows. */
export async function parseXlsx(file: File | ArrayBuffer, sheetIndex = 0): Promise<string[][]> {
  const workbook = new ExcelJS.Workbook()
  const buffer = file instanceof File ? await file.arrayBuffer() : file
  await workbook.xlsx.load(buffer)

  const worksheet = workbook.worksheets[sheetIndex] ?? workbook.worksheets[0]
  if (!worksheet) return []

  const rows: string[][] = []
  worksheet.eachRow({ includeEmpty: false }, (row) => {
    const values: string[] = []
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      while (values.length < colNumber - 1) values.push('')
      const text =
        cell.text !== undefined && cell.text !== null
          ? String(cell.text)
          : cell.value === null || cell.value === undefined
            ? ''
            : String(cell.value)
      values[colNumber - 1] = text.trim()
    })
    if (values.some((v) => v !== '')) rows.push(values)
  })
  return rows
}

/** Parse all worksheets into a name → rows map. */
export async function parseXlsxAll(file: File | ArrayBuffer): Promise<Record<string, string[][]>> {
  const workbook = new ExcelJS.Workbook()
  const buffer = file instanceof File ? await file.arrayBuffer() : file
  await workbook.xlsx.load(buffer)
  const out: Record<string, string[][]> = {}
  for (const worksheet of workbook.worksheets) {
    const rows: string[][] = []
    worksheet.eachRow({ includeEmpty: false }, (row) => {
      const values: string[] = []
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        while (values.length < colNumber - 1) values.push('')
        const text =
          cell.text !== undefined && cell.text !== null
            ? String(cell.text)
            : cell.value === null || cell.value === undefined
              ? ''
              : String(cell.value)
        values[colNumber - 1] = text.trim()
      })
      if (values.some((v) => v !== '')) rows.push(values)
    })
    out[worksheet.name] = rows
  }
  return out
}
