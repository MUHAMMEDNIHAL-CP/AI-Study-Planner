import { api } from './api'

/**
 * Onboarding tour version. Bump this when the essential tour changes so users
 * who completed an older version see the new relevant steps again. New users
 * are always shown the tour regardless.
 */
export const ONBOARDING_VERSION = 2

const TOUR_KEY = 'FLOX.onboarding'

export type OnboardingState = {
  completed: boolean
  version: number
  completedAt: string | null
}

const EMPTY: OnboardingState = { completed: false, version: 0, completedAt: null }

function loadLocal(): OnboardingState | null {
  try {
    const raw = localStorage.getItem(TOUR_KEY)
    return raw ? (JSON.parse(raw) as OnboardingState) : null
  } catch {
    return null
  }
}

function saveLocal(state: OnboardingState) {
  try {
    localStorage.setItem(TOUR_KEY, JSON.stringify(state))
  } catch {
    /* ignore */
  }
}

/** Fast synchronous check used to avoid a flash before the server responds. */
export function hasLocalOnboarded(): boolean {
  return loadLocal()?.completed ?? false
}

/**
 * Fetch the onboarding state from the user's profile on the backend. Falls back
 * to the local cache when the request fails (e.g. offline), so refresh/logout/
 * login never restart a completed tour.
 */
type ProfileOnboarding = {
  onboarding_completed?: boolean
  onboarding_version?: number
  onboarding_completed_at?: string | null
}

export async function fetchOnboardingState(): Promise<OnboardingState> {
  try {
    const { data } = await api.get<{ profile?: ProfileOnboarding }>('/auth/me/')
    const p = data.profile ?? {}
    const state: OnboardingState = {
      completed: Boolean(p.onboarding_completed),
      version: Number(p.onboarding_version ?? 0),
      completedAt: p.onboarding_completed_at ?? null,
    }
    // Persist a cache so a hard refresh never has to re-fetch to make a decision.
    const local = loadLocal()
    if (!local || local.completed !== state.completed || local.version !== state.version) {
      saveLocal(state)
    }
    return state
  } catch {
    return loadLocal() ?? EMPTY
  }
}

/**
 * Mark the tour complete on the backend and in the local cache. Backend writes
 * are best-effort: if it fails we keep the local flag so the tour still does
 * not restart on the next refresh.
 */
export async function markOnboardingComplete(): Promise<void> {
  const state: OnboardingState = {
    completed: true,
    version: ONBOARDING_VERSION,
    completedAt: new Date().toISOString(),
  }
  saveLocal(state)
  try {
    await api.patch('/auth/me/', {
      onboarding_completed: true,
      onboarding_version: ONBOARDING_VERSION,
      onboarding_completed_at: state.completedAt,
    })
  } catch {
    /* non-fatal: local cache keeps the tour hidden for this user/session */
  }
}

/** Whether the tour should be shown given a server state (or null while loading). */
export function shouldShowTour(state: OnboardingState | null | undefined): boolean {
  // While we have not loaded any state yet, default to the local cache so a
  // returning user's completed tour does not flash on screen.
  if (!state) return !hasLocalOnboarded()
  if (!state.completed) return true
  // Re-show only when a newer version of the essential tour is released.
  return state.version < ONBOARDING_VERSION
}
