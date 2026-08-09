import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useUserProfile, initials } from '../hooks/useUserProfile'
import { IconSettings } from './icons'

type PageShellProps = {
  eyebrow?: string
  title: string
  subtitle?: string
  actions?: ReactNode
  badge?: ReactNode
  children: ReactNode
  className?: string
}

export default function PageShell({
  eyebrow,
  title,
  subtitle,
  actions,
  badge,
  children,
  className = '',
}: PageShellProps) {
  const profile = useUserProfile()
  const displayName = profile?.username ?? 'FocusFlow'
  const avatar = initials(displayName)
  const [currentTime, setCurrentTime] = useState(() => new Date())

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

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
        <Link className="page-shell-user" to="/profile">
          <Link className="page-shell-settings" to="/settings" title="Settings">
            <IconSettings size={16} />
          </Link>
          <span>{displayName}</span>
          <b>{avatar}</b>
        </Link>
      </header>

      <section className="page-shell-hero">
        <div className="page-shell-copy">
          {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
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
