import { apiRequest, ensureCsrf, getCsrfToken, ApiError } from './http'

export type FileAssetDto = {
  id: string
  uploadId?: string
  uploadUrl?: string
  filename: string
  size: number
  mime: string
  status: string
  purpose: string
  sha256?: string | null
  teamId: string
  expiresAt: string
  maxBytes?: number
}

export async function uploadInit(input: {
  filename: string
  size: number
  contentType?: string
  purpose?: string
}): Promise<FileAssetDto> {
  return apiRequest<FileAssetDto>('/api/v1/files/uploads/init/', {
    method: 'POST',
    json: {
      filename: input.filename,
      size: input.size,
      contentType: input.contentType || '',
      purpose: input.purpose || 'cargo_import',
    },
  })
}

export async function uploadContent(uploadUrl: string, body: Blob | ArrayBuffer | Uint8Array): Promise<void> {
  if (!getCsrfToken()) await ensureCsrf()
  const headers = new Headers()
  const csrf = getCsrfToken()
  if (csrf) headers.set('X-CSRFToken', csrf)
  headers.set('Content-Type', 'application/octet-stream')
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    credentials: 'include',
    headers,
    body: body as BodyInit,
  })
  if (!res.ok) {
    let code = 'API_ERROR'
    let message = `Upload failed (${res.status})`
    try {
      const json = (await res.json()) as { ok?: boolean; code?: string; message?: string }
      if (json && json.ok === false) {
        code = json.code || code
        message = json.message || message
      }
    } catch {
      /* ignore */
    }
    throw new ApiError({ code, message, status: res.status })
  }
}

export async function uploadComplete(uploadId: string): Promise<FileAssetDto> {
  return apiRequest<FileAssetDto>('/api/v1/files/uploads/complete/', {
    method: 'POST',
    json: { uploadId },
  })
}

/** Full upload pipeline: init → content → complete. */
export async function uploadCargoFile(file: File): Promise<FileAssetDto> {
  const init = await uploadInit({
    filename: file.name,
    size: file.size,
    contentType: file.type || '',
  })
  const url = init.uploadUrl || `/api/v1/files/uploads/${init.uploadId || init.id}/content/`
  const uploadId = init.uploadId || init.id
  await uploadContent(url, file)
  return uploadComplete(uploadId)
}
