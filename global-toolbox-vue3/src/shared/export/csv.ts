/** Build CSV text with quoted fields and CRLF (Excel-friendly). */
export function csv(rows: (string | number)[][]): string {
  return rows
    .map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(','))
    .join('\r\n')
}

/** Download a text file with UTF-8 BOM when mime is CSV. */
export function download(filename: string, content: string, mime = 'text/csv;charset=utf-8'): void {
  const withBom = mime.includes('csv') ? `\ufeff${content}` : content
  const blob = new Blob([withBom], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Minimal CSV parser supporting quoted fields and CRLF/LF. */
export function parseCsv(text: string): string[][] {
  const input = text.replace(/^\ufeff/, '')
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < input.length; i++) {
    const ch = input[i]
    const next = input[i + 1]
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"'
        i++
      } else if (ch === '"') {
        inQuotes = false
      } else {
        field += ch
      }
      continue
    }
    if (ch === '"') {
      inQuotes = true
      continue
    }
    if (ch === ',') {
      row.push(field)
      field = ''
      continue
    }
    if (ch === '\r') continue
    if (ch === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      continue
    }
    field += ch
  }
  if (field.length || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => r.some((c) => String(c).trim() !== ''))
}

export function normalizeHeader(value: string): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_/]+/g, '')
}
