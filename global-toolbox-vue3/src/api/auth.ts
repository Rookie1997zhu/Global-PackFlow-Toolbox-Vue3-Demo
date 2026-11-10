import { apiRequest, ensureCsrf } from './http'

export type MePayload = {
  user: {
    id: string
    email: string
    locale?: string
    timezone?: string
  }
  memberships: Array<{
    id: string
    teamId: string
    role: string
    email?: string
  }>
  currentTeam: {
    id: string
    name: string
    locale?: string
    currency?: string
  } | null
}

export async function fetchCsrf(): Promise<string> {
  return ensureCsrf()
}

export async function register(input: {
  email: string
  password: string
  locale?: string
}): Promise<{ id: string; email: string }> {
  await ensureCsrf()
  return apiRequest('/api/v1/auth/register/', { method: 'POST', json: input })
}

export async function login(input: { email: string; password: string }): Promise<{
  id: string
  email: string
}> {
  await ensureCsrf()
  return apiRequest('/api/v1/auth/login/', { method: 'POST', json: input })
}

export async function logout(): Promise<void> {
  await ensureCsrf()
  await apiRequest('/api/v1/auth/logout/', { method: 'POST', json: {} })
}

export async function fetchMe(): Promise<MePayload> {
  return apiRequest<MePayload>('/api/v1/me/')
}
