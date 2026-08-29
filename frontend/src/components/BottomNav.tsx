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
        <div className="bn-drawer-backdrop" onClick={() => setMoreOpen(false)}>
          <div className="bn-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="bn-drawer-head">
              <div>
                <h3>More</h3>
                <p>Navigate anywhere</p>
              </div>
              <button className="bn-drawer-close" onClick={() => setMoreOpen(false)} type="button">
                &#10005;
              </button>
            </div>

            <div className="bn-drawer-scroll">
              <span className="bn-drawer-section">Study</span>
              <div className="bn-drawer-list">
                {MORE_ITEMS.filter((i) => i.section === 'study').map((item) => (
                  <Link key={item.to} to={item.to} className="bn-drawer-row">
                    <span className="bn-drawer-row-icon"><item.icon size={19} /></span>
                    <span className="bn-drawer-row-label">{item.label}</span>
                    <span className="bn-drawer-row-arrow">{'\u203A'}</span>
                  </Link>
                ))}
              </div>

              <span className="bn-drawer-section">Account</span>
              <div className="bn-drawer-list">
                {MORE_ITEMS.filter((i) => i.section === 'account').map((item) => (
                  <Link key={item.to} to={item.to} className="bn-drawer-row">
                    <span className="bn-drawer-row-icon"><item.icon size={19} /></span>
                    <span className="bn-drawer-row-label">{item.label}</span>
                    <span className="bn-drawer-row-arrow">{'\u203A'}</span>
                  </Link>
                ))}
                <button className="bn-drawer-row bn-drawer-logout" onClick={logout} type="button">
                  <span className="bn-drawer-row-icon"><IconLogout size={19} /></span>
                  <span className="bn-drawer-row-label">Logout</span>
                  <span className="bn-drawer-row-arrow">{'\u203A'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
