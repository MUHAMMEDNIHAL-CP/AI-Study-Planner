import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'react-toastify'
import { api, getErrorMessage } from '../lib/api'
import { applyTheme, getTheme, type ThemeMode } from '../lib/theme'
import { clearAuthTokens } from '../lib/auth'
import PageShell from '../components/PageShell'

/* ── Local preferences ─────────────────────────────────────── */

type Preferences = {
  studyReminders: boolean
  taskReminders: boolean
  examReminders: boolean
  streakReminder: boolean
  dailySummary: boolean
  aiRecommendations: boolean
  reminderTime: string

  sessionLength: number
  breakLength: number
  weekStartsOn: string
  aiAutoPlanning: boolean
  autoStartBreak: boolean
  studySounds: boolean
  defaultSound: string
  hideNotifications: boolean
  showSessionProgress: boolean

  qualifyingMinutes: number
  showStreakDashboard: boolean
  showStreakProfile: boolean

  aiSuggestions: boolean
  dailyInsight: boolean
  personalizedPlanning: boolean
  weakTopicDetection: boolean
  adaptiveQuizzes: boolean

  twoFactor: boolean
  aiPersonalization: boolean

  language: string
  timezone: string
  dateFormat: string
  timeFormat: string
}

const preferenceKey = 'FLOX.settings.v2'

const defaultPreferences: Preferences = {
  studyReminders: true,
  taskReminders: true,
  examReminders: true,
  streakReminder: true,
  dailySummary: false,
  aiRecommendations: true,
  reminderTime: '15m',

  sessionLength: 50,
  breakLength: 10,
  weekStartsOn: 'monday',
  aiAutoPlanning: true,
  autoStartBreak: false,
  studySounds: true,
  defaultSound: 'rain',
  hideNotifications: true,
  showSessionProgress: true,

  qualifyingMinutes: 20,
  showStreakDashboard: true,
  showStreakProfile: true,

  aiSuggestions: true,
  dailyInsight: true,
  personalizedPlanning: true,
  weakTopicDetection: true,
  adaptiveQuizzes: true,

  twoFactor: false,
  aiPersonalization: true,

  language: 'en',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata',
  dateFormat: 'dd/mm/yyyy',
  timeFormat: '12h',
}

function loadPreferences(): Preferences {
  try {
    const saved = localStorage.getItem(preferenceKey)
    return saved ? { ...defaultPreferences, ...JSON.parse(saved) } : defaultPreferences
  } catch {
    return defaultPreferences
  }
}

/* ── Options ───────────────────────────────────────────────── */

type SectionId =
  | 'notifications' | 'study' | 'focus' | 'streak' | 'ai'
  | 'account' | 'security' | 'region' | 'privacy' | 'about'

type SectionDef = {
  id: SectionId
  label: string
  desc: string
  icon: string
}

const SECTIONS: Record<SectionId, SectionDef> = {
  notifications: { id: 'notifications', label: 'Notifications', desc: 'Study, task and exam reminders', icon: '\uD83D\uDD14' },
  study: { id: 'study', label: 'Study Preferences', desc: 'Goals, study time and planning', icon: '\uD83D\uDCDA' },
  focus: { id: 'focus', label: 'Focus Mode', desc: 'Timer, breaks and sounds', icon: '\u23F1\uFE0F' },
  streak: { id: 'streak', label: 'Streak', desc: 'Streak and freeze settings', icon: '\uD83D\uDD25' },
  ai: { id: 'ai', label: 'AI Preferences', desc: 'AI coaching and personalization', icon: '\uD83E\uDD16' },
  account: { id: 'account', label: 'Account', desc: 'Email and account information', icon: '\uD83D\uDC64' },
  security: { id: 'security', label: 'Security', desc: 'Password and active sessions', icon: '\uD83D\uDD12' },
  region: { id: 'region', label: 'Language & Region', desc: 'Language, timezone and date format', icon: '\uD83C\uDF10' },
  privacy: { id: 'privacy', label: 'Data & Privacy', desc: 'Data, AI usage and account deletion', icon: '\uD83D\uDEE1\uFE0F' },
  about: { id: 'about', label: 'About', desc: 'FLOX AI version and information', icon: '\u2139\uFE0F' },
}

