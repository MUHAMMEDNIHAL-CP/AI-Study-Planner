import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useUserProfile, initials } from '../hooks/useUserProfile'
import { getTheme, toggleTheme, type ThemeMode } from '../lib/theme'
import { IconMoon, IconSettings, IconSun } from './icons'

type PageShellProps = {
  title: string
  subtitle?: string
  actions?: ReactNode
  badge?: ReactNode
  children: ReactNode
  className?: string
}

export default function PageShell({
  title,
  subtitle,
  actions,
  badge,
  children,
  className = '',
}: PageShellProps) {
  const profile = useUserProfile()
  const displayName = profile?.username ?? 'Flox AI'
  const avatar = initials(displayName)
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
      <header className="page-shell-header">
        <div className="page-shell-time">
          <span className="page-shell-time-clock">{formattedTime}</span>
          <span className="page-shell-time-date">{formattedDate}</span>
</div>
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
            <span>{displayName}</span>
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
