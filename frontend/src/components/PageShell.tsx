import { useEffect, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useUserProfile, displayName, initials } from '../hooks/useUserProfile'
import { getTheme, toggleTheme, type ThemeMode } from '../lib/theme'
import { IconBack, IconMoon, IconSettings, IconSun } from './icons'

type PageShellProps = {
  title: string
  subtitle?: string
  actions?: ReactNode
  badge?: ReactNode
  children: ReactNode
  className?: string
  /** Hide the back button in the mobile top bar (e.g. home screens). */
  hideBack?: boolean
  /** Show the live clock + date in the mobile top bar instead of the page title. */
  clockInBar?: boolean
}

export default function PageShell({
  title,
  subtitle,
  actions,
  badge,
  children,
  className = '',
  hideBack = false,
  clockInBar = false,
}: PageShellProps) {
  const profile = useUserProfile()
  const name = displayName(profile)
  const avatar = initials(name)
  const navigate = useNavigate()
  const location = useLocation()
  const canGoBack = location.key !== 'default'
  const [currentTime, setCurrentTime] = useState(() => new Date())
  const [theme, setTheme] = useState<ThemeMode>(() => getTheme())

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  function handleToggleTheme() {
    setTheme(toggleTheme())
  }

  const formattedTime = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(currentTime)

  const formattedDate = new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(currentTime)

  return (
    <div className={`flow-page page-shell ${className}`.trim()}>
      <div className="page-shell-mbar">
        {!hideBack && (
          <button
            className="page-shell-back"
            type="button"
            aria-label="Go back"
            onClick={() => (canGoBack ? navigate(-1) : navigate('/dashboard'))}
          >
            <IconBack size={22} />
          </button>
        )}
        {clockInBar ? (
          <div className="page-shell-mclock">
            <span className="page-shell-mclock-time">{formattedTime}</span>
            <span className="page-shell-mclock-date">{formattedDate}</span>
          </div>
        ) : (
          <h1 className="page-shell-mtitle">{title}</h1>
        )}
        <div className="page-shell-mactions">
          <button
            className="page-shell-settings"
            onClick={handleToggleTheme}
            type="button"
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <IconSun size={18} /> : <IconMoon size={18} />}
          </button>
          <Link className="page-shell-settings" to="/settings" title="Settings" aria-label="Settings">
            <IconSettings size={18} />
          </Link>
        </div>
      </div>

      <header className="page-shell-header">
        <Link to="/dashboard" className="page-shell-time">
          <span className="page-shell-time-clock">{formattedTime}</span>
          <span className="page-shell-time-date">{formattedDate}</span>
        </Link>
        <div className="page-shell-spacer" />
        <div className="page-shell-header-actions">
          <button
            className="page-shell-settings"
            onClick={handleToggleTheme}
            type="button"
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <IconSun size={18} /> : <IconMoon size={18} />}
          </button>
          <Link className="page-shell-settings" to="/settings" title="Settings" aria-label="Settings">
            <IconSettings size={18} />
          </Link>
          <Link className="page-shell-user" to="/profile">
            <span>{name}</span>
            <b>{avatar}</b>
          </Link>
        </div>
      </header>

      <section className="page-shell-hero">
        <div className="page-shell-copy">
          <h1>{title}</h1>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {(actions || badge) && (
          <div className="page-shell-actions">
            {badge}
            {actions}
          </div>
        )}
      </section>

      {children}
    </div>
  )
}
