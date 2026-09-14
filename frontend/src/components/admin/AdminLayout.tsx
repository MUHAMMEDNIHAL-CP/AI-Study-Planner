import { useEffect, useState, type ReactNode } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import AdminSidebar from './AdminSidebar'
import { getTheme, toggleTheme, type ThemeMode } from '../../lib/theme'
import { displayName, initials, useUserProfile } from '../../hooks/useUserProfile'
import { IconMoon, IconSun } from '../icons'

export default function AdminLayout() {
  const profile = useUserProfile()
  const location = useLocation()
  const [theme, setTheme] = useState<ThemeMode>(() => getTheme())
  const [clock, setClock] = useState(() => new Date())
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  useEffect(() => {
    const t = window.setInterval(() => setClock(new Date()), 1000)
    return () => window.clearInterval(t)
  }, [])

  useEffect(() => {
    setMobileNavOpen(false)
  }, [location.pathname])

  function handleTheme() {
    setTheme(toggleTheme())
  }

  return (
    <div className={`ad-shell${mobileNavOpen ? ' ad-mobile-open' : ''}`}>
      <AdminSidebar />
      {mobileNavOpen && <button className="ad-backdrop" aria-label="Close menu" onClick={() => setMobileNavOpen(false)} type="button" />}
      <main className="ad-main">
        <header className="ad-topbar">
          <div className="ad-topbar-left">
            <button className="ad-menu-btn" onClick={() => setMobileNavOpen(true)} type="button" aria-label="Open navigation menu">
              <span />
              <span />
              <span />
            </button>
            <div className="ad-date">
              <span className="ad-clock">
                {new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(clock)}
              </span>
              <span className="ad-cal">
                {new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(clock)}
              </span>
            </div>
          </div>
          <div className="ad-top-actions">
            <LinkToStudentApp />
            <button className="ad-theme" onClick={handleTheme} type="button" aria-label="Toggle theme">
              {theme === 'dark' ? <IconSun size={17} /> : <IconMoon size={17} />}
            </button>
            <span className="ad-chip">
              {displayName(profile)}
              <b>{initials(displayName(profile))}</b>
            </span>
          </div>
        </header>
        <div className="ad-content">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

function LinkToStudentApp(): ReactNode {
  return (
    <a className="ad-student-btn" href="/dashboard">
      Back to app
    </a>
  )
}