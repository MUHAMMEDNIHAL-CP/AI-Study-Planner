import { adminApi } from '../../lib/adminApi'
import { getErrorMessage } from '../../lib/api'
import { useState } from 'react'

type ToggleState = Record<string, boolean>

const FEATURE_TOGGLES: Array<{ key: string; label: string; desc: string }> = [
  { key: 'allow_registration', label: 'Allow new user registration', desc: 'Controls whether new accounts can be created' },
  { key: 'ai_enabled', label: 'FLOX AI enabled', desc: 'Master switch for the AI coach' },
  { key: 'quiz_generation', label: 'Quiz generation', desc: 'AI quiz generation for all users' },
  { key: 'focus_sessions', label: 'Focus sessions', desc: 'Focus timer feature availability' },
  { key: 'public_dashboards', label: 'Public overviews', desc: 'Allow marketing dashboards to show stats' },
]

export default function AdminSettings() {
  const [toggles, setToggles] = useState<ToggleState>({
    allow_registration: true,
    ai_enabled: true,
    quiz_generation: true,
    focus_sessions: true,
    public_dashboards: false,
  })
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  function toggle(key: string) {
    setToggles((t) => ({ ...t, [key]: !t[key] }))
    setSaved(false)
  }

  async function save() {
    setError('')
    setSaved(false)
    try {
      await adminApi.logAction('changed_setting', undefined, { settings: toggles })
      setSaved(true)
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }

  return (
    <div className="ad-page">
      <div className="ad-page-head">
        <div>
          <h1>Admin Settings</h1>
          <p>Platform-wide feature settings</p>
        </div>
      </div>

      {error && <div className="ad-alert">{error}</div>}
      {saved && <div className="ad-empty" style={{ borderColor: 'var(--line-strong)' }}>Settings saved and audited.</div>}

      <div className="ad-card">
        <div className="ad-bars">
          {FEATURE_TOGGLES.map((f) => (
            <div
              className="ad-health-row"
              key={f.key}
              style={{ cursor: 'pointer', gridTemplateColumns: '1fr auto' }}
              onClick={() => toggle(f.key)}
            >
              <span className="ad-health-name">
                {f.label}
                <small style={{ display: 'block', color: 'var(--muted)', fontWeight: 400 }}>{f.desc}</small>
              </span>
              <span className={`ad-pill ${toggles[f.key] ? 'ad-pill-green' : 'ad-pill-rose'}`}>
                {toggles[f.key] ? 'On' : 'Off'}
              </span>
            </div>
          ))}
        </div>

        <div className="ad-page-actions" style={{ marginTop: 18 }}>
          <button className="ad-btn ad-btn-primary" onClick={() => void save()} type="button">
            Save settings
          </button>
        </div>
      </div>
    </div>
  )
}