import { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import { applyTheme } from '../lib/theme'
import { api, getErrorMessage } from '../lib/api'

type UserProfile = { id: number; username: string; email: string }

type Preferences = {
  theme: 'dark' | 'light'
  sessionLength: number
  tutorPersonality: 'encouraging' | 'socratic'
  autoHideNotifications: boolean
  lofiAudio: boolean
  strictMode: boolean
  sessionReminders: boolean
  aiInsights: boolean
}

const preferenceKey = 'focusflow.settings.preferences'

const defaultPreferences: Preferences = {
  theme: 'dark',
  sessionLength: 45,
  tutorPersonality: 'encouraging',
  autoHideNotifications: true,
  lofiAudio: false,
  strictMode: true,
  sessionReminders: true,
  aiInsights: false,
}

function loadPreferences(): Preferences {
  try {
    const saved = localStorage.getItem(preferenceKey)
    const oldTheme = localStorage.getItem('theme') as Preferences['theme'] | null
    return {
      ...defaultPreferences,
      ...(oldTheme === 'dark' || oldTheme === 'light' ? { theme: oldTheme } : {}),
      ...(saved ? JSON.parse(saved) : {}),
    }
  } catch {
    return defaultPreferences
  }
}

function makeInitials(name: string, email: string) {
  const source = name.trim() || email.trim() || 'FocusFlow'
  const parts = source.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  return source.slice(0, 2).toUpperCase()
}

function makeWorkspaceSlug(name: string, email: string) {
  const source = name.trim() || email.split('@')[0] || 'scholar'
  return source.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'scholar'
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [profileForm, setProfileForm] = useState({ username: '', email: '' })
  const [preferences, setPreferences] = useState<Preferences>(() => loadPreferences())
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const timezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Calcutta', [])
  const displayName = profileForm.username || profile?.username || 'Scholar'
  const displayEmail = profileForm.email || profile?.email || 'Loading email...'
  const initials = useMemo(() => makeInitials(displayName, displayEmail), [displayEmail, displayName])
  const workspaceUrl = `focusflow.ai/${makeWorkspaceSlug(displayName, displayEmail)}`

  useEffect(() => {
    let active = true
    api.get<UserProfile>('/auth/me/')
      .then(({ data }) => {
        if (!active) return
        setProfile(data)
        setProfileForm({ username: data.username, email: data.email })
        setError(null)
      })
      .catch((err) => {
        if (!active) return
        setError(getErrorMessage(err))
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    applyTheme(preferences.theme)
    localStorage.setItem(preferenceKey, JSON.stringify(preferences))
  }, [preferences])

  function updatePreference<K extends keyof Preferences>(key: K, value: Preferences[K]) {
    setPreferences((current) => ({ ...current, [key]: value }))
  }

  async function saveProfile() {
    if (!profileForm.username.trim() || !profileForm.email.trim()) {
      toast.error('Name and email are required.')
      return
    }

    setSaving(true)
    try {
      const { data } = await api.patch<UserProfile>('/auth/me/', {
        username: profileForm.username.trim(),
        email: profileForm.email.trim(),
      })
      setProfile(data)
      setProfileForm({ username: data.username, email: data.email })
      setEditing(false)
      setError(null)
      toast.success('Profile updated.')
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  function cancelEdit() {
    setProfileForm({ username: profile?.username ?? '', email: profile?.email ?? '' })
    setEditing(false)
  }

  function exportArchive() {
    const archive = {
      profile,
      preferences,
      exportedAt: new Date().toISOString(),
    }
    const blob = new Blob([JSON.stringify(archive, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'focusflow-archive.json'
    link.click()
    URL.revokeObjectURL(url)
    toast.success('Archive exported.')
  }

  return (
    <div className="flow-page settings-page">
      <header className="flow-header">
        <label className="flow-search"><span>Search settings...</span></label>
        <div className="flow-user"><span>{displayName}</span><b>{initials}</b></div>
      </header>

      <section className="page-title">
        <h1>Settings</h1>
        <p>Personalize your flow and manage your workspace ecosystem.</p>
      </section>

      {error ? <div className="auth-alert">{error}</div> : null}

      <div className="settings-grid">
        <section className="page-card profile-settings">
          <div className="panel-heading">
            <div>
              <h2>Profile Information</h2>
              <p>Your login identity is synced with your account.</p>
            </div>
            <div className="settings-actions">
              {editing ? <button onClick={cancelEdit} type="button">Cancel</button> : null}
              <button disabled={saving || loading} onClick={editing ? saveProfile : () => setEditing(true)} type="button">
                {editing ? (saving ? 'Saving...' : 'Save Profile') : 'Edit Profile'}
              </button>
            </div>
          </div>

          {loading ? (
            <div className="settings-loading">Loading your account...</div>
          ) : (
            <div className="profile-edit-grid">
              <div className="profile-photo">{initials}<span>PROFILE</span></div>
              <label>
                Full Name
                <input
                  disabled={!editing || saving}
                  onChange={(event) => setProfileForm((current) => ({ ...current, username: event.target.value }))}
                  value={profileForm.username}
                />
              </label>
              <label>
                Email Address
                <input
                  disabled={!editing || saving}
                  onChange={(event) => setProfileForm((current) => ({ ...current, email: event.target.value }))}
                  type="email"
                  value={profileForm.email}
                />
              </label>
              <label>
                Timezone
                <input readOnly value={timezone} />
              </label>
              <label>
                Workspace URL
                <input readOnly value={workspaceUrl} />
              </label>
            </div>
          )}
        </section>

        <section className="page-card plan-card">
          <h2>Your Plan</h2>
          <div className="plan-price">
            <span>Pro Annual</span>
            <strong>$19<small>/month</small></strong>
            <p>Renews when billing is connected.</p>
          </div>
          <p className="plan-feature">Unlimited AI Tutor chats</p>
          <p className="plan-feature">Priority Gemini planning support</p>
          <button onClick={() => toast.info('Subscription billing is not connected yet.')} type="button">Manage Subscription</button>
        </section>

        <section className="page-card preferences-card">
          <h2>Study Preferences</h2>
          <p className="settings-muted">Saved on this device and applied instantly.</p>

          <div className="segmented settings-segmented">
            <button className={preferences.theme === 'dark' ? 'active' : ''} onClick={() => updatePreference('theme', 'dark')} type="button">Dark</button>
            <button className={preferences.theme === 'light' ? 'active' : ''} onClick={() => updatePreference('theme', 'light')} type="button">Light</button>
          </div>

          <div className="preference-row">
            <span>Focus Session Length</span>
            <strong>{preferences.sessionLength} Minutes</strong>
          </div>
          <input
            aria-label="Session length"
            max="90"
            min="25"
            onChange={(event) => updatePreference('sessionLength', Number(event.target.value))}
            step="5"
            type="range"
            value={preferences.sessionLength}
          />
          <div className="settings-range-labels"><span>25m</span><span>50m</span><span>90m</span></div>

          <div className="preference-row">
            <span>AI Tutor Personality</span>
            <strong>{preferences.tutorPersonality === 'encouraging' ? 'Encouraging' : 'Socratic'}</strong>
          </div>
          <div className="segmented settings-segmented">
            <button className={preferences.tutorPersonality === 'encouraging' ? 'active' : ''} onClick={() => updatePreference('tutorPersonality', 'encouraging')} type="button">Encouraging</button>
            <button className={preferences.tutorPersonality === 'socratic' ? 'active' : ''} onClick={() => updatePreference('tutorPersonality', 'socratic')} type="button">Socratic</button>
          </div>

          <div className="checkbox-grid">
            <label><input checked={preferences.autoHideNotifications} onChange={(event) => updatePreference('autoHideNotifications', event.target.checked)} type="checkbox" />Auto-hide notifications</label>
            <label><input checked={preferences.lofiAudio} onChange={(event) => updatePreference('lofiAudio', event.target.checked)} type="checkbox" />Lofi background audio</label>
            <label><input checked={preferences.strictMode} onChange={(event) => updatePreference('strictMode', event.target.checked)} type="checkbox" />Strict mode</label>
          </div>
        </section>

        <section className="page-card notifications-card">
          <h2>Notifications</h2>
          <label>
            <span><strong>Session reminders</strong><small>Alerts before scheduled study blocks</small></span>
            <input checked={preferences.sessionReminders} onChange={(event) => updatePreference('sessionReminders', event.target.checked)} type="checkbox" />
          </label>
          <label>
            <span><strong>AI Insights</strong><small>Weekly performance and burnout reports</small></span>
            <input checked={preferences.aiInsights} onChange={(event) => updatePreference('aiInsights', event.target.checked)} type="checkbox" />
          </label>
        </section>

        <section className="page-card security-card">
          <h2>Security</h2>
          <button onClick={() => toast.info('Password reset flow is coming soon.')} type="button">Change Password</button>
          <button onClick={() => toast.info('Two-factor auth is coming soon.')} type="button">Two-Factor Auth</button>
        </section>

        <section className="page-card data-card">
          <div><h2>Personal Data</h2><p>Manage your data history and export your study archive.</p></div>
          <button onClick={exportArchive} type="button">Export Archive</button>
          <button className="danger-button" onClick={() => toast.info('Account deletion needs a confirmation flow first.')} type="button">Delete Account</button>
        </section>
      </div>
    </div>
  )
}
