import { computed, ref } from 'vue'
import * as authApi from '../../api/auth'
import { ApiError } from '../../api/http'
import { setSchemeMode } from '../persistence/schemeRepository'

export type SessionUser = {
  id: string
  email: string
  locale?: string
}

const user = ref<SessionUser | null>(null)
const busy = ref(false)
const ready = ref(false)
const lastError = ref('')

export const isLoggedIn = computed(() => !!user.value)
export const currentUser = computed(() => user.value)
export const authBusy = computed(() => busy.value)
export const authReady = computed(() => ready.value)
export const authError = computed(() => lastError.value)

export async function bootstrapAuth(): Promise<void> {
  busy.value = true
  lastError.value = ''
  try {
    await authApi.fetchCsrf()
    try {
      const me = await authApi.fetchMe()
      user.value = {
        id: me.user.id,
        email: me.user.email,
        locale: me.user.locale,
      }
      setSchemeMode('cloud')
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        user.value = null
        setSchemeMode('local')
      } else {
        user.value = null
        setSchemeMode('local')
      }
    }
  } finally {
    busy.value = false
    ready.value = true
  }
}

export async function register(email: string, password: string, locale?: string): Promise<void> {
  busy.value = true
  lastError.value = ''
  try {
    const u = await authApi.register({ email, password, locale })
    user.value = { id: u.id, email: u.email }
    setSchemeMode('cloud')
  } catch (err) {
    lastError.value = err instanceof Error ? err.message : String(err)
    throw err
  } finally {
    busy.value = false
  }
}

export async function login(email: string, password: string): Promise<void> {
  busy.value = true
  lastError.value = ''
  try {
    const u = await authApi.login({ email, password })
    user.value = { id: u.id, email: u.email }
    setSchemeMode('cloud')
  } catch (err) {
    lastError.value = err instanceof Error ? err.message : String(err)
    throw err
  } finally {
    busy.value = false
  }
}

export async function logout(): Promise<void> {
  busy.value = true
  lastError.value = ''
  try {
    await authApi.logout()
  } catch {
    // still clear local session
  } finally {
    user.value = null
    setSchemeMode('local')
    busy.value = false
  }
}
