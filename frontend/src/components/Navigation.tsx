import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { clearAuthTokens, isAuthenticated } from '../lib/auth'
import { api } from '../lib/api'
import { useUserProfile, initials } from '../hooks/useUserProfile'
import {
  IconAnalytics,
  IconBurnout,
  IconDashboard,
  IconFocus,
  IconLogout,
  IconOrbit,
  IconPlanner,
  IconQuiz,
  IconSettings,
  IconTutor,
} from './icons'

type NavItem = {
  label: string
  to: string
  icon: typeof IconDashboard
}

type NavGroup = {
  title: string
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    title: 'Home',
    items: [{ label: 'Dashboard', to: '/dashboard', icon: IconDashboard }],
  },
  {
    title: 'Plan',
    items: [{ label: 'Study Planner', to: '/planner', icon: IconPlanner }],
  },
  {
    title: 'Learn',
    items: [
      { label: 'AI Tutor', to: '/ai-tutor', icon: IconTutor },
      { label: 'Quiz Center', to: '/quiz', icon: IconQuiz },
    ],
  },
  {
    title: 'Wellness',
    items: [
      { label: 'Focus Mode', to: '/focus', icon: IconFocus },
      { label: 'Analytics', to: '/analytics', icon: IconAnalytics },
      { label: 'Burnout Check', to: '/burnout', icon: IconBurnout },
    ],
  },
]

export default function Navigation() {
  const location = useLocation()
  const navigate = useNavigate()
  const profile = useUserProfile()
  const [streak, setStreak] = useState(0)
  const authed = isAuthenticated()

  useEffect(() => {
    if (!authed) return
    api.get<{ streak: number }>('/study/dashboard/')
      .then(({ data }) => setStreak(data.streak))
      .catch(() => setStreak(0))
  }, [authed])

  function logout() {
    clearAuthTokens()
    navigate('/login')
  }

  if (!authed) return null

  const name = profile?.username ?? 'Scholar'
  const avatar = initials(name)

  return (
    <aside className="sidebar orbit-sidebar">
      <Link className="sidebar-brand" to="/dashboard">
        <span className="sidebar-mark"><IconOrbit size={22} /></span>
        <span>
          <strong>FocusFlow</strong>
          <small>Study Orbit</small>
        </span>
      </Link>

      <nav className="sidebar-groups">
        {navGroups.map((group) => (
          <div className="sidebar-group" key={group.title}>
            <span className="sidebar-group-title">{group.title}</span>
            <div className="sidebar-links">
              {group.items.map(({ label, to, icon: Icon }) => (
                <Link
                  className={`sidebar-link ${location.pathname === to ? 'sidebar-link-active' : ''}`}
                  key={to}
                  to={to}
                >
                  <span className="sidebar-icon"><Icon size={18} /></span>
                  <span>{label}</span>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <div className="streak-card visible">
          <span>Study streak</span>
          <strong>{streak} day{streak === 1 ? '' : 's'}</strong>
          <div className="streak-bar">
            <i style={{ width: `${Math.min(streak * 12, 100)}%` }} />
          </div>
        </div>

        <Link className="sidebar-user visible" to="/profile">
          <span className="sidebar-avatar">{avatar}</span>
          <span>
            <strong>{name}</strong>
            <small>{profile?.email ?? 'Student workspace'}</small>
          </span>
        </Link>

        <Link className="sidebar-settings" to="/settings">
          <IconSettings size={18} />
          <span>Settings</span>
        </Link>

        <Link className="upgrade-button" to="/focus">Start Focus Session</Link>

        <button className="logout-link" onClick={logout} type="button">
          <IconLogout size={16} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  )
}
