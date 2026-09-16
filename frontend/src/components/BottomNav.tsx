import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { isAuthenticated, clearAuthTokens } from '../lib/auth'
import { displayName, initials, useUserProfile } from '../hooks/useUserProfile'
import { useStreak } from '../hooks/useStreak'
import {
  IconBot,
  IconCalendar,
  IconChevron,
  IconDashboard,
  IconFlame,
  IconFocus,
  IconGraduation,
  IconHelp,
  IconLogout,
  IconMenu,
  IconNotes,
  IconPlanner,
  IconProgress,
  IconQuiz,
  IconSettings,
  IconShield,
  IconSubject,
  IconTask,
  IconTutor,
  IconUser,
} from './icons'

type NavItem = {
  label: string
  to: string
  icon: typeof IconDashboard
  highlight?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Home', to: '/dashboard', icon: IconDashboard },
  { label: 'Planner', to: '/planner', icon: IconPlanner },
  { label: 'Focus', to: '/focus', icon: IconFocus, highlight: true },
  { label: 'AI', to: '/ai-tutor', icon: IconTutor },
]

type MoreItem = {
  label: string
  to: string
  icon: typeof IconDashboard
  section: 'study' | 'ai' | 'account' | 'support' | 'legal'
}

const MORE_ITEMS: MoreItem[] = [
  { label: 'Notes', to: '/notes', icon: IconNotes, section: 'study' },
  { label: 'Quiz', to: '/quiz', icon: IconQuiz, section: 'study' },
  { label: 'Calendar', to: '/calendar', icon: IconCalendar, section: 'study' },
  { label: 'Exams', to: '/exams', icon: IconGraduation, section: 'study' },
  { label: 'Progress', to: '/progress', icon: IconProgress, section: 'study' },
  { label: 'Subjects', to: '/subjects', icon: IconSubject, section: 'study' },
  { label: 'Tasks', to: '/tasks', icon: IconTask, section: 'study' },
  { label: 'AI Coach', to: '/ai-tutor', icon: IconTutor, section: 'ai' },
  { label: 'Profile', to: '/profile', icon: IconUser, section: 'account' },
  { label: 'Settings', to: '/settings', icon: IconSettings, section: 'account' },
  { label: 'Help & Support', to: '/help', icon: IconHelp, section: 'support' },
  { label: 'Privacy Policy', to: '/privacy', icon: IconShield, section: 'legal' },
  { label: 'Terms of Service', to: '/terms', icon: IconBot, section: 'legal' },
]

const SECTIONS: Array<{ key: MoreItem['section']; title: string }> = [
  { key: 'study', title: 'Study' },
  { key: 'ai', title: 'AI' },
  { key: 'account', title: 'Account' },
  { key: 'support', title: 'Support' },
  { key: 'legal', title: 'Legal' },
]

const SWIPE_CLOSE_THRESHOLD = 90
const SWIPE_TAP_THRESHOLD = 10

