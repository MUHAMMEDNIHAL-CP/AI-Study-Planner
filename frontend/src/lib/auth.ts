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

/** True when the JWT is present and, if it has an expiry, is not yet expired. */
function isValidToken(token: string | null): boolean {
  if (!token) return false
  try {
    const payload = jwtDecode<JwtPayload>(token)
    if (!payload.exp) return true
    return payload.exp * 1000 > Date.now()
  } catch {
    return false
  }
}

/** True only when the (short-lived) access token is still usable. */
export function hasValidAccessToken(): boolean {
  return isValidToken(getAccessToken())
}

export function isAuthenticated() {
  // A session is alive while EITHER token is valid. The refresh token is
  // long-lived (e.g. 30 days), so a student returning hours later with a still
  // valid refresh token stays logged in even after the short-lived access token
  // has expired. Only a real logout, an expired/invalid refresh token, or
  // cleared site data should end the session.
  if (hasValidAccessToken()) return true
  if (isValidToken(getRefreshToken())) return true

  // Neither token is usable any more; clean up and treat as logged out so the
  // app redirects to login instead of trying to refresh forever.
  if (getAccessToken() || getRefreshToken()) clearAuthTokens()
  return false
}
