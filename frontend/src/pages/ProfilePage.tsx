import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, getErrorMessage } from '../lib/api'
import { clearAuthTokens } from '../lib/auth'
import PageShell from '../components/PageShell'

type ProfileData = {
  bio: string
  education_level: string
  college: string
  course: string
  semester: number
  study_goal: string
  daily_study_goal: number
  target_grade: string
  main_goal: string
  preferred_study_time: string
  session_length: number
  learning_style: string
  coaching_style: string
}

type UserProfile = {
  id: number
  username: string
  email: string
  full_name?: string
  profile?: ProfileData
}

type StreakStats = {
  current_streak: number
  longest_streak: number
  total_study_days: number
  studied_today: boolean
  next_milestone: { target: number; progress: number; remaining: number } | null
}

type DashboardData = StreakStats & {
  week_minutes: number
  completion_rate: number
  open_tasks: number
  total_completed_tasks: number
  total_focus_sessions: number
}

type ProductivityLog = {
  date: string
  minutes_studied: number
  completed_tasks: number
}

type FocusSession = {
  id: number
  subject_name: string | null
  duration_minutes: number
  completed: boolean
  date: string
}

type QuizSummary = { id: number; score: number | null }
type ExamSummary = { id: number }
type Subject = {
  id: number
  name: string
  color: string
  topics_completed: number
  total_topics: number
}

type ModalKind = 'profile' | 'goals' | 'learning' | null

type IdentityForm = {
  full_name: string
  username: string
  email: string
  education_level: string
  course: string
  semester: number
  college: string
  bio: string
}

type GoalsForm = {
  daily_study_goal: number
  target_grade: string
  main_goal: string
  study_goal: string
}

type LearningForm = {
  preferred_study_time: string
  session_length: number
  learning_style: string
  coaching_style: string
}

function formatHours(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const mins = Math.round(minutes % 60)
  if (!hours) return `${mins}m`
  return `${hours}h ${mins.toString().padStart(2, '0')}m`
}

function userInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length > 1) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

const STUDY_TIME_OPTIONS = [
  { value: 'morning', label: '\u2600\uFE0F Morning' },
  { value: 'afternoon', label: '\uD83C\uDF24\uFE0F Afternoon' },
  { value: 'evening', label: '\uD83C\uDF19 Evening' },
  { value: 'night', label: '\uD83C\uDF03 Night' },
]

const LEARNING_STYLE_OPTIONS = [
  { value: 'Reading + Practice', label: '\uD83D\uDCD6 Reading + Practice' },
  { value: 'Visual + Diagrams', label: '\uD83D\uDCCA Visual + Diagrams' },
  { value: 'Audio + Podcasts', label: '\uD83C\uDFA7 Audio + Podcasts' },
  { value: 'Flashcards + Recall', label: '\u{1F0CF} Flashcards + Recall' },
]

const COACHING_OPTIONS = [
  { value: 'gentle', label: 'Gentle' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'intense', label: 'Intense' },
]

const GRADE_OPTIONS = ['A+', 'A', 'B+', 'B', 'C+', 'C']

const SUBJECT_EMOJI = ['\uD83D\uDCD8', '\uD83D\uDCF0', '\uD83D\uDEE1\uFE0F', '\uD83D\uDCBB', '\uD83D\uDD2C', '\uD83D\uDCDA']