const GROUPS: Array<{ title: string; items: SectionId[] }> = [
  { title: 'General', items: ['notifications'] },
  { title: 'Study', items: ['study', 'focus', 'streak'] },
  { title: 'AI', items: ['ai'] },
  { title: 'Account', items: ['account', 'security', 'region'] },
  { title: 'Privacy', items: ['privacy'] },
  { title: 'About', items: ['about'] },
]

const REMINDER_TIME_OPTIONS = [
  { value: '5m', label: '5 minutes before' },
  { value: '15m', label: '15 minutes before' },
  { value: '30m', label: '30 minutes before' },
  { value: '1h', label: '1 hour before' },
]

const SESSION_LENGTHS = [25, 30, 45, 50, 60, 90]
const BREAK_LENGTHS = [5, 10, 15, 20, 30]
const QUALIFYING_MINUTES = [5, 10, 15, 20, 30]

const SOUND_OPTIONS = [
  { value: 'rain', label: 'Rain' },
  { value: 'forest', label: 'Forest' },
  { value: 'ocean', label: 'Ocean' },
  { value: 'lofi', label: 'Lofi Beats' },
  { value: 'white-noise', label: 'White Noise' },
  { value: 'silence', label: 'Silence' },
]

const STUDY_TIME_SELECT_OPTIONS = [
  { value: 'morning', label: 'Morning' },
  { value: 'afternoon', label: 'Afternoon' },
  { value: 'evening', label: 'Evening' },
  { value: 'night', label: 'Night' },
]

const COACHING_STYLE_OPTIONS = [
  { value: 'friendly', label: 'Friendly' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'motivational', label: 'Motivational' },
  { value: 'strict', label: 'Strict' },
]

const TIMEZONE_OPTIONS = [
  { value: 'Asia/Kolkata', label: 'India Standard Time' },
  { value: 'Asia/Dubai', label: 'Gulf Standard Time' },
  { value: 'Asia/Karachi', label: 'Pakistan Standard Time' },
  { value: 'Asia/Dhaka', label: 'Bangladesh Standard Time' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Berlin', label: 'Central European Time' },
  { value: 'America/New_York', label: 'Eastern Time (US)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (US)' },
  { value: 'UTC', label: 'Coordinated Universal Time' },
]

const DATE_FORMAT_OPTIONS = [
  { value: 'dd/mm/yyyy', label: 'DD/MM/YYYY' },
  { value: 'mm/dd/yyyy', label: 'MM/DD/YYYY' },
  { value: 'yyyy-mm-dd', label: 'YYYY-MM-DD' },
]

const TIME_FORMAT_OPTIONS = [
  { value: '12h', label: '12-hour' },
  { value: '24h', label: '24-hour' },
]

/* ── Small building blocks ─────────────────────────────────── */

function Switch({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      className={`st-switch ${on ? 'on' : ''}`}
      onClick={onToggle}
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={on ? 'Turn off' : 'Turn on'}
    >
      <span className="st-switch-track" />
    </button>
  )
}

function RadioGroup({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: string; label: string }>
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="st-radio-list" role="radiogroup">
      {options.map((option) => (
        <button
          aria-checked={value === option.value}
          className={`st-radio-row ${value === option.value ? 'active' : ''}`}
          key={option.value}
          onClick={() => onChange(option.value)}
          role="radio"
          type="button"
        >
          <span className="st-radio-dot" />
          {option.label}
        </button>
      ))}
    </div>
  )
}

function SelectRow({
  title,
  desc,
  value,
  onChange,
  options,
}: {
  title: string
  desc?: string
  value: string | number
  onChange: (value: string) => void
  options: Array<{ value: string | number; label: string }>
}) {
  const current = options.find((o) => o.value === value)
  return (
    <div className="st-row">
      <span className="st-row-text">
        <strong>{title}</strong>
        {desc && <small>{desc}</small>}
      </span>
      <span className="st-select-wrap">
        <select
          aria-label={title}
          className="st-select"
          onChange={(e) => onChange(e.target.value)}
          value={String(value)}
        >
          {!current && <option value={String(value)}>{String(value)}</option>}
          {options.map((o) => (
            <option key={o.value} value={String(o.value)}>{o.label}</option>
          ))}
        </select>
        <span aria-hidden className="st-row-chevron">&rsaquo;</span>
      </span>
    </div>
  )
}

