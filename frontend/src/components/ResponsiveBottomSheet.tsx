import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { useSheet } from '../hooks/useSheet'

const DRAG_CLOSE_PX = 110
const DRAG_VELOCITY_PX_MS = 0.45

type ResponsiveBottomSheetProps = {
  open: boolean
  onClose: () => void
  title: ReactNode
  children: ReactNode
  footer?: ReactNode
  className?: string
  sheetClassName?: string
}

/**
 * Reusable popup that looks native on every screen size:
 *  - mobile: Instagram-style bottom sheet (drag handle, scrollable body,
 *    sticky footer, safe-area aware, dynamic viewport units)
 *  - desktop/tablet: centered dialog (max-width 560px)
 *
 * Structure:
 *   Backdrop
 *     └── Sheet
 *         ├── Header + drag handle
 *         ├── Scrollable body
 *         └── Sticky footer
 */
export function ResponsiveBottomSheet({ open, onClose, title, children, footer, className = '', sheetClassName = '' }: ResponsiveBottomSheetProps) {
  const { render, closing } = useSheet(open, 260)
  const titleId = useId()
  const sheetRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const restoreFocus = useRef<HTMLElement | null>(null)
  const restoreOverflow = useRef('')
  const restoreHtmlOverflow = useRef('')

  // Keep the latest close callback without re-running the focus effect below.
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  const drag = useRef({ startY: 0, dy: 0, active: false, moved: false, lastY: 0, lastT: 0, maxSpeed: 0 })
  const [dragTransform, setDragTransform] = useState(0)
  const [dragging, setDragging] = useState(false)

  // Lock background scrolling while open; restore exactly what we found.
  useEffect(() => {
    if (!open) return
    restoreOverflow.current = document.body.style.overflow
    restoreHtmlOverflow.current = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = restoreOverflow.current
      document.documentElement.style.overflow = restoreHtmlOverflow.current
    }
  }, [open])

  // Keep the sheet above the on-screen keyboard: visualViewport shrinks when
  // the soft keyboard opens (iOS) / viewport resizes (Android-ish). We expose
  // the covered pixels as --rbs-kb so the sheet max-height and footer padding
  // can ride above the keyboard and keep the focused field/submit visible.
  useEffect(() => {
    if (!open) return
    const vv = window.visualViewport
    const overlayEl = sheetRef.current?.parentElement
    if (!vv || !overlayEl) return
    const sync = () => {
      const kb = Math.max(0, window.innerHeight - (vv.height + vv.offsetTop))
      overlayEl.style.setProperty('--rbs-kb', kb > 1 ? `${kb}px` : '0px')
      const active = document.activeElement as HTMLElement | null
      if (kb > 1 && active && sheetRef.current?.contains(active)) {
        active.scrollIntoView({ block: 'center', behavior: 'auto' })
      }
    }
    sync()
    vv.addEventListener('resize', sync)
    vv.addEventListener('scroll', sync)
    return () => {
      vv.removeEventListener('resize', sync)
      vv.removeEventListener('scroll', sync)
      overlayEl.style.setProperty('--rbs-kb', '0px')
    }
  }, [open])

  // Focus management + Escape-to-close. Only depends on `open` so parent
  // re-renders (new onClose identity, form keystrokes) never steal focus.
  useEffect(() => {
    if (!open) return
    restoreFocus.current = (document.activeElement as HTMLElement) || null
    const focusTimer = window.setTimeout(() => {
      // Don't steal focus if it already landed inside the sheet (e.g. React's
      // imperative autoFocus on an input mounted with the sheet).
      if (sheetRef.current?.contains(document.activeElement)) return
      const autofocus = sheetRef.current?.querySelector<HTMLElement>('[autofocus]')
      if (autofocus) autofocus.focus()
      else closeRef.current?.focus()
    }, 60)
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCloseRef.current()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      window.clearTimeout(focusTimer)
      if (restoreFocus.current && document.contains(restoreFocus.current)) {
        restoreFocus.current.focus()
      }
    }
  }, [open])

  function handlePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return
    if ((e.target as HTMLElement).closest('button, a, input, select, textarea, [data-nodrag]')) return
    drag.current = { startY: e.clientY, dy: 0, active: true, moved: false, lastY: e.clientY, lastT: e.timeStamp, maxSpeed: 0 }
    setDragging(true)
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!drag.current.active) return
    const dy = e.clientY - drag.current.startY
    if (dy <= 0) return
    drag.current.moved = true
    drag.current.dy = dy
    const speed = Math.abs(dy - drag.current.lastY) / Math.max(1, e.timeStamp - drag.current.lastT)
    drag.current.maxSpeed = Math.max(drag.current.maxSpeed, speed)
    drag.current.lastY = e.clientY
    drag.current.lastT = e.timeStamp
    setDragTransform(Math.min(dy, window.innerHeight * 0.75))
  }

  function endDrag() {
    drag.current.active = false
    const shouldClose = drag.current.dy > DRAG_CLOSE_PX || drag.current.maxSpeed > DRAG_VELOCITY_PX_MS
    if (shouldClose) {
      onClose()
    } else {
      setDragTransform(0)
    }
    setDragging(false)
  }

  function handleTabKey(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'Tab' || !sheetRef.current) return
    const focusables = Array.from(
      sheetRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => !el.hasAttribute('disabled') && !el.hasAttribute('hidden'))
    if (!focusables.length) return
    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  if (!render) return null

  return (
    <div
      className={`rbs-overlay${closing ? ' sheet-closing' : ''}${className ? ` ${className}` : ''}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      onTouchStart={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`rbs-sheet${sheetClassName ? ` ${sheetClassName}` : ''}`}
        style={dragging ? { transform: `translateY(${dragTransform}px)`, transition: 'none' } : undefined}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleTabKey}
      >
        <div
          className="rbs-zone"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <span className="rbs-handle" aria-hidden="true" />
          <div className="rbs-head">
            <h2 id={titleId} className="rbs-title">
              {title}
            </h2>
            <button ref={closeRef} type="button" className="rbs-close" onClick={onClose} aria-label="Close dialog">
              <span aria-hidden="true">&times;</span>
            </button>
          </div>
        </div>
        <div className="rbs-scroll">{children}</div>
        {footer ? <div className="rbs-footer">{footer}</div> : null}
      </div>
    </div>
  )
}