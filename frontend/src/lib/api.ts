import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { clearAuthTokens, getAccessToken, getRefreshToken, setAuthTokens } from './auth'

export const API_BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000'

type RetryConfig = InternalAxiosRequestConfig & {
  _retry?: boolean
}

type ErrorPayload = {
  detail?: string
  non_field_errors?: string[]
  [key: string]: unknown
}

export const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ErrorPayload>) => {
    const original = error.config as RetryConfig | undefined
    const refresh = getRefreshToken()

    if (error.response?.status === 401 && original && !original._retry && refresh) {
      original._retry = true
      try {
        const res = await axios.post<{ access: string }>(`${API_BASE_URL}/api/auth/token/refresh/`, { refresh })
        setAuthTokens(res.data.access)
        original.headers.Authorization = `Bearer ${res.data.access}`
        return api(original)
      } catch {
        clearAuthTokens()
        window.location.assign('/login')
      }
    }

    return Promise.reject(error)
  },
)

export function getErrorMessage(error: unknown) {
  if (axios.isAxiosError<ErrorPayload>(error)) {
    const data = error.response?.data
    if (data?.detail) return data.detail
    if (data?.non_field_errors?.length) return data.non_field_errors.join(' ')
    if (data) {
      const first = Object.values(data).find(Boolean)
      if (Array.isArray(first)) return first.join(' ')
      if (typeof first === 'string') return first
    }
  }
  if (error instanceof Error) return error.message
  return 'Something went wrong'
}
