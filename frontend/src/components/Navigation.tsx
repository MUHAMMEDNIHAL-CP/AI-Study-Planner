import { Link, useLocation, useNavigate } from 'react-router-dom'
import { clearAuthTokens, isAuthenticated } from '../lib/auth'

const appLinks = [
  ['Dashboard', '/dashboard'],
  ['Planner', '/planner'],
  ['Tutor', '/ai-tutor'],
  ['Quiz', '/quiz'],
  ['Analytics', '/analytics'],
  ['Settings', '/settings'],
]

export default function Navigation() {
  const location = useLocation()
  const navigate = useNavigate()
  const authed = isAuthenticated()

  function logout() {
    clearAuthTokens()
    navigate('/login')
  }

  return (
    <header className="app-nav">
      <nav className="app-nav-inner">
        <Link className="app-brand" to={authed ? '/dashboard' : '/'}>
          <span className="app-brand-mark">F</span>
          <span>FocusFlow AI</span>
        </Link>
        <div className="app-nav-links">
          {authed ? (
            <>
              {appLinks.map(([label, to]) => (
                <Link
                  className={`nav-link ${location.pathname === to ? 'nav-link-active' : ''}`}
                  key={to}
                  to={to}
                >
                  {label}
                </Link>
              ))}
              <Link className="nav-link" to="/profile">Profile</Link>
              <button className="nav-button nav-danger" onClick={logout} type="button">Logout</button>
            </>
          ) : (
            <>
              <Link className="nav-link" to="/login">Login</Link>
              <Link className="nav-link nav-primary" to="/register">Register</Link>
            </>
          )}
        </div>
      </nav>
    </header>
  )
}
