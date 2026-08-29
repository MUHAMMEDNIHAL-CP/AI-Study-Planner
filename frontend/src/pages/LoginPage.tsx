import { useState } from 'react'
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

export function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.46a5.53 5.53 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.56-5.17 3.56-8.81Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3.01c-1.08.72-2.46 1.15-4.06 1.15-3.13 0-5.78-2.11-6.73-4.96H1.29v3.11A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.27 14.27A7.2 7.2 0 0 1 4.89 12c0-.79.14-1.55.38-2.27V6.62H1.29a12 12 0 0 0 0 10.76l3.98-3.11Z" />
      <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.61 4.58 1.8l3.44-3.44C17.95 1.19 15.23 0 12 0A12 12 0 0 0 1.29 6.62l3.98 3.11C6.22 6.88 8.87 4.77 12 4.77Z" />
    </svg>
  )
}

export function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
      <path d="M17.05 20.28c-.98.95-2.06.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01ZM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25Z" />
    </svg>
  )
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
      headline={<>Plan smarter.<br />Focus deeper.<br />Learn better.</>}
      sub="Your AI-powered study companion."
      benefits={['\uD83D\uDD25 Build your study streak', '\uD83C\uDFAF Track your progress', '\uD83E\uDD16 Learn with your AI Coach']}
    >
      <form className="au-card" onSubmit={onSubmit}>
        <header className="au-card-head">
          <h2>Welcome back</h2>
          <p>Continue your learning journey.</p>
        </header>

        {error ? <div className="au-alert">{error}</div> : null}

        <label className="au-field">
          <span>Email</span>
          <input
            autoComplete="username"
            placeholder="you@example.com"
            type="text"
            value={credential}
            onChange={(e) => setCredential(e.target.value)}
            required
          />
        </label>

        <label className="au-field">
          <span>Password</span>
          <div className="au-input-wrap">
            <input
              autoComplete="current-password"
              placeholder="Enter your password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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

        <div className="au-forgot-row">
          <button className="au-forgot" onClick={() => toast.info('Password reset is coming soon.')} type="button">
            Forgot password?
          </button>
        </div>

        <button className="au-submit" disabled={loading} type="submit">
          {loading ? 'Signing in...' : 'Sign In \u2192'}
        </button>

        <div className="au-divider"><span>or</span></div>

        <button className="au-oauth" disabled={loading} type="button" onClick={() => handleSocial('google')}>
          <GoogleIcon /> Continue with Google
        </button>
        <button className="au-oauth" disabled={loading} type="button" onClick={() => handleSocial('apple')}>
          <AppleIcon /> Continue with Apple
        </button>

        <p className="au-switch">
          Don&apos;t have an account? <Link to="/register">Create account</Link>
        </p>
      </form>
    </AuthLayout>
  )
}
