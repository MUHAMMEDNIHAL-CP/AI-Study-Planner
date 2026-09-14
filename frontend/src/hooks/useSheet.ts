import { useEffect, useRef, useState } from 'react'

/**
 * Keeps a popup mounted while its close (slide-down) animation plays,
 * then unmounts it. Returns:
 *  - render:   true while the popup should stay in the DOM
 *  - closing:  true during the exit animation (add `.sheet-closing` to animate out)
 */
export function useSheet(open: boolean, duration = 280) {
  const [stage, setStage] = useState<'render' | 'closing' | null>(open ? 'render' : null)
  const timer = useRef<number | null>(null)

  if (open && stage !== 'render') {
    setStage('render')
  } else if (!open && stage === 'render') {
    setStage('closing')
  }

  useEffect(() => {
    if (stage !== 'closing') return
    timer.current = window.setTimeout(() => {
      setStage((prev) => (prev === 'closing' ? null : prev))
    }, duration)
    return () => {
      if (timer.current) {
        window.clearTimeout(timer.current)
        timer.current = null
      }
    }
  }, [stage, duration])

  return {
    render: stage !== null,
    closing: stage === 'closing',
  }
}