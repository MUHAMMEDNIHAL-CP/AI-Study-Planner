import { Link, useLocation, useNavigate } from 'react-router-dom'
import { clearAuthTokens, isAuthenticated } from '../lib/auth'
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
}

type NavGroup = {
  title: string
  items: NavItem[]
}

const MAIN_GROUPS: NavGroup[] = [
  {
    title: 'Main',
    items: [
      { label: 'Home', to: '/dashboard', icon: IconDashboard },
      { label: 'Planner', to: '/planner', icon: IconPlanner },
      { label: 'Focus', to: '/focus', icon: IconFocus },
      { label: 'AI Coach', to: '/ai-tutor', icon: IconTutor },
    ],
  },
  {
    title: 'Study',
    items: [
      { label: 'Notes', to: '/notes', icon: IconNotes },
      { label: 'Quiz', to: '/quiz', icon: IconQuiz },
      { label: 'Calendar', to: '/calendar', icon: IconCalendar },
      { label: 'Exams', to: '/exams', icon: IconGraduation },
      { label: 'Progress', to: '/progress', icon: IconProgress },
      { label: 'Subjects', to: '/subjects', icon: IconSubject },
      { label: 'Tasks', to: '/tasks', icon: IconTask },
    ],
  },
  {
    title: 'Account',
    items: [
      { label: 'Profile', to: '/profile', icon: IconUser },
      { label: 'Settings', to: '/settings', icon: IconSettings },
    ],
  },
  {
    title: 'Support',
    items: [{ label: 'Help & Support', to: '/help', icon: IconHelp }],
  },
  {
    title: 'Legal',
    items: [
      { label: 'Privacy Policy', to: '/privacy', icon: IconShield },
      { label: 'Terms of Service', to: '/terms', icon: IconBot },
    ],
  },
]

function isItemActive(pathname: string, to: string) {
  if (to === '/dashboard') return pathname === '/dashboard' || pathname === '/'
  if (to === '/planner') return pathname === '/planner'
  return pathname.startsWith(to)
}

export default function Navigation() {
  const location = useLocation()
  const navigate = useNavigate()
  const profile = useUserProfile()
  const { streak } = useStreak()
  const authed = isAuthenticated()

  function logout() {
    clearAuthTokens()
    navigate('/login')
  }

  if (!authed) return null

  const name = displayName(profile)
  const avatar = initials(name)
  const currentStreak = streak?.current_streak ?? streak?.streak ?? 0

  return (
    <aside className="sidebar orbit-sidebar">
      <Link className="sidebar-brand" to="/dashboard" aria-label="Flox AI dashboard">
        <span className="sidebar-mark"><IconBot size={22} /></span>
        <span className="sidebar-brand-text">
          <strong>FLOX AI</strong>
          <small>Study Planner</small>
        </span>
      </Link>

      <div className="ss-profile">
        <span className="ss-avatar">{avatar}</span>
        <span className="ss-profile-main">
          <strong>{name}</strong>
          <small>Student workspace</small>
        </span>
        <Link to="/profile" className="ss-profile-link" aria-label="View profile">
          <IconChevron size={16} />
        </Link>
      </div>

      <div className="ss-streak">
        <IconFlame size={17} />
        <span>{currentStreak > 0 ? `${currentStreak} day streak` : 'Start your study streak'}</span>
      </div>

      <nav className="sidebar-groups" aria-label="Main navigation">
        {MAIN_GROUPS.map((group) => (
          <div className="sidebar-group" key={group.title}>
            <span className="sidebar-group-title">{group.title}</span>
            <div className="sidebar-links">
              {group.items.map(({ label, to, icon: Icon }) => (
                <Link
                  className={`sidebar-link ${isItemActive(location.pathname, to) ? 'sidebar-link-active' : ''}`}
                  key={to}
                  to={to}
                >
                  <span className="sidebar-icon"><Icon size={19} /></span>
                  <span>{label}</span>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="sidebar-bottom">
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