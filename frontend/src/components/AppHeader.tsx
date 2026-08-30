import { useEffect, useState, type ReactNode } from 'react'
import { useUserProfile, displayName, initials } from '../hooks/useUserProfile'

type AppHeaderProps = {
  /** Optional content rendered between the clock and the user chip (e.g. a search box). */
  children?: ReactNode
  className?: string
}

/**
 * Reusable page header showing a live clock/date on the left and the
 * signed-in user's name + avatar on the right. Matches the dashboard header.
 * The user chip is intentionally non-clickable.
 */
export default function AppHeader({ children, className = '' }: AppHeaderProps) {
  const profile = useUserProfile()
  const name = displayName(profile)
  const avatar = initials(name)
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
    <header className={`flow-header ${className}`.trim()}>
      <div className="flow-time">
        <span className="flow-time-clock">{formattedTime}</span>
        <span className="flow-time-date">{formattedDate}</span>
      </div>

      {children}

      <div className="flow-user">
        <span className="flow-user-name">{name}</span>
        <b>{avatar}</b>
      </div>
    </header>
  )
}

