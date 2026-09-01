import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'

const TIP_KEYS = 'FLOX.featureTips'

function readShown(): string[] {
  try {
    const raw = localStorage.getItem(TIP_KEYS)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

function remember(key: string) {
  try {
    const seen = new Set(readShown())
    seen.add(key)
    localStorage.setItem(TIP_KEYS, JSON.stringify([...seen]))
  } catch {
    /* ignore */
  }
}

/**
 * Progressive (first-time) feature tip. Shows a small, non-blocking hint the
 * first time a student opens a feature that is not part of the essential tour
 * (e.g. Quiz, Notes, Exams, Calendar, Progress). Auto-dismisses and never
 * reappears after it has been shown or dismissed.
 */
export default function FirstTimeTip({
  storageKey,
  children,
}: {
  storageKey: string
  children: ReactNode
}) {
  const [visible, setVisible] = useState(() => !readShown().includes(storageKey))

  useEffect(() => {
    if (!visible) return
    remember(storageKey)
    const t = window.setTimeout(() => setVisible(false), 6000)
    return () => window.clearTimeout(t)
  }, [visible, storageKey])

  if (!visible) return null

  return (
    <div className="ft-tip" role="status">
      <div className="ft-tip-body">{children}</div>
      <button className="ft-tip-close" onClick={() => setVisible(false)} type="button" aria-label="Dismiss">
        {'\u2715'}
      </button>
    </div>
  )
}
