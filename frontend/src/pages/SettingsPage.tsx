import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { applyTheme } from '../lib/theme'
import { api, getErrorMessage } from '../lib/api'
import { clearAuthTokens } from '../lib/auth'
import PageShell from '../components/PageShell'

type UserProfile = {
  id: number
  username: string
  email: string
  profile?: {
    bio: string
    college: string
    course: string
    semester: number
    study_goal: string
  }
}

type Preferences = {
  theme: 'dark' | 'light' | 'system'
  studyReminders: boolean
  taskReminders: boolean
  dailyProgress: boolean
  studyDuration: number
  breakDuration: number
  aiSuggestions: boolean
  personalizedPlanning: boolean
}

const preferenceKey = 'focusflow.settings.preferences'

const defaultPreferences: Preferences = {
  theme: 'dark',
  studyReminders: true,
  taskReminders: true,
  dailyProgress: true,
  studyDuration: 50,
  breakDuration: 10,
  aiSuggestions: true,
  personalizedPlanning: true,
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

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      className={`settings-switch ${on ? 'on' : ''}`}
      onClick={onToggle}
      type="button"
      aria-pressed={on}
    >
      <span className="settings-switch-track" />
    </button>
  )
}

export default function SettingsPage() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [profileForm, setProfileForm] = useState({ username: '', email: '', bio: '', college: '', course: '', semester: 1, study_goal: '' })
  const [preferences, setPreferences] = useState<Preferences>(() => loadPreferences())
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    api.get<UserProfile>('/auth/me/')
      .then(({ data }) => {
        if (!active) return
        setProfile(data)
        const p = data.profile
        setProfileForm({
          username: data.username,
          email: data.email,
          bio: p?.bio ?? '',
          college: p?.college ?? '',
          course: p?.course ?? '',
          semester: p?.semester ?? 1,
          study_goal: p?.study_goal ?? '',
        })
        setError(null)
      })
      .catch((err) => {
        if (!active) return
        setError(getErrorMessage(err))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  useEffect(() => {
    applyTheme(preferences.theme === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : preferences.theme
    )
    localStorage.setItem(preferenceKey, JSON.stringify(preferences))
  }, [preferences])

  function update<K extends keyof Preferences>(key: K, value: Preferences[K]) {
    setPreferences((c) => ({ ...c, [key]: value }))
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
        bio: profileForm.bio,
        college: profileForm.college,
        course: profileForm.course,
        semester: profileForm.semester,
        study_goal: profileForm.study_goal,
      })
      setProfile(data)
      const p = data.profile
      setProfileForm({
        username: data.username,
        email: data.email,
        bio: p?.bio ?? '',
        college: p?.college ?? '',
        course: p?.course ?? '',
        semester: p?.semester ?? 1,
        study_goal: p?.study_goal ?? '',
      })
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
    const p = profile?.profile
    setProfileForm({
      username: profile?.username ?? '',
      email: profile?.email ?? '',
      bio: p?.bio ?? '',
      college: p?.college ?? '',
      course: p?.course ?? '',
      semester: p?.semester ?? 1,
      study_goal: p?.study_goal ?? '',
    })
    setEditing(false)
  }

  function logout() {
    clearAuthTokens()
    navigate('/login')
  }

  const name = profile?.username ?? 'Scholar'

  return (
    <PageShell
      className="settings-page-shell"
      eyebrow="SETTINGS"
      subtitle="Personalize your flow and manage your workspace."
      title="Settings"
    >
      {error && <div className="auth-alert">{error}</div>}

      {loading ? (
        <div className="dashboard-loading">Loading settings...</div>
      ) : (
        <div className="settings-grid">
          <div className="settings-main">
            <section className="page-card settings-card">
              <div className="settings-card-head">
                <span className="eyebrow">Appearance</span>
                <h2>Theme</h2>
                <p>Choose how Flox AI looks on this device.</p>
              </div>
              <div className="settings-theme-options">
                {(['light', 'dark', 'system'] as const).map((mode) => (
                  <button
                    className={`settings-theme-btn ${preferences.theme === mode ? 'active' : ''}`}
                    key={mode}
                    onClick={() => update('theme', mode)}
                    type="button"
                  >
                    <span className="settings-theme-icon">
                      {mode === 'light' ? '\u2600\uFE0F' : mode === 'dark' ? '\uD83C\uDF19' : '\uD83D\uDDA5\uFE0F'}
                    </span>
                    <span className="settings-theme-label">{mode.charAt(0).toUpperCase() + mode.slice(1)}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="page-card settings-card">
              <div className="settings-card-head">
                <span className="eyebrow">Notifications</span>
                <h2>Reminders</h2>
                <p>Control what notifications you receive.</p>
              </div>
              <div className="settings-row-list">
                <div className="settings-row">
                  <div>
                    <strong>Study reminders</strong>
                    <small>Alerts before scheduled study blocks</small>
                  </div>
                  <Toggle on={preferences.studyReminders} onToggle={() => update('studyReminders', !preferences.studyReminders)} />
                </div>
                <div className="settings-row">
                  <div>
                    <strong>Task reminders</strong>
                    <small>Notifications for upcoming task deadlines</small>
                  </div>
                  <Toggle on={preferences.taskReminders} onToggle={() => update('taskReminders', !preferences.taskReminders)} />
                </div>
                <div className="settings-row">
                  <div>
                    <strong>Daily progress</strong>
                    <small>End-of-day summary of your study activity</small>
                  </div>
                  <Toggle on={preferences.dailyProgress} onToggle={() => update('dailyProgress', !preferences.dailyProgress)} />
                </div>
              </div>
            </section>

            <section className="page-card settings-card">
              <div className="settings-card-head">
                <span className="eyebrow">Study</span>
                <h2>Session Preferences</h2>
                <p>Adjust focus and break durations.</p>
              </div>
              <div className="settings-row-list">
                <div className="settings-row">
                  <div className="settings-row-slider">
                    <div className="settings-row-slider-head">
                      <strong>Default study duration</strong>
                      <span>{preferences.studyDuration} min</span>
                    </div>
                    <input
                      aria-label="Study duration"
                      className="settings-range"
                      max="90"
                      min="25"
                      onChange={(e) => update('studyDuration', Number(e.target.value))}
                      step="5"
                      type="range"
                      value={preferences.studyDuration}
                    />
                    <div className="settings-range-labels"><span>25m</span><span>50m</span><span>90m</span></div>
                  </div>
                </div>
                <div className="settings-row">
                  <div className="settings-row-slider">
                    <div className="settings-row-slider-head">
                      <strong>Break duration</strong>
                      <span>{preferences.breakDuration} min</span>
                    </div>
                    <input
                      aria-label="Break duration"
                      className="settings-range"
                      max="30"
                      min="5"
                      onChange={(e) => update('breakDuration', Number(e.target.value))}
                      step="5"
                      type="range"
                      value={preferences.breakDuration}
                    />
                    <div className="settings-range-labels"><span>5m</span><span>15m</span><span>30m</span></div>
                  </div>
                </div>
              </div>
            </section>

            <section className="page-card settings-card">
              <div className="settings-card-head">
                <span className="eyebrow">AI Coach</span>
                <h2>Intelligence</h2>
                <p>Configure AI-powered study assistance.</p>
              </div>
              <div className="settings-row-list">
                <div className="settings-row">
                  <div>
                    <strong>AI suggestions</strong>
                    <small>Get smart recommendations based on your progress</small>
                  </div>
                  <Toggle on={preferences.aiSuggestions} onToggle={() => update('aiSuggestions', !preferences.aiSuggestions)} />
                </div>
                <div className="settings-row">
                  <div>
                    <strong>Personalized planning</strong>
                    <small>AI adapts study plans to your learning patterns</small>
                  </div>
                  <Toggle on={preferences.personalizedPlanning} onToggle={() => update('personalizedPlanning', !preferences.personalizedPlanning)} />
                </div>
              </div>
            </section>
          </div>

          <div className="settings-side">
            <section className="page-card settings-card settings-profile-card">
              <div className="settings-profile-header">
                <div className="settings-profile-avatar">
                  {name.slice(0, 2).toUpperCase()}
                </div>
                <h2>{name}</h2>
                <span>{profile?.email}</span>
              </div>
              <div className="settings-profile-fields">
                <label>
                  Full Name
                  <input
                    disabled={!editing || saving}
                    onChange={(e) => setProfileForm((c) => ({ ...c, username: e.target.value }))}
                    value={profileForm.username}
                  />
                </label>
                <label>
                  Email
                  <input
                    disabled={!editing || saving}
                    onChange={(e) => setProfileForm((c) => ({ ...c, email: e.target.value }))}
                    type="email"
                    value={profileForm.email}
                  />
                </label>
                <label>
                  Course
                  <input
                    disabled={!editing || saving}
                    onChange={(e) => setProfileForm((c) => ({ ...c, course: e.target.value }))}
                    placeholder="e.g. B.Sc Computer Science"
                    value={profileForm.course}
                  />
                </label>
                <label>
                  Semester
                  <input
                    disabled={!editing || saving}
                    max="12"
                    min="1"
                    onChange={(e) => setProfileForm((c) => ({ ...c, semester: Number(e.target.value) }))}
                    type="number"
                    value={profileForm.semester}
                  />
                </label>
                <label>
                  College
                  <input
                    disabled={!editing || saving}
                    onChange={(e) => setProfileForm((c) => ({ ...c, college: e.target.value }))}
                    placeholder="e.g. MIT"
                    value={profileForm.college}
                  />
                </label>
                <label className="settings-field-full">
                  Bio
                  <textarea
                    disabled={!editing || saving}
                    onChange={(e) => setProfileForm((c) => ({ ...c, bio: e.target.value }))}
                    placeholder="Tell us about yourself..."
                    rows={3}
                    value={profileForm.bio}
                  />
                </label>
                <label className="settings-field-full">
                  Study Goal
                  <input
                    disabled={!editing || saving}
                    onChange={(e) => setProfileForm((c) => ({ ...c, study_goal: e.target.value }))}
                    placeholder="e.g. Score 90%+ in semester finals"
                    value={profileForm.study_goal}
                  />
                </label>
              </div>
              <div className="settings-profile-actions">
                {editing && <button className="ghost-action settings-cancel" onClick={cancelEdit} type="button">Cancel</button>}
                <button
                  className="gradient-action"
                  disabled={saving}
                  onClick={editing ? saveProfile : () => setEditing(true)}
                  type="button"
                >
                  {editing ? (saving ? 'Saving...' : 'Save Changes') : 'Edit Profile'}
                </button>
              </div>
            </section>

            <section className="page-card settings-card">
              <div className="settings-card-head">
                <span className="eyebrow">Security</span>
                <h2>Account Security</h2>
              </div>
              <div className="settings-row-list">
                <button className="settings-action-row" onClick={() => toast.info('Password reset flow is coming soon.')} type="button">
                  <div>
                    <strong>Change password</strong>
                    <small>Update your account password</small>
                  </div>
                  <span>&rsaquo;</span>
                </button>
                <button className="settings-action-row" onClick={() => toast.info('Sessions management coming soon.')} type="button">
                  <div>
                    <strong>Active sessions</strong>
                    <small>Manage signed-in devices</small>
                  </div>
                  <span>&rsaquo;</span>
                </button>
              </div>
            </section>

            <section className="page-card settings-card settings-danger-card">
              <div className="settings-card-head">
                <span className="eyebrow">Danger Zone</span>
                <h2>Account Actions</h2>
              </div>
              <div className="settings-row-list">
                <button className="settings-action-row" onClick={logout} type="button">
                  <div>
                    <strong>Logout</strong>
                    <small>Sign out of your account</small>
                  </div>
                  <span>&rsaquo;</span>
                </button>
                <button className="settings-action-row settings-danger-row" onClick={() => toast.info('Account deletion needs a confirmation flow first.')} type="button">
                  <div>
                    <strong>Delete account</strong>
                    <small>Permanently remove your data</small>
                  </div>
                  <span>&rsaquo;</span>
                </button>
              </div>
            </section>
          </div>
        </div>
      )}
    </PageShell>
  )
}
