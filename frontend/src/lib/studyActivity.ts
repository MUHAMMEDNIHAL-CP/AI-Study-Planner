const STREAK_EVENT = 'flox:streak-update'

export function notifyStudyActivity(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(STREAK_EVENT))
}

export function onStudyActivity(handler: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener(STREAK_EVENT, handler)
  return () => window.removeEventListener(STREAK_EVENT, handler)
}
