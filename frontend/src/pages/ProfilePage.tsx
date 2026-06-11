import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, getErrorMessage } from '../lib/api'
import { clearAuthTokens } from '../lib/auth'

type UserProfile = {
  id: number
  username: string
  email: string
}

export default function ProfilePage() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadProfile() {
      try {
        const { data } = await api.get<UserProfile>('/auth/me/')
        setProfile(data)
      } catch (err) {
        setError(getErrorMessage(err))
      }
    }

    void loadProfile()
  }, [])

  function logout() {
    clearAuthTokens()
    navigate('/login')
  }

  return (
    <div className="p-6">
      <div className="glass p-6 rounded-lg shadow-glass max-w-4xl mx-auto text-left">
        <h2 className="text-2xl font-semibold">Profile</h2>
        <p className="text-sm opacity-80 mt-2">View your account details and session actions.</p>

        {error ? <div className="mt-4 rounded-md border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-300">{error}</div> : null}

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <div className="text-xs uppercase opacity-65">Username</div>
            <div className="mt-2 text-xl font-semibold text-[color:var(--text-h)]">{profile?.username ?? 'Loading...'}</div>
            <div className="mt-4 text-xs uppercase opacity-65">Email</div>
            <div className="mt-2 text-[color:var(--text-h)]">{profile?.email ?? 'Loading...'}</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <h3 className="font-semibold">Account actions</h3>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link className="rounded-md border border-white/15 px-3 py-2 text-sm" to="/settings">Settings</Link>
              <button className="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white" onClick={logout} type="button">Logout</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