export default function BottomNav() {
  const location = useLocation()
  const navigate = useNavigate()
  const [moreOpen, setMoreOpen] = useState(false)
  const authed = isAuthenticated()
  const profile = useUserProfile()
  const { streak } = useStreak()

  const drawerRef = useRef<HTMLDivElement>(null)
  const dragStart = useRef<{ y: number } | null>(null)
  const dragOffsetRef = useRef(0)
  const [dragOffset, setDragOffset] = useState(0)

  useEffect(() => {
    if (!moreOpen) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMoreOpen(false)
    }
    const onPop = () => setMoreOpen(false)
    window.addEventListener('keydown', onKey)
    window.addEventListener('popstate', onPop)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('popstate', onPop)
    }
  }, [moreOpen])

  const closeDrawer = useCallback(() => {
    setMoreOpen(false)
    setDragOffset(0)
    dragOffsetRef.current = 0
    dragStart.current = null
  }, [])

  function onDragStart(e: React.TouchEvent) {
    dragStart.current = { y: e.touches[0].clientY }
  }

  function onDragMove(e: React.TouchEvent) {
    if (!dragStart.current) return
    const dy = Math.max(0, e.touches[0].clientY - dragStart.current.y)
    dragOffsetRef.current = dy
    setDragOffset(dy)
  }

  function onDragEnd() {
    dragStart.current = null
    const dy = dragOffsetRef.current
    dragOffsetRef.current = 0
    if (dy > SWIPE_CLOSE_THRESHOLD) closeDrawer()
    else setDragOffset(0)
  }

  function logout() {
    clearAuthTokens()
    navigate('/login')
  }

  if (!authed) return null

  const isActive = (to: string) => {
    if (to === '/dashboard') return location.pathname === '/dashboard'
    if (to === '/planner') return location.pathname.startsWith('/planner') || location.pathname === '/calendar' || location.pathname === '/tasks'
    return location.pathname.startsWith(to)
  }

  const isRowActive = (to: string) => {
    if (to === '/ai-tutor') return location.pathname.startsWith('/ai-tutor')
    if (to === '/dashboard') return location.pathname === '/dashboard'
    return location.pathname.startsWith(to)
  }

  const moreActive = MORE_ITEMS.some((item) => location.pathname.startsWith(item.to))

  const name = displayName(profile)
  const avatar = initials(name)
  const currentStreak = streak?.current_streak ?? streak?.streak ?? 0

  return (
    <>
      <nav className="bn-bar" aria-label="Mobile navigation">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={`bn-item${item.highlight ? ' bn-focus' : ''}${isActive(item.to) ? ' active' : ''}`}
          >
            <span className="bn-icon">
              <item.icon size={item.highlight ? 24 : 20} />
            </span>
            <span className="bn-label">{item.label}</span>
          </Link>
        ))}
        <button
          className={`bn-item bn-more${moreActive && !NAV_ITEMS.some((i) => isActive(i.to)) ? ' active' : ''}`}
          onClick={() => setMoreOpen(true)}
          type="button"
          aria-label="Open more navigation"
          aria-expanded={moreOpen}
        >
          <span className="bn-icon">
            <IconMenu size={20} />
          </span>
          <span className="bn-label">More</span>
        </button>
      </nav>

      {moreOpen && (
        <div
          className="bn-sheet-backdrop"
          onClick={closeDrawer}
          role="presentation"
        >
          <div
            className={`bn-sheet${dragOffset > SWIPE_TAP_THRESHOLD ? ' bn-sheet-dragging' : ''}`}
            ref={drawerRef}
            style={{ transform: dragOffset > 0 ? `translateY(${dragOffset}px)` : undefined }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="More navigation"
            onTouchStart={onDragStart}
            onTouchMove={onDragMove}
            onTouchEnd={onDragEnd}
          >
            <div className="bn-sheet-handle" aria-hidden="true" />

            <div className="bn-sheet-head">
              <div>
                <h3>More</h3>
                <p>Your study workspace</p>
              </div>
              <button className="bn-sheet-close" onClick={closeDrawer} type="button" aria-label="Close navigation">
                <span aria-hidden="true">&#10005;</span>
              </button>
            </div>

            <div className="bn-sheet-scroll">
              <Link className="ss-profile" to="/profile" onClick={closeDrawer}>
                <span className="ss-avatar">{avatar}</span>
                <span className="ss-profile-main">
                  <strong>{name}</strong>
                  <small>Student</small>
                </span>
                <span className="ss-profile-view">
                  View profile
                  <IconChevron size={14} />
                </span>
              </Link>

              <div className="ss-streak">
                <IconFlame size={17} />
                <span>{currentStreak > 0 ? `${currentStreak} day streak` : 'Start your study streak'}</span>
              </div>

              {SECTIONS.map((section) => {
                const items = MORE_ITEMS.filter((i) => i.section === section.key)
                if (!items.length) return null
                return (
                  <div className="bn-sheet-section-block" key={section.key}>
                    <span className="bn-sheet-section">{section.title}</span>
                    <div className="bn-sheet-list">
                      {items.map((item) => (
                        <Link
                          key={item.to}
                          to={item.to}
                          onClick={closeDrawer}
                          className={`bn-sheet-row${isRowActive(item.to) ? ' active' : ''}`}
                        >
                          <span className="bn-sheet-row-icon"><item.icon size={20} /></span>
                          <span className="bn-sheet-row-label">{item.label}</span>
                          <IconChevron className="bn-sheet-row-arrow" size={16} />
                        </Link>
                      ))}
                    </div>
                  </div>
                )
              })}

              <button className="bn-sheet-row bn-sheet-logout" onClick={logout} type="button">
                <span className="bn-sheet-row-icon"><IconLogout size={20} /></span>
                <span className="bn-sheet-row-label">Logout</span>
                <IconChevron className="bn-sheet-row-arrow" size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}