import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { clearAuthTokens, getAccessToken, getRefreshToken, isAuthenticated, setAuthTokens } from './auth'

function resolveApiBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_API_URL as string | undefined
  if (fromEnv) {
    // Normalize: trim trailing slashes; in production, prefer HTTPS.
    let url = fromEnv.trim().replace(/\/+$/, '')
    if (url.startsWith('http://') && window.location.protocol === 'https:') {
      url = `https://${url.slice('http://'.length)}`
    }
    return url
  }
  // Local dev default. The dev server is HTTP, but production builds should set VITE_API_URL.
  return 'http://localhost:8000'
}

export const API_BASE_URL = resolveApiBaseUrl()

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

api.interceptors.request.use(async (config) => {
  // Do not attach tokens to refresh requests or when the token is expired.
  const isRefresh = config.url?.includes('/auth/token/refresh/')
  if (isRefresh) return config

  let access = getAccessToken()
  const refresh = getRefreshToken()

  // If the access token is missing or expired but we have a refresh token,
  // proactively refresh before sending the request.
  if ((!access || !isAuthenticated()) && refresh) {
    try {
      const res = await axios.post<{ access: string }>(`${API_BASE_URL}/api/auth/token/refresh/`, { refresh })
      setAuthTokens(res.data.access)
      access = res.data.access
    } catch {
      clearAuthTokens()
      window.location.assign('/login')
    }
  }

  if (access && isAuthenticated()) {
    config.headers.Authorization = `Bearer ${access}`
  } else {
    delete config.headers.Authorization
  }
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
