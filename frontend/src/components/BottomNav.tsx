import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { isAuthenticated } from '../lib/auth'
import { clearAuthTokens } from '../lib/auth'
import {
  IconDashboard,
  IconPlanner,
  IconFocus,
  IconTutor,
  IconNotes,
  IconQuiz,
  IconCalendar,
  IconSubject,
  IconTask,
  IconProgress,
  IconSettings,
  IconLogout,
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
  section: 'study' | 'account'
}

const MORE_ITEMS: MoreItem[] = [
  { label: 'Notes', to: '/notes', icon: IconNotes, section: 'study' },
  { label: 'Quiz', to: '/quiz', icon: IconQuiz, section: 'study' },
  { label: 'Exams', to: '/exams', icon: IconPlanner, section: 'study' },
  { label: 'Progress', to: '/progress', icon: IconProgress, section: 'study' },
  { label: 'Subjects', to: '/subjects', icon: IconSubject, section: 'study' },
  { label: 'Tasks', to: '/tasks', icon: IconTask, section: 'study' },
  { label: 'Calendar', to: '/calendar', icon: IconCalendar, section: 'study' },
  { label: 'Profile', to: '/profile', icon: IconDashboard, section: 'account' },
  { label: 'Settings', to: '/settings', icon: IconSettings, section: 'account' },
]

export default function BottomNav() {
  const location = useLocation()
  const navigate = useNavigate()
  const [moreOpen, setMoreOpen] = useState(false)
  const authed = isAuthenticated()

  useEffect(() => {
    setMoreOpen(false)
  }, [location.pathname])

  useEffect(() => {
    document.body.style.overflow = moreOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [moreOpen])

  if (!authed) return null

  function logout() {
    clearAuthTokens()
    navigate('/login')
  }

  const isActive = (to: string) => {
    if (to === '/dashboard') return location.pathname === '/dashboard'
    if (to === '/planner') return location.pathname.startsWith('/planner') || location.pathname === '/calendar' || location.pathname === '/tasks'
    return location.pathname.startsWith(to)
  }

  const moreActive = MORE_ITEMS.some((item) => location.pathname.startsWith(item.to))

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
        >
          <span className="bn-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1.5" />
              <rect x="14" y="3" width="7" height="7" rx="1.5" />
              <rect x="3" y="14" width="7" height="7" rx="1.5" />
              <rect x="14" y="14" width="7" height="7" rx="1.5" />
            </svg>
          </span>
          <span className="bn-label">More</span>
        </button>
      </nav>

      {moreOpen && (
        <div className="bn-sheet-backdrop" onClick={() => setMoreOpen(false)}>
          <div className="bn-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="bn-sheet-handle" onClick={() => setMoreOpen(false)}>
              <span />
            </div>
            <div className="bn-sheet-head">
              <h3>More</h3>
              <p>Everything in FocusFlow AI</p>
            </div>

            <div className="bn-sheet-scroll">
              <span className="bn-sheet-section">Study</span>
              <div className="bn-sheet-grid">
                {MORE_ITEMS.filter((i) => i.section === 'study').map((item) => (
                  <Link key={item.to} to={item.to} className="bn-sheet-card">
                    <span className="bn-sheet-card-icon"><item.icon size={22} /></span>
                    <span className="bn-sheet-card-label">{item.label}</span>
                  </Link>
                ))}
              </div>

              <span className="bn-sheet-section">Account</span>
              <div className="bn-sheet-grid bn-sheet-grid-single">
                {MORE_ITEMS.filter((i) => i.section === 'account').map((item) => (
                  <Link key={item.to} to={item.to} className="bn-sheet-card">
                    <span className="bn-sheet-card-icon"><item.icon size={22} /></span>
                    <span className="bn-sheet-card-label">{item.label}</span>
                  </Link>
                ))}
                <button className="bn-sheet-card bn-sheet-logout" onClick={logout} type="button">
                  <span className="bn-sheet-card-icon"><IconLogout size={22} /></span>
                  <span className="bn-sheet-card-label">Logout</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
