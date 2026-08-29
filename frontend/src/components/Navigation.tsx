import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { clearAuthTokens, isAuthenticated } from '../lib/auth'
import { initials, useUserProfile } from '../hooks/useUserProfile'
import { onStudyActivity } from '../lib/studyActivity'
import {
  IconBot,
  IconCalendar,
  IconDashboard,
  IconFocus,
  IconLogout,
  IconNotes,
  IconPlanner,
  IconProgress,
  IconQuiz,
  IconSettings,
  IconSubject,
  IconTask,
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

type StreakData = {
  current_streak: number
  longest_streak: number
  total_study_days: number
  studied_today: boolean
  next_milestone: { target: number; progress: number; remaining: number } | null
}

const navGroups: NavGroup[] = [
  {
    title: 'Overview',
    items: [{ label: 'Dashboard', to: '/dashboard', icon: IconDashboard }],
  },
  {
    title: 'Study',
    items: [
      { label: 'My Subjects', to: '/subjects', icon: IconSubject },
      { label: 'Study Planner', to: '/planner', icon: IconPlanner },
      { label: 'Tasks', to: '/tasks', icon: IconTask },
      { label: 'Exams', to: '/exams', icon: IconPlanner },
      { label: 'Focus Mode', to: '/focus', icon: IconFocus },
    ],
  },
  {
    title: 'Progress',
    items: [
      { label: 'Progress', to: '/progress', icon: IconProgress },
      { label: 'AI Coach', to: '/ai-tutor', icon: IconTutor },
    ],
  },
  {
    title: 'Tools',
    items: [
      { label: 'Quiz', to: '/quiz', icon: IconQuiz },
      { label: 'Notes', to: '/notes', icon: IconNotes },
      { label: 'Calendar', to: '/calendar', icon: IconCalendar },
    ],
  },
]

export default function Navigation() {
  const location = useLocation()
  const navigate = useNavigate()
  const profile = useUserProfile()
  const [streakData, setStreakData] = useState<StreakData | null>(null)
  const authed = isAuthenticated()

  const refreshStreak = useCallback(() => {
    if (!authed) return
    api.get<StreakData>('/study/dashboard/')
      .then(({ data }) => setStreakData(data))
      .catch(() => setStreakData(null))
  }, [authed])

  useEffect(() => {
    refreshStreak()
  }, [refreshStreak])

  useEffect(() => {
    const unsubscribe = onStudyActivity(() => refreshStreak())
    return unsubscribe
  }, [refreshStreak])

  function logout() {
    clearAuthTokens()
    navigate('/login')
  }

  if (!authed) return null

  const name = profile?.username ?? 'Scholar'
  const avatar = initials(name)
  const currentStreak = streakData?.current_streak ?? 0
  const milestone = streakData?.next_milestone

  return (
    <aside className="sidebar orbit-sidebar">
      <Link className="sidebar-brand" to="/dashboard">
        <span className="sidebar-mark"><IconBot size={22} /></span>
        <span className="sidebar-brand-text">
          <strong>Flox AI</strong>
          <small>Study Planner</small>
        </span>
      </Link>

      <nav className="sidebar-groups" aria-label="Main navigation">
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
          <div className="streak-head">
            <span>Study streak</span>
            <span className={streakData?.studied_today ? 'streak-dot active' : 'streak-dot'} title={streakData?.studied_today ? 'Studied today' : 'Not studied today yet'} />
          </div>
          <strong>{currentStreak} day{currentStreak === 1 ? '' : 's'}</strong>
          <div className="streak-sub">
            <span>Longest: {streakData?.longest_streak ?? 0} days</span>
            <span>{streakData?.total_study_days ?? 0} total study days</span>
          </div>
          {milestone ? (
            <div className="streak-milestone">
              <span>Next milestone: {milestone.target} days</span>
              <div className="streak-bar">
                <i style={{ width: `${Math.min(milestone.progress, 100)}%` }} />
              </div>
              <small>{milestone.remaining} day{milestone.remaining === 1 ? '' : 's'} to go</small>
            </div>
          ) : currentStreak >= 365 ? (
            <div className="streak-milestone">
              <span>Year-long streak. Incredible.</span>
            </div>
) : null}
        </div>

        <Link className="sidebar-user visible" to="/profile">
          <span className="sidebar-avatar">{avatar}</span>
          <span className="sidebar-user-main">
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
