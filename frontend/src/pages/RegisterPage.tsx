import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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
    <div className="auth-page">
      <form
        onSubmit={onSubmit}
        className="auth-card glass"
      >
        <h2 className="auth-title">Create account</h2>
        <p className="auth-subtitle">
          Start planning your focus with AI.
        </p>

        {error ? (
          <div className="auth-alert">
            {error}
          </div>
        ) : null}

        <div className="field-group">
        <label className="field-label">Username</label>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="field-input"
          required
        />
        </div>

        <div className="field-group">
        <label className="field-label">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="field-input"
          required
        />
        </div>

        <div className="field-group">
        <label className="field-label">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="field-input"
          required
        />
        </div>

        <button
          disabled={loading}
          type="submit"
          className="primary-button auth-submit"
        >
          {loading ? 'Creating...' : 'Register'}
        </button>

        <div className="auth-switch">
          Have an account?{' '}
          <Link className="text-link" to="/login">
            Login
          </Link>
        </div>
      </form>
    </div>
  )
}
