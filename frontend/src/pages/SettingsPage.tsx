import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'react-toastify'
import { applyTheme } from '../lib/theme'
import { clearAuthTokens } from '../lib/auth'
import PageShell from '../components/PageShell'

type ThemeChoice = 'light' | 'dark' | 'system'

type Preferences = {
  theme: ThemeChoice
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
    const oldTheme = localStorage.getItem('theme') as ThemeChoice | null
    return {
      ...defaultPreferences,
      ...(oldTheme === 'dark' || oldTheme === 'light' ? { theme: oldTheme } : {}),
      ...(saved ? JSON.parse(saved) : {}),
    }
  } catch {
    return defaultPreferences
  }
}

const THEME_OPTIONS: { value: ThemeChoice; label: string; icon: string }[] = [
  { value: 'light', label: 'Light', icon: '\u2600\uFE0F' },
  { value: 'dark', label: 'Dark', icon: '\uD83C\uDF19' },
  { value: 'system', label: 'System', icon: '\uD83D\uDDA5\uFE0F' },
]

type SectionId = 'appearance' | 'notifications' | 'study' | 'ai' | 'security' | 'account'

type SectionDef = {
  id: SectionId
  group: string
  label: string
  desc: string
  icon: string
}

const SECTIONS: SectionDef[] = [
  { id: 'appearance', group: 'General', label: 'Appearance', desc: 'Theme & display', icon: '\uD83C\uDFA8\uFE0F' },
  { id: 'notifications', group: 'General', label: 'Notifications', desc: 'Study & task alerts', icon: '\uD83D\uDD14' },
  { id: 'study', group: 'Study', label: 'Focus Sessions', desc: 'Timer & break lengths', icon: '\u23F1\uFE0F' },
  { id: 'ai', group: 'AI', label: 'AI Coach', desc: 'Personalization & tips', icon: '\uD83E\uDD16' },
  { id: 'security', group: 'Account', label: 'Security', desc: 'Password & devices', icon: '\uD83D\uDD12' },
  { id: 'account', group: 'Account', label: 'Account Actions', desc: 'Logout & delete account', icon: '\uD83D\uDC64' },
]

const SECTION_GROUPS = ['General', 'Study', 'AI', 'Account']

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      className={`settings-switch ${on ? 'on' : ''}`}
      onClick={onToggle}
      type="button"
      role="switch"
      aria-checked={on}
    >
      <span className="settings-switch-track" />
    </button>
  )
}

