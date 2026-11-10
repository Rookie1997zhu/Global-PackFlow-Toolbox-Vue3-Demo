import { afterEach, describe, expect, it, vi } from 'vitest'
import { setCsrfToken } from '../api/http'
import { importPreview } from '../api/imports'

describe('importsApi sheetIndex', () => {
  afterEach(() => {
    setCsrfToken(null)
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('posts sheetIndex in importPreview body', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes('/auth/csrf/')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: true, data: { csrfToken: 'tok' } }),
        }
      }
      return {
        ok: true,
        status: 201,
        json: async () => ({
          ok: true,
          data: {
            id: 'imp_1',
            fileId: 'f1',
            status: 'preview',
            mapping: {},
            suggestedMapping: {},
            headers: ['sku'],
            issues: [],
            previewRows: [],
            rowCount: 0,
            mappedSample: [],
            sheetIndex: 2,
            sheets: [
              { index: 0, name: 'A' },
              { index: 2, name: 'C' },
            ],
            teamId: 't1',
          },
        }),
      }
    })
    vi.stubGlobal('fetch', fetchMock)

    const res = await importPreview('file-uuid', { sku: 0 }, 2)
    expect(res.sheetIndex).toBe(2)
    const previewCall = fetchMock.mock.calls.find(([u]) => String(u).includes('/imports/preview/'))
    expect(previewCall).toBeTruthy()
    const init = previewCall![1] as RequestInit
    expect(init.method).toBe('POST')
    const body = JSON.parse(String(init.body))
    expect(body).toMatchObject({ fileId: 'file-uuid', mapping: { sku: 0 }, sheetIndex: 2 })
  })
})
