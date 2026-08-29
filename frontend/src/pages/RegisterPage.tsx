import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import AuthLayout from '../components/AuthLayout'
import { api, getErrorMessage } from '../lib/api'
import { setAuthTokens } from '../lib/auth'
import { socialLogin } from '../lib/socialAuth'

type TokenResponse = {
  access: string
  refresh: string
}

function EyeIcon({ off }: { off?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12Z" />
      <circle cx="12" cy="12" r="2.8" />
      {off && <path d="M4 4l16 16" />}
    </svg>
  )
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.46a5.53 5.53 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.56-5.17 3.56-8.81Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3.01c-1.08.72-2.46 1.15-4.06 1.15-3.13 0-5.78-2.11-6.73-4.96H1.29v3.11A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.27 14.27A7.2 7.2 0 0 1 4.89 12c0-.79.14-1.55.38-2.27V6.62H1.29a12 12 0 0 0 0 10.76l3.98-3.11Z" />
      <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.61 4.58 1.8l3.44-3.44C17.95 1.19 15.23 0 12 0A12 12 0 0 0 1.29 6.62l3.98 3.11C6.22 6.88 8.87 4.77 12 4.77Z" />
    </svg>
  )
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
      <path d="M17.05 20.28c-.98.95-2.06.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01ZM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25Z" />
    </svg>
  )
}

export default function RegisterPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const checks = useMemo(() => ({
    len: password.length >= 8,
    num: /\d/.test(password),
    upper: /[A-Z]/.test(password),
  }), [password])

  const score = Object.values(checks).filter(Boolean).length
  const strength = score <= 1 ? 'Weak' : score === 2 ? 'Okay' : 'Strong'
  const strengthColor = score <= 1 ? '#ff6b6b' : score === 2 ? '#ffb84d' : '#36d479'

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!agreeTerms) { toast.warn('Please agree to the Terms of Service first.'); return }
    setLoading(true)
    try {
      const { data } = await api.post<TokenResponse>('/auth/register/', { username, email, password })
      setAuthTokens(data.access, data.refresh)
      toast.success('Account created')
      navigate('/welcome')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  async function handleSocial(provider: 'google' | 'apple') {
    setError(null)
    setLoading(true)
    try {
      const result = await socialLogin(provider)
      toast.success(result.is_new ? 'Account created' : 'Logged in')
      navigate(result.is_new ? '/welcome' : '/dashboard')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      headline={<>Start building better<br />study habits today.</>}
      sub="Join FLOX AI and start your journey."
      benefits={['\uD83D\uDD25 Build your streak', '\uD83D\uDCDA Organize your studies', '\uD83E\uDD16 Learn with AI']}
    >
      <form className="au-card" onSubmit={onSubmit}>
        <header className="au-card-head">
          <h2>Create your account</h2>
          <p>Join FLOX AI and start your journey.</p>
        </header>

        {error ? <div className="au-alert">{error}</div> : null}

        <label className="au-field">
          <span>Full Name</span>
          <input
            autoComplete="name"
            placeholder="Muhammed Nihal"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </label>

        <label className="au-field">
          <span>Email</span>
          <input
            autoComplete="email"
            placeholder="you@example.com"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>

        <label className="au-field">
          <span>Password</span>
          <div className="au-input-wrap">
            <input
              autoComplete="new-password"
              placeholder="At least 8 characters"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
            <button
              className="au-eye"
              onClick={() => setShowPassword((v) => !v)}
              type="button"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              <EyeIcon off={showPassword} />
            </button>
          </div>
        </label>

        {password && (
          <div className="au-strength">
            <div className="au-strength-top">
              <i className="au-strength-bar">
                <b style={{ width: (score / 3) * 100 + '%', background: strengthColor }} />
              </i>
              <em style={{ color: strengthColor }}>{strength}</em>
            </div>
            <ul className="au-checklist">
              <li className={checks.len ? 'ok' : ''}>{checks.len ? '\u2713' : '\u25CB'} 8+ characters</li>
              <li className={checks.num ? 'ok' : ''}>{checks.num ? '\u2713' : '\u25CB'} One number</li>
              <li className={checks.upper ? 'ok' : ''}>{checks.upper ? '\u2713' : '\u25CB'} One uppercase letter</li>
            </ul>
          </div>
        )}

        <button className="au-submit" disabled={loading} type="submit">
          {loading ? 'Creating...' : 'Create Account \u2192'}
        </button>

        <div className="au-divider"><span>or</span></div>

        <button className="au-oauth" disabled={loading} type="button" onClick={() => handleSocial('google')}>
          <GoogleIcon /> Continue with Google
        </button>
        <button className="au-oauth" disabled={loading} type="button" onClick={() => handleSocial('apple')}>
          <AppleIcon /> Continue with Apple
        </button>

        <label className="au-terms">
          <input checked={agreeTerms} onChange={(e) => setAgreeTerms(e.target.checked)} type="checkbox" />
          <span>I agree to the Terms of Service and Privacy Policy.</span>
        </label>

        <p className="au-switch">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </AuthLayout>
  )
}