export default function ProfilePage() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [dashData, setDashData] = useState<DashboardData | null>(null)
  const [logs, setLogs] = useState<ProductivityLog[]>([])
  const [sessions, setSessions] = useState<FocusSession[]>([])
  const [quizzesDone, setQuizzesDone] = useState(0)
  const [examCount, setExamCount] = useState(0)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<ModalKind>(null)
  const [saving] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)

  const [identityForm, setIdentityForm] = useState<IdentityForm>({
    full_name: '', username: '', email: '', education_level: 'college', course: '', semester: 1, college: '', bio: '',
  })
  const [goalsForm, setGoalsForm] = useState<GoalsForm>({
    daily_study_goal: 4, target_grade: '', main_goal: '', study_goal: '',
  })
  const [learningForm, setLearningForm] = useState<LearningForm>({
    preferred_study_time: 'evening', session_length: 50, learning_style: '', coaching_style: 'balanced',
  })

  function fillIdentity(data: UserProfile) {
    setIdentityForm({
      full_name: data.full_name || '',
      username: data.username,
      email: data.email,
      education_level: data.profile?.education_level || 'college',
      course: data.profile?.course ?? '',
      semester: data.profile?.semester ?? 1,
      college: data.profile?.college ?? '',
      bio: data.profile?.bio ?? '',
    })
  }

  async function saveIdentity() {
    setSavingProfile(true)
    try {
      const payload: Record<string, unknown> = {
        full_name: identityForm.full_name,
        username: identityForm.username,
        email: identityForm.email,
        education_level: identityForm.education_level,
        course: identityForm.course,
        semester: identityForm.semester,
        college: identityForm.college,
        bio: identityForm.bio,
      }
      const { data } = await api.patch<UserProfile>('/auth/me/', payload)
      setProfile(data)
      setModal(null)
    } catch {
      // keep the modal open so the user can retry
    } finally {
      setSavingProfile(false)
    }
  }

  function fillGoals(data: UserProfile) {
    setGoalsForm({
      daily_study_goal: data.profile?.daily_study_goal ?? 4,
      target_grade: data.profile?.target_grade ?? '',
      main_goal: data.profile?.main_goal ?? '',
      study_goal: data.profile?.study_goal ?? '',
    })
  }

  function fillLearning(data: UserProfile) {
    setLearningForm({
      preferred_study_time: data.profile?.preferred_study_time ?? 'evening',
      session_length: data.profile?.session_length ?? 50,
      learning_style: data.profile?.learning_style ?? '',
      coaching_style: data.profile?.coaching_style ?? 'balanced',
    })
  }

  useEffect(() => {
    let active = true

    async function load() {
      try {
        const results = await Promise.all([
          api.get<UserProfile>('/auth/me/'),
          api.get<DashboardData>('/study/dashboard/').catch(() => ({ data: null })),
          api.get<ProductivityLog[]>('/productivity/logs/').catch(() => ({ data: [] })),
          api.get<FocusSession[]>('/productivity/focus-sessions/').catch(() => ({ data: [] })),
          api.get<QuizSummary[]>('/quiz/history/').catch(() => ({ data: [] })),
          api.get<ExamSummary[]>('/study/exams/').catch(() => ({ data: [] })),
          api.get<Subject[]>('/study/subjects/').catch(() => ({ data: [] })),
        ])
        if (!active) return

        const meRes = results[0]

        setProfile(meRes.data)
        setDashData(results[1].data)
        setLogs(results[2].data)
        setSessions(results[3].data)
        setSubjects(results[6].data)
        setExamCount(results[5].data.length)
        setQuizzesDone(results[4].data.filter((q) => q.score !== null).length)
        fillIdentity(meRes.data)
        fillGoals(meRes.data)
        fillLearning(meRes.data)
      } catch (err) {
        if (active) setError(getErrorMessage(err))
      } finally {
        if (active) setLoading(false)
      }
    }

    void load()
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!modal) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setModal(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [modal])

  function logout() {
    clearAuthTokens()
    navigate('/login')
  }

  const displayName = useMemo(
    () => profile?.full_name?.trim() || profile?.username || 'Scholar',
    [profile],
  )
  const avatar = userInitials(displayName)
  const prof = profile?.profile
  const handle = profile?.email ? profile.email : ''

  // ── Lifetime + recent totals (computed from productivity logs) ──
  const totals = useMemo(() => {
    const allMinutes = logs.reduce((sum, l) => sum + l.minutes_studied, 0)
    const allTasksFromLogs = logs.reduce((sum, l) => sum + l.completed_tasks, 0)
    const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - 6)
    const monthStart = new Date(); monthStart.setDate(monthStart.getDate() - 29)
    const weekIso = toIso(weekStart)
    const monthIso = toIso(monthStart)

    let weekMinutes = 0
    let weekTasks = 0
    let monthMinutes = 0
    let monthTasks = 0
    for (const log of logs) {
      if (log.date >= weekIso) {
        weekMinutes += log.minutes_studied
        weekTasks += log.completed_tasks
      }
      if (log.date >= monthIso) {
        monthMinutes += log.minutes_studied
        monthTasks += log.completed_tasks
      }
    }

    const weekSessions = sessions.filter((s) => s.date >= weekIso).length
    const monthSessions = sessions.filter((s) => s.date >= monthIso).length

    return {
      weekMinutes,
      weekTasks,
      weekSessions,
      monthMinutes,
      monthTasks,
      monthSessions,
      allMinutes,
      allTasks: Math.max(dashData?.total_completed_tasks ?? 0, allTasksFromLogs),
      allSessions: Math.max(dashData?.total_focus_sessions ?? 0, sessions.length),
    }
  }, [logs, sessions, dashData])

  const favoriteSubjects = useMemo(() => {
    const minutesByName = new Map<string, number>()
    for (const s of sessions) {
      if (!s.completed || !s.subject_name) continue
      minutesByName.set(s.subject_name, (minutesByName.get(s.subject_name) ?? 0) + s.duration_minutes)
    }
    return subjects
      .map((s, index) => ({
        ...s,
        emoji: SUBJECT_EMOJI[index % SUBJECT_EMOJI.length],
        percent: s.total_topics ? Math.round((s.topics_completed / s.total_topics) * 100) : 0,
        minutes: minutesByName.get(s.name) ?? 0,
      }))
      .sort((a, b) => b.minutes - a.minutes || b.percent - a.percent)
      .slice(0, 4)
  }, [subjects, sessions])

  const maxSubjectMinutes = Math.max(1, ...favoriteSubjects.map((s) => s.minutes))

  const achievements = useMemo(() => {
    const lifetimeHours = totals.allMinutes / 60
    return [
      { icon: '\uD83D\uDD25', title: '7 Day Streak', unlocked: (dashData?.current_streak ?? 0) >= 7, hint: 'Study 7 days in a row' },
      { icon: '\uD83C\uDFAF', title: '10 Hour Study', unlocked: lifetimeHours >= 10, hint: 'Study for 10 total hours' },
      { icon: '\uD83C\uDFC6', title: 'First Exam', unlocked: examCount >= 1, hint: 'Add your first exam' },
      { icon: '\u26A1', title: '10 Quizzes', unlocked: quizzesDone >= 10, hint: 'Finish 10 quizzes' },
      { icon: '\uD83D\uDD25', title: '30 Day Streak', unlocked: (dashData?.current_streak ?? 0) >= 30, hint: 'Study 30 days in a row' },
      { icon: '\u23F1\uFE0F', title: '100 Hours', unlocked: lifetimeHours >= 100, hint: 'Study for 100 total hours' },
      { icon: '\u2705', title: '100 Tasks', unlocked: totals.allTasks >= 100, hint: 'Complete 100 tasks' },
    ]
  }, [dashData, examCount, quizzesDone, totals])

  const streak = dashData?.current_streak ?? 0
  const longestStreak = dashData?.longest_streak ?? 0
  const milestoneTarget = dashData?.next_milestone?.target ?? streak
  const milestoneProgress = dashData?.next_milestone?.progress ?? 100

  const subtitle = 'Your learning journey and achievements.'

  const studyTimeLabel = formatHours(totals.allMinutes)

  return (
    <PageShell
      className="pf-page"
      title="Profile"
      subtitle={subtitle}
    >
      {error && <div className="dc-alert">{error}</div>}

      {loading ? (
        <div className="dashboard-loading">Loading profile...</div>
      ) : (
        <>
          {/* 1. Profile Header */}
          <section className="pf-card pf-header">
            <div className="pf-avatar">
              <span>{avatar}</span>
            </div>
            <div className="pf-header-info">
              <h2>{displayName}</h2>
              {handle && <span className="pf-handle">{handle}</span>}
              {prof?.education_level === 'high_school'
                ? (
                  <>
                    {(prof?.course || prof?.college) && (
                      <span className="pf-course">
                        {[prof?.course, prof?.college].filter(Boolean).join(' \u00B7 ')}
                      </span>
                    )}
                  </>
                )
                : (
                  <>
                    {(prof?.course || prof?.semester) && (
                      <span className="pf-course">
                        {[prof?.course, prof?.semester ? `Semester ${prof.semester}` : '', prof?.college].filter(Boolean).join(' \u00B7 ')}
                      </span>
                    )}
                  </>
                )}
              {prof?.bio && <p className="pf-bio">{prof.bio}</p>}
              <button className="ghost-action pf-header-edit" onClick={() => setModal('profile')} type="button">
                Edit Profile
              </button>
            </div>
          </section>

          {/* 2. Quick Statistics */}
          <section className="pf-stats-row">
            <article className="pf-stat-card pf-stat-flame">
              <span className="pf-stat-icon">{'\uD83D\uDD25'}</span>
              <strong>{streak} day{streak === 1 ? '' : 's'}</strong>
              <span className="pf-stat-label">Current Streak</span>
            </article>
            <article className="pf-stat-card pf-stat-time">
              <span className="pf-stat-icon">{'\u23F1\uFE0F'}</span>
              <strong>{studyTimeLabel.split(' ')[0]}</strong>
              <span className="pf-stat-label">Study Time</span>
            </article>
            <article className="pf-stat-card pf-stat-tasks">
              <span className="pf-stat-icon">{'\u2713'}</span>
              <strong>{totals.allTasks}</strong>
              <span className="pf-stat-label">Tasks Completed</span>
            </article>
            <article className="pf-stat-card pf-stat-sessions">
              <span className="pf-stat-icon">{'\uD83C\uDFAF'}</span>
              <strong>{totals.allSessions}</strong>
              <span className="pf-stat-label">Focus Sessions</span>
            </article>
          </section>

          {/* 3. Study Goals + Signature Streak Card */}
          <div className="pf-duo">
            <section className="pf-card">
              <dl className="pf-goal-list">
                <div className="pf-goal-row">
                  <dt>Daily Study Goal</dt>
                  <dd>{prof?.daily_study_goal ?? 4} hours</dd>
                </div>
                <div className="pf-goal-row">
                  <dt>Target Grade</dt>
                  <dd>{prof?.target_grade || 'Not set'}</dd>
                </div>
                <div className="pf-goal-row">
                  <dt>Main Focus</dt>
                  <dd>{prof?.main_goal || prof?.course || 'Not set'}</dd>
                </div>
                {prof?.study_goal && (
                  <div className="pf-goal-row">
                    <dt>Exam Goal</dt>
                    <dd>{prof.study_goal}</dd>
                  </div>
                )}
              </dl>
              <button className="ghost-action pf-card-action" onClick={() => setModal('goals')} type="button">
                Edit Goals
              </button>
            </section>

            <section className="pf-card pf-streak-card">
              <header className="pf-card-head">
                <span className="pf-streak-emoji">{'\uD83D\uDFE0'}</span>
              </header>
              <div className="pf-streak-number">{streak} days</div>
              <div className="pf-streak-block">
                <span className="pf-streak-caption">LONGEST STREAK</span>
                <strong>{longestStreak} days</strong>
              </div>
              <div className="pf-streak-block">
                <span className="pf-streak-caption">NEXT MILESTONE</span>
                <strong>{milestoneTarget} days</strong>
              </div>
              <div className="pf-streak-track" role="img" aria-label={`Streak progress ${streak} of ${milestoneTarget} days`}>
                <div className="pf-streak-fill" style={{ width: `${Math.min(Math.max(milestoneProgress, 3), 100)}%` }} />
                <span className="pf-streak-dot-start">{'\uD83D\uDFE0'}</span>
                <span className="pf-streak-dot-end">{'\uD83D\uDFE2'}</span>
              </div>
              <div className="pf-streak-progress-text">{streak} / {milestoneTarget} days</div>
            </section>
          </div>

          {/* 4. Achievements */}
          <section className="pf-card">
            <div className="pf-achievements-grid">
              {achievements.map((a) => (
                <div className={`pf-achievement ${a.unlocked ? 'unlocked' : ''}`} key={a.title} title={a.hint}>
                  <span className="pf-achievement-icon">{a.unlocked ? a.icon : '\uD83D\uDD12'}</span>
                  <strong>{a.title}</strong>
                  <span className="pf-achievement-status">{a.unlocked ? 'Unlocked \u2713' : a.hint}</span>
                </div>
              ))}
            </div>
          </section>

          {/* 5. Study Overview */}
          <section className="pf-card">
            <table className="pf-overview-table">
              <thead>
                <tr>
                  <th scope="col" className="pf-sr-only">Metric</th>
                  <th scope="col">This Week</th>
                  <th scope="col">This Month</th>
                  <th scope="col">All Time</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">Study Time</th>
                  <td>{formatHours(totals.weekMinutes)}</td>
                  <td>{formatHours(totals.monthMinutes)}</td>
                  <td>{formatHours(totals.allMinutes)}</td>
                </tr>
                <tr>
                  <th scope="row">Tasks Done</th>
                  <td>{totals.weekTasks}</td>
                  <td>{totals.monthTasks}</td>
                  <td>{totals.allTasks}</td>
                </tr>
                <tr>
                  <th scope="row">Focus Sessions</th>
                  <td>{totals.weekSessions}</td>
                  <td>{totals.monthSessions}</td>
                  <td>{totals.allSessions}</td>
                </tr>
              </tbody>
            </table>
            <div className="pf-overview-stripes">
              <div className="pf-overview-pair">
                <span>Current Streak</span>
                <strong>{'\uD83D\uDD25'} {streak} days</strong>
              </div>
              <div className="pf-overview-pair">
                <span>Longest Streak</span>
                <strong>{longestStreak} days</strong>
              </div>
            </div>
          </section>

          {/* 6. Favorite Subjects + Learning Profile */}
          <div className="pf-duo">
            <section className="pf-card">
              {favoriteSubjects.length ? (
                <ul className="pf-subject-list">
                  {favoriteSubjects.map((s) => (
                    <li key={s.id}>
                      <span className="pf-subject-name">
                        <i>{s.emoji}</i> {s.name}
                      </span>
                      <span className="pf-subject-bar-track">
                        <span
                          className="pf-subject-bar-fill"
                          style={{ width: `${Math.max((s.minutes / maxSubjectMinutes) * 100, 8)}%`, background: s.color || 'var(--cyan)' }}
                        />
                      </span>
                      <span className="pf-subject-minutes">{formatHours(s.minutes)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="pf-empty-note">Add subjects and finish focus sessions to see them here.</p>
              )}
            </section>

            <section className="pf-card">
              <dl className="pf-goal-list">
                <div className="pf-goal-row">
                  <dt>Preferred Study Time</dt>
                  <dd>{STUDY_TIME_OPTIONS.find((o) => o.value === prof?.preferred_study_time)?.label ?? 'Not set'}</dd>
                </div>
                <div className="pf-goal-row">
                  <dt>Preferred Session</dt>
                  <dd>{'\u23F1\uFE0F'} {prof?.session_length ?? 50} minutes</dd>
                </div>
                <div className="pf-goal-row">
                  <dt>Learning Style</dt>
                  <dd>{LEARNING_STYLE_OPTIONS.find((o) => o.value === prof?.learning_style)?.label ?? (prof?.learning_style || 'Not set')}</dd>
                </div>
                <div className="pf-goal-row">
                  <dt>AI Coaching</dt>
                  <dd>{COACHING_OPTIONS.find((o) => o.value === prof?.coaching_style)?.label ?? 'Balanced'}</dd>
                </div>
              </dl>
              <button className="ghost-action pf-card-action" onClick={() => setModal('learning')} type="button">
                Edit Learning Style
              </button>
            </section>
          </div>

          {/* 7. Logout */}
          <section className="pf-card pf-logout-card">
            <div className="pf-logout-copy">
              <strong>Logout</strong>
              <span>Sign out of Flow AI on this device.</span>
            </div>
            <button className="danger-button" onClick={logout} type="button">Logout</button>
          </section>
        </>
      )}

      {modal === 'profile' && (
        <div className="pf-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setModal(null) }}>
          <div className="pf-modal" role="dialog" aria-modal="true" aria-label="Edit profile">
            <header className="pf-modal-head">
              <h2>Edit Profile</h2>
              <button className="pf-modal-close" onClick={() => setModal(null)} type="button" aria-label="Close">&times;</button>
            </header>

            <div className="pf-modal-avatar">
              <span>{avatar}</span>
            </div>

            <label className="pf-field">
              Full Name
              <input
                onChange={(e) => setIdentityForm((c) => ({ ...c, full_name: e.target.value }))}
                placeholder="Muhammed Nihal"
                value={identityForm.full_name}
              />
            </label>
            <div className="pf-field-row">
              <label className="pf-field">
                Username
                <input
                  onChange={(e) => setIdentityForm((c) => ({ ...c, username: e.target.value }))}
                  placeholder="muhdnihalcp"
                  value={identityForm.username}
                />
              </label>
              <label className="pf-field">
                Email
                <input
                  onChange={(e) => setIdentityForm((c) => ({ ...c, email: e.target.value }))}
                  type="email"
                  value={identityForm.email}
                />
              </label>
            </div>
            <label className="pf-field">
              I&apos;m a...
              <div
                className="pf-level-toggle"
                onChange={(e) => {
                  const val = (e.target as HTMLInputElement).value
                  setIdentityForm((c) => ({ ...c, education_level: val }))
                }}
              >
                <label>
                  <input type="radio" name="education_level" value="college" checked={identityForm.education_level !== 'high_school'} />
                  <span>{'\uD83C\uDF93'} College / University</span>
                </label>
                <label>
                  <input type="radio" name="education_level" value="high_school" checked={identityForm.education_level === 'high_school'} />
                  <span>{'\uD83C\uDFEB'} High School</span>
                </label>
              </div>
            </label>

            {identityForm.education_level === 'high_school' ? (
              <div className="pf-field-row">
                <label className="pf-field">
                  Grade / Class
                  <input
                    onChange={(e) => setIdentityForm((c) => ({ ...c, course: e.target.value }))}
                    placeholder="Grade 10"
                    value={identityForm.course}
                  />
                </label>
                <label className="pf-field">
                  School
                  <input
                    onChange={(e) => setIdentityForm((c) => ({ ...c, college: e.target.value }))}
                    placeholder="Your School"
                    value={identityForm.college}
                  />
                </label>
              </div>
            ) : (
              <>
                <label className="pf-field">
                  Course
                  <input
                    onChange={(e) => setIdentityForm((c) => ({ ...c, course: e.target.value }))}
                    placeholder="B.Sc Computer Science"
                    value={identityForm.course}
                  />
                </label>
                <div className="pf-field-row">
                  <label className="pf-field">
                    Semester
                    <select
                      onChange={(e) => setIdentityForm((c) => ({ ...c, semester: Number(e.target.value) }))}
                      value={identityForm.semester}
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                        <option key={n} value={n}>Semester {n}</option>
                      ))}
                    </select>
                  </label>
                  <label className="pf-field">
                    College
                    <input
                      onChange={(e) => setIdentityForm((c) => ({ ...c, college: e.target.value }))}
                      placeholder="Your College"
                      value={identityForm.college}
                    />
                  </label>
                </div>
              </>
            )}
            <label className="pf-field">
              Bio
              <textarea
                onChange={(e) => setIdentityForm((c) => ({ ...c, bio: e.target.value }))}
                placeholder="Building better study habits."
                rows={3}
                value={identityForm.bio}
              />
            </label>

            <footer className="pf-modal-actions">
              <button className="ghost-action" disabled={savingProfile} onClick={() => setModal(null)} type="button">Cancel</button>
              <button className="au-submit pf-modal-save" disabled={savingProfile} onClick={() => void saveIdentity()} type="button">
                {savingProfile ? 'Saving...' : 'Save Changes'}
              </button>
            </footer>
          </div>
        </div>
      )}

      {modal === 'goals' && (
        <div className="pf-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setModal(null) }}>
          <div className="pf-modal" role="dialog" aria-modal="true" aria-label="Edit goals">
            <header className="pf-modal-head">
              <h2>Edit Study Goals</h2>
              <button className="pf-modal-close" onClick={() => setModal(null)} type="button" aria-label="Close">&times;</button>
            </header>

            <label className="pf-field">
              Daily Study Goal
              <select
                onChange={(e) => setGoalsForm((c) => ({ ...c, daily_study_goal: Number(e.target.value) }))}
                value={goalsForm.daily_study_goal}
              >
                {[1, 1.5, 2, 2.5, 3, 4, 5, 6, 7, 8].map((h) => (
                  <option key={h} value={h}>{h} hours</option>
                ))}
              </select>
            </label>
            <label className="pf-field">
              Target Grade
              <select
                onChange={(e) => setGoalsForm((c) => ({ ...c, target_grade: e.target.value }))}
                value={goalsForm.target_grade}
              >
                <option value="">Not set</option>
                {GRADE_OPTIONS.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </label>
            <label className="pf-field">
              Main Focus
              <input
                onChange={(e) => setGoalsForm((c) => ({ ...c, main_goal: e.target.value }))}
                placeholder="Computer Science"
                value={goalsForm.main_goal}
              />
            </label>
            <label className="pf-field">
              Exam Goal
              <input
                onChange={(e) => setGoalsForm((c) => ({ ...c, study_goal: e.target.value }))}
                placeholder="Be ready 7 days before exam"
                value={goalsForm.study_goal}
              />
            </label>

            <footer className="pf-modal-actions">
              <button className="ghost-action" disabled={saving} onClick={() => setModal(null)} type="button">Cancel</button>
            </footer>
          </div>
        </div>
      )}

      {modal === 'learning' && (
        <div className="pf-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setModal(null) }}>
          <div className="pf-modal" role="dialog" aria-modal="true" aria-label="Edit learning profile">
            <header className="pf-modal-head">
              <h2>Edit Learning Profile</h2>
              <button className="pf-modal-close" onClick={() => setModal(null)} type="button" aria-label="Close">&times;</button>
            </header>

            <label className="pf-field">
              Preferred Study Time
              <select
                onChange={(e) => setLearningForm((c) => ({ ...c, preferred_study_time: e.target.value }))}
                value={learningForm.preferred_study_time}
              >
                {STUDY_TIME_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
            <label className="pf-field">
              Preferred Session Length
              <select
                onChange={(e) => setLearningForm((c) => ({ ...c, session_length: Number(e.target.value) }))}
                value={learningForm.session_length}
              >
                {[25, 30, 45, 50, 60, 90].map((m) => (
                  <option key={m} value={m}>{m} minutes</option>
                ))}
              </select>
            </label>
            <label className="pf-field">
              Learning Style
              <select
                onChange={(e) => setLearningForm((c) => ({ ...c, learning_style: e.target.value }))}
                value={learningForm.learning_style}
              >
                <option value="">Not set</option>
                {LEARNING_STYLE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
            <label className="pf-field">
              AI Coaching Intensity
              <select
                onChange={(e) => setLearningForm((c) => ({ ...c, coaching_style: e.target.value }))}
                value={learningForm.coaching_style}
              >
                {COACHING_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>

            <footer className="pf-modal-actions">
              <button className="ghost-action" disabled={saving} onClick={() => setModal(null)} type="button">Cancel</button>
            </footer>
          </div>
        </div>
      )}
    </PageShell>
  )
}

function toIso(d: Date) {
  const y = d.getFullYear()
  const m = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${y}-${m}-${day}`
}
