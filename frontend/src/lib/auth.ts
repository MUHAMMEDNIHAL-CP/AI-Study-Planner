import { jwtDecode } from 'jwt-decode'

const ACCESS_KEY = 'access_token'
const REFRESH_KEY = 'refresh_token'

type JwtPayload = {
  exp?: number
}

export function getAccessToken() {
  return localStorage.getItem(ACCESS_KEY)
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY)
}

export function setAuthTokens(access: string, refresh?: string) {
  localStorage.setItem(ACCESS_KEY, access)
  if (refresh) localStorage.setItem(REFRESH_KEY, refresh)
}

export function clearAuthTokens() {
  localStorage.removeItem(ACCESS_KEY)
  localStorage.removeItem(REFRESH_KEY)
}

export function isAuthenticated() {
  const token = getAccessToken()
  if (!token) return false

  try {
    const payload = jwtDecode<JwtPayload>(token)
    if (!payload.exp) return true
    return payload.exp * 1000 > Date.now()
  } catch {
    clearAuthTokens()
    return false
  }
}