export default function SettingsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
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

  const rawSection = searchParams.get('s')
  const activeId: SectionId | null = SECTIONS.some((section) => section.id === rawSection)
    ? (rawSection as SectionId)
    : null
  const current: SectionDef = SECTIONS.find((section) => section.id === activeId) ?? SECTIONS[0]

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [activeId])

  function update<K extends keyof Preferences>(key: K, value: Preferences[K]) {
    setPreferences((c) => ({ ...c, [key]: value }))
  }

  function openSection(id: SectionId) {
    setSearchParams({ s: id })
  }

  function backToList() {
    setSearchParams({})
  }

  function logout() {
    clearAuthTokens()
    navigate('/login')
  }

  function sectionSubtitle(section: SectionDef): string {
    if (section.id === 'appearance') {
      return `${preferences.theme.charAt(0).toUpperCase()}${preferences.theme.slice(1)} mode`
    }
    if (section.id === 'study') {
      return `${preferences.studyDuration} min focus \u00B7 ${preferences.breakDuration} min break`
    }
    return section.desc
  }

  function renderPanel(id: SectionId) {
    switch (id) {
      case 'appearance':
        return (
          <>
            <div className="settings-card-head">
              <span className="eyebrow">Appearance</span>
              <h2>Theme</h2>
              <p>Choose how Flox AI looks on this device.</p>
            </div>
            <div className="settings-theme-options" role="radiogroup" aria-label="Theme">
              {THEME_OPTIONS.map((option) => (
                <button
                  aria-pressed={preferences.theme === option.value}
                  className={`settings-theme-btn ${preferences.theme === option.value ? 'active' : ''}`}
                  key={option.value}
                  onClick={() => update('theme', option.value)}
                  type="button"
                >
                  <span className="settings-theme-icon">{option.icon}</span>
                  <span className="settings-theme-label">{option.label}</span>
                  <span className="settings-theme-check" aria-hidden>&#10003;</span>
                </button>
              ))}
            </div>
          </>
        )
      case 'notifications':
        return (
          <>
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
          </>
        )
      case 'study':
        return (
          <>
            <div className="settings-card-head">
              <span className="eyebrow">Study</span>
              <h2>Session Durations</h2>
              <p>Adjust focus and break lengths. Focus Mode starts here by default.</p>
            </div>
            <div className="settings-row-list">
              <div className="settings-row">
                <div className="settings-row-slider">
                  <div className="settings-row-slider-head">
                    <strong>Default focus duration</strong>
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
          </>
        )
      case 'ai':
        return (
          <>
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
          </>
        )
      case 'security':
        return (
          <>
            <div className="settings-card-head">
              <span className="eyebrow">Security</span>
              <h2>Account Security</h2>
              <p>Keep your account safe across devices.</p>
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
          </>
        )
      case 'account':
        return (
          <>
            <div className="settings-card-head">
              <span className="eyebrow">Danger Zone</span>
              <h2>Account Actions</h2>
              <p>Sign out or permanently remove your data.</p>
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
          </>
        )
    }
  }

  return (
    <PageShell
      className={`settings-page-shell${activeId ? ' settings-in-section' : ''}`}
      eyebrow="SETTINGS"
      subtitle="Personalize your flow and manage your workspace."
      title="Settings"
    >
      {loading ? (
        <div className="dashboard-loading">Loading settings...</div>
      ) : (
        <div className="settings-shell" data-view={activeId ? 'detail' : 'list'}>
          <nav aria-label="Settings sections" className="settings-mobile-list">
            {SECTION_GROUPS.map((group) => (
              <div key={group}>
                <span className="settings-group-title">{group}</span>
                {SECTIONS.filter((section) => section.group === group).map((section) => (
                  <button
                    className="settings-list-row"
                    key={section.id}
                    onClick={() => openSection(section.id)}
                    type="button"
                  >
                    <span className="settings-item-icon">{section.icon}</span>
                    <span className="settings-list-text">
                      <strong>{section.label}</strong>
                      <small>{sectionSubtitle(section)}</small>
                    </span>
                    <span aria-hidden className="settings-chevron">&rsaquo;</span>
                  </button>
                ))}
              </div>
            ))}
          </nav>

          <aside aria-label="Settings sections" className="settings-nav">
            {SECTION_GROUPS.map((group) => (
              <div className="settings-nav-group" key={group}>
                <span className="settings-group-title">{group}</span>
                {SECTIONS.filter((section) => section.group === group).map((section) => {
                  const isActive = current.id === section.id
                  return (
                    <button
                      aria-current={isActive || undefined}
                      className={`settings-nav-item${isActive ? ' active' : ''}`}
                      key={section.id}
                      onClick={() => openSection(section.id)}
                      type="button"
                    >
                      <span className="settings-item-icon">{section.icon}</span>
                      <span>{section.label}</span>
                    </button>
                  )
                })}
              </div>
            ))}
          </aside>

          <section className="page-card settings-card settings-panel">
            <header className="settings-detail-head">
              <button
                aria-label="Back to settings list"
                className="settings-back-btn"
                onClick={backToList}
                type="button"
              >
                &larr;
              </button>
              <div className="settings-detail-title">
                <strong>{current.label}</strong>
                <small>{current.desc}</small>
              </div>
            </header>
            {renderPanel(current.id)}
          </section>
        </div>
      )}
    </PageShell>
  )
}
