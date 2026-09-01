import { api } from './api'

/* ── Types shared with the backend ── */

export type Allowance = {
  free_limit: number
  ad_cap: number
  ad_reward: number
  used: number
  free_used: number
  ad_used: number
  ad_earned: number
  remaining: number
  free_remaining: number
  ad_remaining: number
  reset: string
  watch_ad_gives: number
  blocked: boolean
}

export type ProjectStatus = {
  requests_used: number
  requests_limit: number
  tokens_used: number
  tokens_limit: number
  requests_pct: number
  tokens_pct: number
  combined_pct: number
  warning: 'ok' | 'approaching' | 'critical' | 'exhausted'
  date: string
}

export type AiStatusResponse = {
  gemini_configured: boolean
  provider: 'gemini' | 'mock'
  allowance: Allowance
  project: ProjectStatus
}

// Backend error codes we care about.
export const ERR_DAILY_LIMIT = 'DAILY_LIMIT'
export const ERR_QUOTA = 'AI_QUOTA_EXCEEDED'

/* ── Tiny event bus so the http layer can open dialogs anywhere ── */

export type LimitEvent =
  | { type: 'daily' }
  | { type: 'quota' }

type Listener = (e: LimitEvent) => void

const listeners = new Set<Listener>()

export function onFloxLimit(fn: Listener) {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

export function emitFloxLimit(e: LimitEvent) {
  for (const fn of listeners) fn(e)
}

// Extracts the FLOX error code from an axios error payload if present.
export function floxErrorCode(payload: unknown): string | null {
  if (payload && typeof payload === 'object') {
    const code = (payload as { error?: unknown }).error
    if (typeof code === 'string') return code
  }
  return null
}

// If the error is a FLOX limit/quota response, emit the right event.
export function maybeEmitFloxLimit(err: unknown) {
  const data = (err as { response?: { data?: unknown; status?: number } }).response?.data
  const status = (err as { response?: { status?: number } }).response?.status
  const code = floxErrorCode(data)
  if (code === ERR_DAILY_LIMIT && status === 429) {
    const details = (data as { details?: { blocked?: boolean } })?.details
    if (details && !details.blocked) return
    emitFloxLimit({ type: 'daily' })
  } else if (code === ERR_QUOTA && (status === 503 || status === 429)) {
    emitFloxLimit({ type: 'quota' })
  }
}

/* ── API calls ── */

export function fetchAiStatus() {
  return api.get<AiStatusResponse>('/ai/status/')
}

// Stub: in production this would verify an ad-completion callback before
// crediting. For now it just grants the reward through the backend.
export function rewardWatchAd() {
  return api.post<{ details: Allowance }>('/ai/watch-ad/')
}

export const AD_REWARD_PER_WATCH = 3