function ToggleRow({
  title,
  desc,
  on,
  onToggle,
}: {
  title: string
  desc?: string
  on: boolean
  onToggle: () => void
}) {
  return (
    <div className="st-row">
      <span className="st-row-text">
        <strong>{title}</strong>
        {desc && <small>{desc}</small>}
      </span>
      <Switch on={on} onToggle={onToggle} />
    </div>
  )
}

function Divider() {
  return <hr className="st-divider" />
}

/* ── Page ──────────────────────────────────────────────────── */

export default function SettingsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [preferences, setPreferences] = useState<Preferences>(() => loadPreferences())
  const [theme, setTheme] = useState<ThemeMode>(() => getTheme())

  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [dailyGoal, setDailyGoal] = useState(4)
  const [preferredStudyTime, setPreferredStudyTime] = useState('evening')
  const [coachingStyle, setCoachingStyle] = useState('balanced')
  const [currentStreak, setCurrentStreak] = useState(0)
  const [, setSavingProfile] = useState(false)
  const [editField, setEditField] = useState<'email' | 'username' | null>(null)
  const [editValue, setEditValue] = useState('')

  useEffect(() => {
    let active = true
    Promise.all([
      api.get('/auth/me/').catch(() => null),
      api.get('/study/dashboard/').catch(() => null),
    ]).then(([meRes, dashRes]) => {
      if (!active) return
      if (meRes?.data) {
        setEmail(meRes.data.email ?? '')
        setUsername(meRes.data.username ?? '')
        setDailyGoal(meRes.data.profile?.daily_study_goal ?? 4)
        setPreferredStudyTime(meRes.data.profile?.preferred_study_time ?? 'evening')
        setCoachingStyle(meRes.data.profile?.coaching_style ?? 'balanced')
      }
      if (dashRes?.data) setCurrentStreak(dashRes.data.current_streak ?? 0)
    })
    return () => { active = false }
  }, [])

  useEffect(() => {
    localStorage.setItem(preferenceKey, JSON.stringify(preferences))
  }, [preferences])

  function update<K extends keyof Preferences>(key: K, value: Preferences[K]) {
    setPreferences((c) => ({ ...c, [key]: value }))
  }

  async function patchProfile(payload: Record<string, unknown>) {
    setSavingProfile(true)
    try {
      const { data } = await api.patch('/auth/me/', payload)
      setEmail(data.email ?? '')
      setUsername(data.username ?? '')
      setDailyGoal(data.profile?.daily_study_goal ?? dailyGoal)
      setPreferredStudyTime(data.profile?.preferred_study_time ?? preferredStudyTime)
      setCoachingStyle(data.profile?.coaching_style ?? coachingStyle)
      toast.success('Settings saved.')
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSavingProfile(false)
    }
  }

  const rawSection = searchParams.get('s')
  const activeId: SectionId | null =
    rawSection && rawSection in SECTIONS ? (rawSection as SectionId) : null

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [activeId])

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

  function toggleDarkMode() {
    const next: ThemeMode = theme === 'dark' ? 'light' : 'dark'
    applyTheme(next)
    setTheme(next)
  }

  function startEdit(field: 'email' | 'username') {
    setEditValue(field === 'email' ? email : username)
    setEditField(field)
  }

  async function saveEdit() {
    if (!editValue.trim()) {
      toast.error('This field cannot be empty.')
      return
    }
    await patchProfile(editField === 'email' ? { email: editValue.trim() } : { username: editValue.trim() })
    setEditField(null)
  }

  function downloadMyData() {
    toast.info('Preparing your data...')
    Promise.all([
      api.get('/productivity/logs/').catch(() => ({ data: [] })),
      api.get('/productivity/focus-sessions/').catch(() => ({ data: [] })),
      api.get('/quiz/history/').catch(() => ({ data: [] })),
    ]).then(([logs, sessions, quizzes]) => {
      const payload = {
        exported_at: new Date().toISOString(),
        productivity_logs: logs.data,
        focus_sessions: sessions.data,
        quizzes: quizzes.data,
      }
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'FLOX-my-data.json'
      link.click()
      URL.revokeObjectURL(url)
      toast.success('Your data has been downloaded.')
    })
  }

  /* ── Detail panels ── */

  function renderSection(id: SectionId) {
    switch (id) {
      case 'notifications':
        return (
          <>
            <div className="st-rows">
              <ToggleRow desc="Remind me when it's time to study." on={preferences.studyReminders} onToggle={() => update('studyReminders', !preferences.studyReminders)} title="Study Reminders" />
              <ToggleRow on={preferences.taskReminders} onToggle={() => update('taskReminders', !preferences.taskReminders)} title="Task Reminders" />
              <ToggleRow on={preferences.examReminders} onToggle={() => update('examReminders', !preferences.examReminders)} title="Exam Reminders" />
              <ToggleRow on={preferences.streakReminder} onToggle={() => update('streakReminder', !preferences.streakReminder)} title="Streak Reminder" />
              <ToggleRow on={preferences.dailySummary} onToggle={() => update('dailySummary', !preferences.dailySummary)} title="Daily Summary" />
              <ToggleRow on={preferences.aiRecommendations} onToggle={() => update('aiRecommendations', !preferences.aiRecommendations)} title="AI Recommendations" />
            </div>
            <Divider />
            <span className="st-section-label">Reminder Time</span>
            <RadioGroup
              onChange={(v) => update('reminderTime', v)}
              options={REMINDER_TIME_OPTIONS}
              value={preferences.reminderTime}
            />
          </>
        )

      case 'study':
        return (
          <>
            <div className="st-rows">
              <SelectRow
                desc="Synced with your profile."
                onChange={(v) => patchProfile({ daily_study_goal: Number(v) })}
                options={[1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({ value: n, label: `${n} hours` }))}
                title="Daily Study Goal"
                value={dailyGoal}
              />
              <SelectRow
                onChange={(v) => update('sessionLength', Number(v))}
                options={SESSION_LENGTHS.map((n) => ({ value: n, label: `${n} min` }))}
                title="Default Focus Session"
                value={preferences.sessionLength}
              />
              <SelectRow
                onChange={(v) => update('breakLength', Number(v))}
                options={BREAK_LENGTHS.map((n) => ({ value: n, label: `${n} min` }))}
                title="Default Break"
                value={preferences.breakLength}
              />
              <SelectRow
                desc="When do you study best?"
                onChange={(v) => patchProfile({ preferred_study_time: v })}
                options={STUDY_TIME_SELECT_OPTIONS}
                title="Preferred Study Time"
                value={preferredStudyTime}
              />
              <SelectRow
                onChange={(v) => update('weekStartsOn', v)}
                options={[
                  { value: 'monday', label: 'Monday' },
                  { value: 'sunday', label: 'Sunday' },
                ]}
                title="Week Starts On"
                value={preferences.weekStartsOn}
              />
            </div>
            <Divider />
            <span className="st-section-label">Planning</span>
            <div className="st-rows">
              <ToggleRow desc="Let AI arrange your schedule automatically." on={preferences.aiAutoPlanning} onToggle={() => update('aiAutoPlanning', !preferences.aiAutoPlanning)} title="AI Auto Planning" />
            </div>
          </>
        )

      case 'focus':
        return (
          <>
            <span className="st-section-label">Timer</span>
            <div className="st-rows">
              <SelectRow
                onChange={(v) => update('sessionLength', Number(v))}
                options={SESSION_LENGTHS.map((n) => ({ value: n, label: `${n} min` }))}
                title="Default Session"
                value={preferences.sessionLength}
              />
              <SelectRow
                onChange={(v) => update('breakLength', Number(v))}
                options={BREAK_LENGTHS.map((n) => ({ value: n, label: `${n} min` }))}
                title="Default Break"
                value={preferences.breakLength}
              />
              <ToggleRow on={preferences.autoStartBreak} onToggle={() => update('autoStartBreak', !preferences.autoStartBreak)} title="Auto Start Break" />
            </div>
            <Divider />
            <span className="st-section-label">Sounds</span>
            <div className="st-rows">
              <ToggleRow on={preferences.studySounds} onToggle={() => update('studySounds', !preferences.studySounds)} title="Study Sounds" />
            </div>
            <div className="st-sound-picker">
              {SOUND_OPTIONS.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  className={'st-sound-chip' + (preferences.defaultSound === s.value ? ' active' : '')}
                  onClick={() => update('defaultSound', s.value)}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <Divider />
            <span className="st-section-label">While Focusing</span>
            <div className="st-rows">
              <ToggleRow on={preferences.hideNotifications} onToggle={() => update('hideNotifications', !preferences.hideNotifications)} title="Hide Notifications" />
              <ToggleRow on={preferences.showSessionProgress} onToggle={() => update('showSessionProgress', !preferences.showSessionProgress)} title="Show Session Progress" />
            </div>
          </>
        )

      case 'streak':
        return (
          <>
            <div className="st-streak-hero">
              <span className="st-streak-flame">&#128293;</span>
              <span className="st-streak-days">{currentStreak}</span>
              <span className="st-streak-caption">{currentStreak === 1 ? 'DAY' : 'DAYS'} CURRENT STREAK</span>
            </div>
            <div className="st-rows">
              <SelectRow
                desc="Minimum focused time that keeps the streak alive."
                onChange={(v) => update('qualifyingMinutes', Number(v))}
                options={QUALIFYING_MINUTES.map((n) => ({ value: n, label: `${n} minutes / day` }))}
                title="Qualifying Study Time"
                value={preferences.qualifyingMinutes}
              />
              <ToggleRow on={preferences.streakReminder} onToggle={() => update('streakReminder', !preferences.streakReminder)} title="Streak Reminder" />
              <button
                className="st-row st-row-btn"
                onClick={() => toast.info('Streak Freeze is coming soon.')}
                type="button"
              >
                <span className="st-row-text">
                  <strong>Streak Freeze</strong>
                  <small>1 available &middot; protects your streak for one day</small>
                </span>
                <span aria-hidden className="st-row-chevron">&rsaquo;</span>
              </button>
            </div>
            <Divider />
            <span className="st-section-label">Visibility</span>
            <div className="st-rows">
              <ToggleRow on={preferences.showStreakDashboard} onToggle={() => update('showStreakDashboard', !preferences.showStreakDashboard)} title="Show Streak on Dashboard" />
              <ToggleRow on={preferences.showStreakProfile} onToggle={() => update('showStreakProfile', !preferences.showStreakProfile)} title="Show Streak on Profile" />
            </div>
          </>
        )

      case 'ai':
        return (
          <>
            <div className="st-rows">
              <ToggleRow on={preferences.aiSuggestions} onToggle={() => update('aiSuggestions', !preferences.aiSuggestions)} title="AI Study Suggestions" />
              <ToggleRow on={preferences.dailyInsight} onToggle={() => update('dailyInsight', !preferences.dailyInsight)} title="Daily AI Insight" />
              <ToggleRow on={preferences.personalizedPlanning} onToggle={() => update('personalizedPlanning', !preferences.personalizedPlanning)} title="Personalized Planning" />
              <ToggleRow on={preferences.weakTopicDetection} onToggle={() => update('weakTopicDetection', !preferences.weakTopicDetection)} title="Weak Topic Detection" />
              <ToggleRow on={preferences.adaptiveQuizzes} onToggle={() => update('adaptiveQuizzes', !preferences.adaptiveQuizzes)} title="Adaptive Quizzes" />
            </div>
            <Divider />
            <span className="st-section-label">Coaching Style</span>
            <RadioGroup
              onChange={(v) => patchProfile({ coaching_style: v })}
              options={COACHING_STYLE_OPTIONS}
              value={coachingStyle}
            />
          </>
        )

      case 'account':
        return (
          <>
            <div className="st-rows">
              <button className="st-row st-row-btn" onClick={() => startEdit('email')} type="button">
                <span className="st-row-text">
                  <strong>Email</strong>
                  <small>{email || 'Add your email address'}</small>
                </span>
                <span aria-hidden className="st-row-chevron">&rsaquo;</span>
              </button>
              <button className="st-row st-row-btn" onClick={() => startEdit('username')} type="button">
                <span className="st-row-text">
                  <strong>Username</strong>
                  <small>{username || 'Set your username'}</small>
                </span>
                <span aria-hidden className="st-row-chevron">&rsaquo;</span>
              </button>
              <button
                className="st-row st-row-btn"
                onClick={() => toast.info('Connected accounts are coming soon.')}
                type="button"
              >
                <span className="st-row-text">
                  <strong>Connected Accounts</strong>
                  <small>Sign in with Google and more</small>
                </span>
                <span aria-hidden className="st-row-chevron">&rsaquo;</span>
              </button>
            </div>
          </>
        )

      case 'security':
        return (
          <div className="st-rows">
            <button
              className="st-row st-row-btn"
              onClick={() => toast.info('Password change is coming soon.')}
              type="button"
            >
              <span className="st-row-text">
                <strong>Password</strong>
                <small>Change your password</small>
              </span>
              <span aria-hidden className="st-row-chevron">&rsaquo;</span>
            </button>
            <ToggleRow on={preferences.twoFactor} onToggle={() => update('twoFactor', !preferences.twoFactor)} title="Two-Factor Authentication" />
            <button
              className="st-row st-row-btn"
              onClick={() => toast.info('Session management is coming soon.')}
              type="button"
            >
              <span className="st-row-text">
                <strong>Active Sessions</strong>
                <small>You are signed in on 2 devices</small>
              </span>
              <span aria-hidden className="st-row-chevron">&rsaquo;</span>
            </button>
            <button
              className="st-row st-row-btn"
              onClick={() => toast.info('Login activity is coming soon.')}
              type="button"
            >
              <span className="st-row-text">
                <strong>Login Activity</strong>
                <small>Recent sign-ins to your account</small>
              </span>
              <span aria-hidden className="st-row-chevron">&rsaquo;</span>
            </button>
          </div>
        )

      case 'region':
        return (
          <div className="st-rows">
            <SelectRow
              onChange={(v) => update('language', v)}
              options={[{ value: 'en', label: 'English' }]}
              title="Language"
              value={preferences.language}
            />
            <SelectRow
              onChange={(v) => update('timezone', v)}
              options={TIMEZONE_OPTIONS}
              title="Time Zone"
              value={preferences.timezone}
            />
            <SelectRow
              onChange={(v) => update('dateFormat', v)}
              options={DATE_FORMAT_OPTIONS}
              title="Date Format"
              value={preferences.dateFormat}
            />
            <SelectRow
              onChange={(v) => update('timeFormat', v)}
              options={TIME_FORMAT_OPTIONS}
              title="Time Format"
              value={preferences.timeFormat}
            />
          </div>
        )

      case 'privacy':
        return (
          <>
            <div className="st-rows">
              <button
                className="st-row st-row-btn"
                onClick={() => navigate('/productivity')}
                type="button"
              >
                <span className="st-row-text">
                  <strong>Study History</strong>
                  <small>Browse your logs and focus sessions</small>
                </span>
                <span aria-hidden className="st-row-chevron">&rsaquo;</span>
              </button>
              <ToggleRow desc="Improve suggestions using your activity." on={preferences.aiPersonalization} onToggle={() => update('aiPersonalization', !preferences.aiPersonalization)} title="AI Personalization" />
              <button className="st-row st-row-btn" onClick={downloadMyData} type="button">
                <span className="st-row-text">
                  <strong>Download My Data</strong>
                  <small>Export everything as JSON</small>
                </span>
                <span aria-hidden className="st-row-chevron">&rsaquo;</span>
              </button>
            </div>
            <span className="st-section-label danger">Danger Zone</span>
            <div className="st-danger-zone">
              <button
                className="st-danger-row"
                onClick={() => toast.info('Clearing history is coming soon.')}
                type="button"
              >
                <span className="st-danger-icon">&#128465;&#65039;</span>
                <span className="st-row-text">
                  <strong>Clear Study History</strong>
                  <small>Delete all productivity logs permanently</small>
                </span>
                <span aria-hidden className="st-row-chevron">&rsaquo;</span>
              </button>
              <button
                className="st-danger-row"
                onClick={() => toast.info('Account deletion is coming soon.')}
                type="button"
              >
                <span className="st-danger-icon">&#9888;&#65039;</span>
                <span className="st-row-text">
                  <strong>Delete Account</strong>
                  <small>Permanently remove your account and data</small>
                </span>
                <span aria-hidden className="st-row-chevron">&rsaquo;</span>
              </button>
            </div>
          </>
        )

      case 'about':
        return (
          <>
            <div className="st-about">
              <span className="st-about-logo">&#9673;</span>
              <h2>FLOX AI</h2>
              <span className="st-about-orbit">STUDY ORBIT</span>
              <span className="st-about-version">Version 1.0.0</span>
            </div>
            <div className="st-rows">
              <button
                className="st-row st-row-btn"
                onClick={() => window.open('mailto:support@FLOX.ai', '_blank')}
                type="button"
              >
                <span className="st-row-text"><strong>Help &amp; Support</strong></span>
                <span aria-hidden className="st-row-chevron">&rsaquo;</span>
              </button>
              <button
                className="st-row st-row-btn"
                onClick={() => toast.info('Privacy Policy is coming soon.')}
                type="button"
              >
                <span className="st-row-text"><strong>Privacy Policy</strong></span>
                <span aria-hidden className="st-row-chevron">&rsaquo;</span>
              </button>
              <button
                className="st-row st-row-btn"
                onClick={() => toast.info('Terms of Service are coming soon.')}
                type="button"
              >
                <span className="st-row-text"><strong>Terms of Service</strong></span>
                <span aria-hidden className="st-row-chevron">&rsaquo;</span>
              </button>
            </div>
            <p className="st-about-tagline">Made for better studying &#10022;</p>
          </>
        )
    }
  }

  const sectionDef = activeId ? SECTIONS[activeId] : null

  return (
    <PageShell
      className={`settings-page-shell st-page ${activeId ? 'st-in-section' : ''}`}
      subtitle="Tune how FLOX works for you."
      title="Settings"
    >
      {!activeId && (
        <div className="st-list">
          <div className="st-group">
            <span className="st-group-title">General</span>
            <div className="st-group-card">
              <button className="st-row st-row-btn" onClick={() => openSection(SECTIONS.notifications.id)} type="button">
                <span className="st-row-icon">{SECTIONS.notifications.icon}</span>
                <span className="st-row-text">
                  <strong>{SECTIONS.notifications.label}</strong>
                  <small>{SECTIONS.notifications.desc}</small>
                </span>
                <span aria-hidden className="st-row-chevron">&rsaquo;</span>
              </button>
              <div className="st-row">
                <span className="st-row-icon">{theme === 'dark' ? '\uD83C\uDF19' : '\u2600\uFE0F'}</span>
                <span className="st-row-text">
                  <strong>Dark Mode</strong>
                  <small>{theme === 'dark' ? 'On' : 'Off'}</small>
                </span>
                <Switch on={theme === 'dark'} onToggle={toggleDarkMode} />
              </div>
            </div>
          </div>

          {GROUPS.filter((g) => g.title !== 'General').map((group) => (
            <div className="st-group" key={group.title}>
              <span className="st-group-title">{group.title}</span>
              <div className="st-group-card">
                {group.items.map((itemId) => {
                  const def = SECTIONS[itemId]
                  return (
                    <button className="st-row st-row-btn" key={def.id} onClick={() => openSection(def.id)} type="button">
                      <span className="st-row-icon">{def.icon}</span>
                      <span className="st-row-text">
                        <strong>{def.label}</strong>
                        <small>{def.desc}</small>
                      </span>
                      <span aria-hidden className="st-row-chevron">&rsaquo;</span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}

          <div className="st-logout-wrap">
            <button className="st-logout" onClick={logout} type="button">Log Out</button>
          </div>
        </div>
      )}

      {activeId && sectionDef && (
        <div className="st-detail">
          <button className="st-back" onClick={backToList} type="button">
            <span aria-hidden>&larr;</span> Back
          </button>
          <header className="st-detail-head">
            <span className="st-detail-icon">{sectionDef.icon}</span>
            <div>
              <h2>{sectionDef.label}</h2>
              <p>{sectionDef.desc}</p>
            </div>
          </header>
          {renderSection(activeId)}
        </div>
      )}

      {editField && (
        <div className="pf-modal-overlay" onClick={() => setEditField(null)} role="presentation">
          <div className="pf-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <h3>Edit {editField === 'email' ? 'Email' : 'Username'}</h3>
            <label className="pf-field">
              <span>{editField === 'email' ? 'Email' : 'Username'}</span>
              <input
                autoFocus
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') saveEdit() }}
                placeholder={editField === 'email' ? 'you@example.com' : 'your_username'}
                type={editField === 'email' ? 'email' : 'text'}
                value={editValue}
              />
            </label>
            <div className="pf-modal-actions">
              <button className="ghost-action" onClick={() => setEditField(null)} type="button">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  )
}
