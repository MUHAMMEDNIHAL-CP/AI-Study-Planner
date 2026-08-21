import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { applyTheme } from '../lib/theme'
import { clearAuthTokens } from '../lib/auth'
import PageShell from '../components/PageShell'

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
  const [preferences, setPreferences] = useState<Preferences>(() => loadPreferences())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const timer = window.setTimeout(() => setLoading(false), 250)
    return () => window.clearTimeout(timer)
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

  function logout() {
    clearAuthTokens()
    navigate('/login')
  }

  return (
    <PageShell
      className="settings-page-shell"
      eyebrow="SETTINGS"
      subtitle="Personalize your flow and manage your workspace."
      title="Settings"
    >
      {loading ? (
        <div className="dashboard-loading">Loading settings...</div>
      ) : (
        <div className="settings-main settings-single">
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
      )}
    </PageShell>
  )
}
