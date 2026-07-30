import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, getErrorMessage } from '../lib/api'
import { clearAuthTokens } from '../lib/auth'

type UserProfile = { id: number; username: string; email: string }

export default function ProfilePage() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.get<UserProfile>('/auth/me/').then(({ data }) => setProfile(data)).catch((err) => setError(getErrorMessage(err)))
  }, [])

  function logout() {
    clearAuthTokens()
    navigate('/login')
  }

  return (
    <div className="flow-page profile-page">
      <section className="page-title"><h1>Profile</h1><p>Your FocusFlow identity and subscription workspace.</p></section>
      {error ? <div className="auth-alert">{error}</div> : null}
      <section className="page-card profile-hero-card">
        <div className="profile-photo large">{(profile?.username ?? 'N').slice(0, 1).toUpperCase()}</div>
        <div><span>Full Name</span><strong>{profile?.username ?? 'Loading...'}</strong></div>
        <div><span>Email Address</span><strong>{profile?.email ?? 'Loading...'}</strong></div>
        <button className="gradient-action" onClick={() => navigate('/settings')} type="button">Edit Settings</button>
        <button className="danger-button" onClick={logout} type="button">Logout</button>
      </section>
    </div>
  )
}
