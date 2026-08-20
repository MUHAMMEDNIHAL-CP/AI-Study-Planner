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

export default function RegisterPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { data } = await api.post<TokenResponse>('/auth/register/', { username, email, password })
      setAuthTokens(data.access, data.refresh)
      toast.success('Account created')
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
            <span>Personal planner</span>
            <span>AI tutor</span>
            <span>Quiz practice</span>
          </div>
        </section>

        <form className="premium-auth-card" onSubmit={onSubmit}>
          <div className="auth-card-head">
            <span>Create workspace</span>
            <h2>Start your study flow</h2>
            <p>Your planner, AI tutor, focus timer, and analytics will live here.</p>
          </div>
          {error ? <div className="auth-alert">{error}</div> : null}

          <label className="premium-field">
            <span>Full Name</span>
            <div className="input-shell"><b>ID</b><input autoComplete="name" placeholder="Name" value={username} onChange={(e) => setUsername(e.target.value)} required /></div>
          </label>
          <label className="premium-field">
            <span>Email Address</span>
            <div className="input-shell"><b>@</b><input autoComplete="email" placeholder="name@university.edu" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
          </label>
          <label className="premium-field">
            <span>Password</span>
            <div className="input-shell">
              <b>KEY</b>
              <input autoComplete="new-password" minLength={8} placeholder="At least 8 characters" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required />
              <button type="button" onClick={() => setShowPassword((value) => !value)}>{showPassword ? 'Hide' : 'Show'}</button>
            </div>
          </label>

          <button className="gradient-action" disabled={loading} type="submit">
            {loading ? 'Creating...' : 'Create Account'}
          </button>
          <p className="auth-switch">Already in the flow? <Link to="/login">Sign in</Link></p>
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
