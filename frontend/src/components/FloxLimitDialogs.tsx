import { useEffect, useRef, useState } from 'react'
import {
  AD_REWARD_PER_WATCH,
  type Allowance,
  type ProjectStatus,
  fetchAiStatus,
  onFloxLimit,
  rewardWatchAd,
} from '../lib/floxLimits'

/* ── Allowance indicator chip (used near the FLOX hero) ── */

export function AllowanceChip({ allowance, project }: { allowance?: Allowance | null; project?: ProjectStatus | null }) {
  if (!allowance) return <span className="flox-chip" style={{ opacity: 0.6 }}>FLOX</span>
  const total = allowance.free_limit
  const used = Math.min(allowance.free_used, total)
  const pct = total ? Math.round((used / total) * 100) : 0
  const projectWarn = project?.warning

  let label = `${used} / ${total}`
  if (used >= total) label = 'Daily limit reached'
  else if (pct >= 80) label = 'Almost out of AI requests'

  return (
    <span
      className={
        'flox-chip' +
        (used >= total ? ' out' : projectWarn === 'critical' || projectWarn === 'exhausted' ? ' warn' : '')
      }
      title={projectWarn === 'exhausted' ? 'FLOX is temporarily unavailable (platform capacity reached)' : 'Free AI requests remaining today'}
    >
      {'\u2726'} {label}
    </span>
  )
}

/* ── Watch-ad call-to-action (stub for a real ad network) ── */

export function WatchAdCta({ onGranted, onError, busy }: { onGranted?: (a: Allowance) => void; onError?: () => void; busy?: boolean }) {
  const [loading, setLoading] = useState(false)

  async function watch() {
    if (busy || loading) return
    setLoading(true)
    try {
      const { data } = await rewardWatchAd()
      onGranted?.(data.details)
    } catch {
      onError?.()
    } finally {
      setLoading(false)
    }
  }

  return (
    <button className="flox-ad-btn" disabled={busy || loading} onClick={() => void watch()}>
      {loading ? 'Granting...' : 'Watch Ad \u2192 +' + AD_REWARD_PER_WATCH}
    </button>
  )
}

/* ── Hook: fetch + expose current allowance/project status ── */

export function useAllowance() {
  const [allowance, setAllowance] = useState<Allowance | null>(null)
  const [project, setProject] = useState<ProjectStatus | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let alive = true
    fetchAiStatus()
      .then(({ data }) => {
        if (!alive) return
        setAllowance(data.allowance)
        setProject(data.project)
      })
      .catch(() => { /* non-critical */ })
      .finally(() => alive && setLoaded(true))
    return () => { alive = false }
  }, [])

  return { allowance, project, loaded, setAllowance }
}

/* ── Global FLOX dialogs: daily-limit + "taking a break" ── */

type Dialog = 'daily' | 'quota' | null

export default function FloxLimitDialogs() {
  const { allowance, project, setAllowance } = useAllowance()
  const [dialog, setDialog] = useState<Dialog>(null)
  const [error, setError] = useState('')
  const activeRef = useRef<Dialog>(null)

  useEffect(() => {
    const off = onFloxLimit((e) => {
      // Avoid repetitively re-opening the quota dialog in one session.
      if (e.type === 'quota') {
        if (sessionStorage.getItem('flox.quota.dismissed')) return
        // Cooldown: don't re-open for 30s after the last dismissal.
        const last = Number(sessionStorage.getItem('flox.quota.last'))
        if (Date.now() - last < 30_000) return
        setDialog('quota')
        setError('')
      } else {
        setDialog('daily')
        setError('')
      }
    })
    return off
  }, [])

  useEffect(() => {
    activeRef.current = dialog
  }, [dialog])

  function close() {
    if (dialog === 'quota') {
      sessionStorage.setItem('flox.quota.last', String(Date.now()))
      sessionStorage.setItem('flox.quota.dismissed', '1')
    }
    setDialog(null)
  }

  if (!dialog) return null

  const isDaily = dialog === 'daily'

  return (
    <div className="flox-backdrop" onClick={close}>
      <div className="flox-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <header className="flox-modal-head">
          <span className="flox-modal-badge">{'\u2726'} FLOX AI</span>
          <button className="flox-close" onClick={close} aria-label="Close">{'\u00D7'}</button>
        </header>

        {isDaily ? (
          <>
            <h3>You've reached your daily AI limit.</h3>
            <p>You can get more AI access by watching a short ad.</p>

            <AllowanceChip allowance={allowance} project={project} />

            <WatchAdCta onGranted={(a) => { setAllowance(a); setDialog(null) }} onError={() => setError('Could not grant ad reward right now.')} />

            {error && <p className="flox-error">{error}</p>}

            <p className="flox-note">Your free AI resets tomorrow.</p>
          </>
        ) : (
          <>
            <h3>FLOX is taking a break.</h3>
            <p>We've reached today's AI capacity. Please try again later.</p>
            <p className="flox-note">Your study data is safe.</p>
            <button className="flox-btn" onClick={close}>Got it</button>
          </>
        )}
      </div>
    </div>
  )
}