import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { IconOrbit } from '../components/icons'
import { toast } from 'react-toastify'
import { api, getErrorMessage } from '../lib/api'
import { setAuthTokens } from '../lib/auth'

type TokenResponse = {
  access: string
  refresh: string
}

export default function LoginPage() {
  const navigate = useNavigate()
  const [credential, setCredential] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const payload = { credential: credential.trim(), password }
      const { data } = await api.post<TokenResponse>('/auth/login/', payload)
      setAuthTokens(data.access, data.refresh)
      toast.success('Logged in')
      navigate('/dashboard')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="premium-auth-page">
      <div className="auth-shell">
        <section className="auth-hero">
          <span className="auth-logo"><IconOrbit size={24} /></span>
          <h1>Flox AI</h1>
          <p>Your study orbit — plan, focus, recall, recover.</p>
          <div className="auth-benefits">
            <span>AI study plans</span>
            <span>Focus coach</span>
            <span>Burnout insights</span>
          </div>
        </section>

        <form className="premium-auth-card" onSubmit={onSubmit}>
          <div className="auth-card-head">
            <span>Welcome back</span>
            <h2>Sign in to your flow</h2>
            <p>Use your username or email to continue your study workspace.</p>
          </div>
          {error ? <div className="auth-alert">{error}</div> : null}

          <label className="premium-field">
            <span>Email or Username</span>
            <div className="input-shell">
              <b>@</b>
              <input autoComplete="username" placeholder="name@university.edu or username" value={credential} onChange={(e) => setCredential(e.target.value)} required />
            </div>
          </label>

          <label className="premium-field">
            <span><em>Password</em><button type="button" onClick={() => toast.info('Password reset is coming soon.')}>Forgot?</button></span>
            <div className="input-shell">
              <b>KEY</b>
              <input autoComplete="current-password" placeholder="Enter password" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required />
              <button type="button" onClick={() => setShowPassword((value) => !value)}>{showPassword ? 'Hide' : 'Show'}</button>
            </div>
          </label>

          <button className="gradient-action" disabled={loading} type="submit">
            {loading ? 'Signing in...' : 'Sign In'}
          </button>

          <div className="auth-divider"><span>Or continue with</span></div>
          <div className="oauth-row">
            <button type="button" onClick={() => toast.info('Google sign in is not connected yet.')}>Google</button>
            <button type="button" onClick={() => toast.info('Apple sign in is not connected yet.')}>Apple</button>
          </div>
          <p className="auth-switch">New to Flox AI? <Link to="/register">Create an account</Link></p>
        </form>
      </div>

      <footer className="auth-footer">
        <span>Privacy Policy</span>
        <span>Terms of Service</span>
        <small>(c) 2024 Flox AI. Engineered for Flow.</small>
      </footer>
    </main>
  )
}
