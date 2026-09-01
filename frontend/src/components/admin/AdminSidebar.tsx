import { Link, useLocation, useNavigate } from 'react-router-dom'
import { clearAuthTokens } from '../../lib/auth'
import { displayName, initials, useUserProfile } from '../../hooks/useUserProfile'
import { IconOverview } from './adminIcons'
import {
  IconAudit,
  IconBook,
  IconBrain,
  IconChart,
  IconDashboard,
  IconDevice,
  IconFlame,
  IconHealth,
  IconLogout,
  IconPuzzle,
  IconReport,
  IconShield,
  IconTask,
  IconTimer,
  IconUsers,
} from '../icons'

export type AdminNavItem = {
  label: string
  to: string
  icon: typeof IconDashboard
}

type AdminNavGroup = {
  title: string
  items: AdminNavItem[]
}

const adminNavGroups: AdminNavGroup[] = [
  {
    title: 'SUPER ADMIN',
    items: [{ label: 'Overview', to: '/admin', icon: IconOverview }],
  },
  {
    title: 'Users',
    items: [
      { label: 'Users', to: '/admin/users', icon: IconUsers },
      { label: 'Engagement', to: '/admin/engagement', icon: IconChart },
      { label: 'Streaks', to: '/admin/streaks', icon: IconFlame },
    ],
  },
  {
    title: 'Learning',
    items: [
      { label: 'Study Activity', to: '/admin/study', icon: IconTimer },
      { label: 'Subjects', to: '/admin/subjects', icon: IconBook },
      { label: 'Tasks', to: '/admin/tasks', icon: IconTask },
      { label: 'Quizzes', to: '/admin/quizzes', icon: IconPuzzle },
      { label: 'Exams', to: '/admin/exams', icon: IconBook },
      { label: 'Notes', to: '/admin/notes', icon: IconTask },
    ],
  },
  {
    title: 'Platform',
    items: [
      { label: 'FLOX AI', to: '/admin/ai', icon: IconBrain },
      { label: 'Devices', to: '/admin/devices', icon: IconDevice },
      { label: 'System Health', to: '/admin/health', icon: IconHealth },
      { label: 'Audit Logs', to: '/admin/audit-logs', icon: IconAudit },
      { label: 'Reports', to: '/admin/reports', icon: IconReport },
      { label: 'Admin Settings', to: '/admin/settings', icon: IconShield },
    ],
  },
]

export default function AdminSidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const profile = useUserProfile()
  const name = displayName(profile)
  const avatar = initials(name)

  function logout() {
    clearAuthTokens()
    navigate('/login')
  }

  return (
    <aside className="ad-sidebar">
      <Link className="ad-brand" to="/admin">
        <span className="ad-brand-mark">
          <IconShield size={20} />
        </span>
        <span className="ad-brand-text">
          <strong>FocusFlow</strong>
          <small>Super Admin</small>
        </span>
      </Link>

      <nav className="ad-nav" aria-label="Admin navigation">
        {adminNavGroups.map((group) => (
          <div className="ad-group" key={group.title}>
            <span className="ad-group-title">{group.title}</span>
            {group.items.map(({ label, to, icon: Icon }) => {
              const active = to === '/admin'
                ? location.pathname === '/admin'
                : location.pathname.startsWith(to)
              return (
                <Link
                  className={`ad-link${active ? ' ad-link-active' : ''}`}
                  key={to}
                  to={to}
                >
                  <span className="ad-link-icon"><Icon size={17} /></span>
                  <span>{label}</span>
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      <div className="ad-bottom">
        <Link className="ad-user" to="/profile">
          <span className="ad-avatar">{avatar}</span>
          <span className="ad-user-main">
            <strong>{name}</strong>
            <small>{profile?.email ?? 'Super Admin'}</small>
          </span>
        </Link>
        <button className="ad-logout" onClick={logout} type="button">
          <IconLogout size={16} />
          <span>Back to Student App</span>
        </button>
      </div>
    </aside>
  )
}