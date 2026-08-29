import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import PageShell from '../components/PageShell'
import { api, getErrorMessage } from '../lib/api'
import { notifyStudyActivity } from '../lib/studyActivity'

/* ── API shapes ────────────────────────────────────────────── */

type ApiSubject = { id: number; name: string; weak_topics: string; weekly_goal_hours: number }
type ApiExam = {
  id: number
  subject: number | null
  subject_name?: string
  title: string
  date: string
  priority: string
  preparation_pct?: number
  days_left?: number
}
type ApiTask = {
  id: number
  subject: number | null
  subject_name?: string
  title: string
  due_date: string | null
  scheduled_for: string | null
  duration_minutes: number
  priority: string
  status: 'todo' | 'doing' | 'done'
}
type StreakMilestone = { target: number; progress: number; remaining: number }
type FocusSession = { id: number; subject_name?: string; topic?: string; duration_minutes: number; started_at: string }
type DashboardSummary = {
  current_streak: number
  longest_streak: number
  studied_today: boolean
  next_milestone: StreakMilestone | null
  week_minutes: number
  prev_week_minutes?: number
  open_tasks: number
  upcoming_exams: ApiExam[]
  recent_logs: Array<{ date: string; minutes_studied: number }>
  today_tasks?: Array<{ id: number; title: string; subject: string | null; status: string }>
  subjects_summary?: Array<{ name: string; color: string; topics_completed: number; total_topics: number; weekly_goal_hours: number }>
  today_minutes?: number
}

/* ── Helpers ───────────────────────────────────────────────── */

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return { word: 'morning', emoji: '\uD83C\uDF05' }
  if (h < 17) return { word: 'afternoon', emoji: '\u2600\uFE0F' }
  return { word: 'evening', emoji: '\uD83C\uDF19' }
}

function todayInput() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function longDate() {
  return new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())
}

function formatMinutes(m: number) {
  const h = Math.floor(m / 60)
  const min = m % 60
  return h ? `${h}h ${min}m` : `${min}m`
}

function timeAgo(dateStr: string) {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`
  return `${Math.floor(hrs / 24)} day(s) ago`
}

function formatTime(iso: string) {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(iso))
}

function lastSevenDays() {
  const days: Array<{ date: string; dow: number }> = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    days.push({ date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`, dow: d.getDay() })
  }
  return days
}

/* ── Page ──────────────────────────────────────────────────── */

export default function DashboardPage() {
  const navigate = useNavigate()
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null)
  const [subjects, setSubjects] = useState<ApiSubject[]>([])
  const [tasks, setTasks] = useState<ApiTask[]>([])
  const [sessions, setSessions] = useState<FocusSession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingTaskId, setSavingTaskId] = useState<number | null>(null)
  const [firstName, setFirstName] = useState('Scholar')
  const [newTaskTitle, setNewTaskTitle] = useState('')

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const [profileRes, dashRes, subjRes, taskRes, sessRes] = await Promise.all([
          api.get<{ username: string }>('/auth/me/'),
          api.get<DashboardSummary>('/study/dashboard/'),
          api.get<ApiSubject[]>('/study/subjects/'),
          api.get<ApiTask[]>('/study/tasks/'),
          api.get<FocusSession[]>('/productivity/focus-sessions/').catch(() => ({ data: [] as FocusSession[] })),
        ])
        if (!active) return
        setFirstName(profileRes.data.username.split(/\s+/)[0] || 'Scholar')
        setDashboard(dashRes.data)
        setSubjects(subjRes.data)
        setTasks(taskRes.data)
        setSessions(sessRes.data)
        setError(null)
      } catch (err) {
        if (active) setError(getErrorMessage(err))
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [])

  /* Derived data */

  const streak = dashboard?.current_streak ?? 0
  const subjectsSummary = useMemo(() => dashboard?.subjects_summary ?? [], [dashboard])
  const recentLogs = useMemo(() => dashboard?.recent_logs ?? [], [dashboard])
  const todayMinutes = dashboard?.today_minutes ?? 0

  const scheduleItems = useMemo(
    () =>
      tasks
        .filter((t) => t.scheduled_for && t.scheduled_for.slice(0, 10) <= todayInput())
        .sort((a, b) => (a.scheduled_for ?? '').localeCompare(b.scheduled_for ?? '')),
    [tasks],
  )

  const todayTasks = useMemo(() => {
    const ids = new Set(scheduleItems.map((t) => t.id))
    const extra = (dashboard?.today_tasks ?? [])
      .map((t) => tasks.find((x) => x.id === t.id))
      .filter((t): t is ApiTask => Boolean(t) && !ids.has(t!.id))
    return [...scheduleItems, ...extra].slice(0, 8)
  }, [scheduleItems, dashboard, tasks])

  const goalSessionsTotal = todayTasks.length
  const goalSessionsDone = todayTasks.filter((t) => t.status === 'done').length

  const dailyGoalMinutes = useMemo(() => {
    if (subjectsSummary.length) {
      const avg = subjectsSummary.reduce((s, sub) => s + (sub.weekly_goal_hours || 0), 0) / subjectsSummary.length
      return Math.max(Math.round((avg * 60) / 7), 240)
    }
    return 240
  }, [subjectsSummary])

  const mainGoalPct = useMemo(() => {
    if (goalSessionsTotal > 0) return Math.round((goalSessionsDone / goalSessionsTotal) * 100)
    return Math.min(100, Math.round((todayMinutes / dailyGoalMinutes) * 100))
  }, [goalSessionsTotal, goalSessionsDone, todayMinutes, dailyGoalMinutes])

  const nearestExam = useMemo(() => {
    const upcoming = (dashboard?.upcoming_exams ?? []).filter((e) => e.date >= todayInput())
    upcoming.sort((a, b) => a.date.localeCompare(b.date))
    return upcoming[0] ?? null
  }, [dashboard])

  const lastSession = sessions.length ? sessions[0] : null
  const continueSubjectPct = useMemo(() => {
    if (!lastSession?.subject_name) return null
    const match = subjectsSummary.find((s) => s.name === lastSession.subject_name)
    if (!match || !match.total_topics) return null
    return Math.round((match.topics_completed / match.total_topics) * 100)
  }, [lastSession, subjectsSummary])

  const aiInsight = useMemo(() => {
    const hasData = subjects.length > 0 || Boolean(nearestExam)
    const weak = subjects.filter((s) => s.weak_topics)
    let text = 'Start a focus session to build momentum.'
    let detail = 'Even 25 focused minutes makes a difference.'
    let minutes = 25
    if (nearestExam && weak.length) {
      text = `I recommend studying ${weak[0].name} next.`
      detail = `Your exam "${nearestExam.title}" is in ${nearestExam.days_left ?? 0} days and ${weak[0].weak_topics.split(',')[0].trim()} is currently your weakest topic.`
      minutes = 50
    } else if (weak.length) {
      text = `I recommend studying ${weak[0].name} next.`
      detail = `Focus on: ${weak[0].weak_topics.split(',').slice(0, 2).join(', ').trim()}.`
      minutes = 45
    } else if (nearestExam) {
      text = `Keep preparing for ${nearestExam.title}.`
      detail = `You have ${nearestExam.days_left ?? 0} days left. Stay consistent.`
      minutes = 50
    }
    return { hasData, text, detail, minutes }
  }, [subjects, nearestExam])

  const weekBars = useMemo(() => {
    const logMap = new Map(recentLogs.map((l) => [l.date, l.minutes_studied]))
    const days = lastSevenDays()
    const maxMin = Math.max(...days.map((d) => logMap.get(d.date) ?? 0), 60)
    return days.map((d) => {
      const mins = logMap.get(d.date) ?? 0
      return { key: d.date, label: DAY_LETTERS[d.dow], minutes: mins, pct: Math.max(4, Math.round((mins / maxMin) * 100)) }
    })
  }, [recentLogs])

  const weekDelta = useMemo(() => {
    const cur = dashboard?.week_minutes ?? 0
    const prev = dashboard?.prev_week_minutes ?? 0
    if (!prev) return null
    return Math.round(((cur - prev) / prev) * 100)
  }, [dashboard])

  const taskList = useMemo(() => {
    const open = tasks.filter((t) => t.status !== 'done')
    const source = open.length ? open : tasks
    return [...source]
      .sort((a, b) => {
        const da = a.scheduled_for ?? a.due_date ?? '9999-12-31'
        const dbb = b.scheduled_for ?? b.due_date ?? '9999-12-31'
        return da.localeCompare(dbb)
      })
      .slice(0, 5)
  }, [tasks])

  const toggleTask = useCallback(async (task: ApiTask) => {
    const next = task.status === 'done' ? 'todo' : 'done'
    setSavingTaskId(task.id)
    setTasks((c) => c.map((t) => (t.id === task.id ? { ...t, status: next } : t)))
    try {
      await api.patch(`/study/tasks/${task.id}/`, { status: next })
      if (next === 'done') notifyStudyActivity()
      const { data } = await api.get<DashboardSummary>('/study/dashboard/')
      setDashboard(data)
    } catch (err) {
      setTasks((c) => c.map((t) => (t.id === task.id ? task : t)))
      setError(getErrorMessage(err))
    } finally {
      setSavingTaskId(null)
    }
  }, [])

  const addTask = useCallback(async () => {
    const title = newTaskTitle.trim()
    if (!title) return
    setNewTaskTitle('')
    try {
      const { data: created } = await api.post<ApiTask>('/study/tasks/', { title, status: 'todo', priority: 'medium' })
      notifyStudyActivity()
      setTasks((c) => [...c, created])
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }, [newTaskTitle])

  const hello = greeting()

  return (
    <PageShell
      className="db-page"
      title={`Good ${hello.word}, ${firstName} ${hello.emoji}`}
      subtitle={longDate()}
      badge={
        <span className="db-streak-pill">
          {'\uD83D\uDD25'} {streak} day streak
        </span>
      }
    >
      {error ? <div className="db-alert">{error}</div> : null}
      {loading ? <div className="db-loading">Loading your dashboard...</div> : null}

      <div className="db-grid">
        {/* 1 - Today's Main Goal */}
        <section className="db-card db-goal">
          <span className="db-eyebrow">{'\uD83C\uDFAF'} Today's Main Goal</span>
          <h2 className="db-goal-title">
            {todayTasks.length ? `${todayTasks[0].subject_name ?? todayTasks[0].title} \u2014 ${todayTasks[0].subject_name ? todayTasks[0].title : 'Review and practice'}` : 'Plan your day to unlock a goal'}
          </h2>
          <div className="db-progress-row">
            <div className="db-progress-track">
              <div className="db-progress-fill" style={{ width: `${mainGoalPct}%` }} />
            </div>
            <span className="db-progress-pct">{mainGoalPct}%</span>
          </div>
          <div className="db-goal-meta">
            <span>{goalSessionsDone} of {goalSessionsTotal || dailyGoalMinutes / 60} sessions completed</span>
            <span className="db-goal-remaining">{'\u23F3'} {formatMinutes(Math.max(0, dailyGoalMinutes - todayMinutes))} remaining today</span>
          </div>
        </section>

        {/* 2 - Next Exam */}
        <section className="db-card db-exam">
          {nearestExam ? (
            <>
              <span className="db-eyebrow">{'\uD83C\uDF93'} Next Exam</span>
              <h3 className="db-exam-name">{nearestExam.subject_name ?? nearestExam.title}</h3>
              <strong className="db-exam-days">{nearestExam.days_left ?? 0} DAYS LEFT</strong>
              <span className="db-mini-label">Preparation</span>
              <div className="db-progress-row">
                <div className="db-progress-track">
                  <div className="db-progress-fill db-fill-exam" style={{ width: `${nearestExam.preparation_pct ?? 0}%` }} />
                </div>
                <span className="db-progress-pct">{nearestExam.preparation_pct ?? 0}%</span>
              </div>
              <Link className="ghost-action db-btn db-btn-sm" to="/exams">View Exam</Link>
            </>
          ) : (
            <>
              <span className="db-eyebrow">{'\uD83C\uDF93'} No Upcoming Exams</span>
              <p className="db-exam-clear">You're all clear!</p>
              <p className="db-exam-clear-sub">Add an exam and I'll pace your preparation.</p>
              <Link className="ghost-action db-btn db-btn-sm" to="/exams">Add Exam</Link>
            </>
          )}
        </section>

        {/* 3 - Continue Studying */}
        <section className="db-card db-continue">
          {lastSession ? (
            <div className="db-continue-inner">
              <div className="db-continue-info">
                <span className="db-eyebrow">{'\u23F1\uFE0F'} Continue Studying</span>
                <h3>{lastSession.subject_name ?? 'Study Session'}{lastSession.topic ? ` \u2014 ${lastSession.topic}` : ''}</h3>
                <span className="db-continue-meta">Last session: {timeAgo(lastSession.started_at)}</span>
                {continueSubjectPct !== null && (
                  <div className="db-progress-row db-progress-slim">
                    <div className="db-progress-track">
                      <div className="db-progress-fill db-fill-cyan" style={{ width: `${continueSubjectPct}%` }} />
                    </div>
                    <span className="db-progress-pct">{continueSubjectPct}%</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="db-continue-inner">
              <div className="db-continue-info">
                <span className="db-eyebrow">{'\u23F1\uFE0F'} Start Your First Session</span>
                <h3>Choose something to study today.</h3>
                <span className="db-continue-meta">Your completed sessions will appear here.</span>
              </div>
            </div>
          )}
        </section>

        {/* 4 - Today's Schedule */}
        <section className="db-card db-schedule">
          <span className="db-eyebrow">{'\uD83D\uDCC5'} Today's Schedule</span>
          <div className="db-schedule-list">
            {scheduleItems.length ? (
              scheduleItems.slice(0, 5).map((task) => {
                const done = task.status === 'done'
                return (
                  <div key={task.id} className={`db-sch-row ${done ? 'is-done' : ''}`}>
                    <span className="db-sch-time">{formatTime(task.scheduled_for!)}</span>
                    <span className="db-sch-texts">
                      <strong>{task.subject_name ?? task.title}</strong>
                      {task.subject_name ? <small>{task.title}</small> : null}
                    </span>
                    <span className={`db-sch-state ${done ? 'done' : ''}`}>{done ? '\u2713' : '\u25CB'}</span>
                  </div>
                )
              })
            ) : (
              <p className="db-empty">Nothing scheduled yet. Add sessions from the planner.</p>
            )}
          </div>
          <Link className="db-card-link" to="/calendar">View Calendar {'\u2192'}</Link>
        </section>

        {/* 5 - AI Recommendation */}
        <section className="db-card db-ai">
          <span className="db-eyebrow ai">{'\u2726'} FLOX AI</span>
          {aiInsight.hasData ? (
            <>
              <p className="db-ai-head">{aiInsight.text}</p>
              <p className="db-ai-body">{aiInsight.detail}</p>
              <span className="db-ai-time">Estimated time: {aiInsight.minutes} minutes</span>
            </>
          ) : (
            <>
              <p className="db-ai-head">I need a little more information to personalize your study plan.</p>
              <p className="db-ai-body">Add your subjects and goals, and I'll build a plan around them.</p>
            </>
          )}
        </section>

        {/* 6 - This Week */}
        <section className="db-card db-week" onClick={() => navigate('/progress')} role="link" tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter') navigate('/progress') }}>
          <span className="db-eyebrow">{'\uD83D\uDCCA'} This Week</span>
          <div className="db-chart">
            {weekBars.map((bar) => (
              <div className="db-bar-col" key={bar.key}>
                <div className="db-bar-track">
                  <div className={`db-bar-fill ${bar.minutes ? '' : 'empty'}`} style={{ height: `${bar.pct}%` }} title={`${formatMinutes(bar.minutes)}`} />
                </div>
                <span className="db-bar-label">{bar.label}</span>
              </div>
            ))}
          </div>
          <div className="db-week-foot">
            <strong>{formatMinutes(dashboard?.week_minutes ?? 0)}</strong>
            <span>this week</span>
            {weekDelta !== null && (
              <small className={weekDelta >= 0 ? 'up' : 'down'}>
                {weekDelta >= 0 ? '\u2191' : '\u2193'} {Math.abs(weekDelta)}% vs last week
              </small>
            )}
          </div>
        </section>

        {/* 7 - Study Streak */}
        <section className="db-card db-streak">
          <span className="db-eyebrow flame">{'\uD83D\uDD25'} Study Streak</span>
          <strong className="db-streak-num">{streak} days</strong>
          {dashboard?.next_milestone ? (
            <div className="db-milestone">
              <span className="db-milestone-label">NEXT MILESTONE: {dashboard.next_milestone.target} DAYS</span>
              <div className="db-milestone-track">
                <span className="db-milestone-cap start">{'\uD83D\uDFE0'}</span>
                <div className="db-milestone-rail">
                  <div className="db-milestone-fill" style={{ width: `${Math.min(100, dashboard.next_milestone.progress)}%` }} />
                </div>
                <span className="db-milestone-cap end">{'\uD83D\uDFE2'}</span>
              </div>
              <small>{streak} / {dashboard.next_milestone.target} days</small>
            </div>
          ) : (
            <p className="db-empty">Keep studying to unlock milestones!</p>
          )}
        </section>

        {/* 8 - Subject Progress */}
        <section className="db-card db-subjects">
          <span className="db-eyebrow">{'\uD83D\uDCDA'} Subject Progress</span>
          <div className="db-subj-list">
            {subjectsSummary.slice(0, 4).map((sub) => {
              const pct = sub.total_topics ? Math.round((sub.topics_completed / sub.total_topics) * 100) : 0
              return (
                <div key={sub.name} className="db-subj-row">
                  <div className="db-subj-head">
                    <span className="db-subj-dot" style={{ background: sub.color || '#8b5cf6' }} />
                    <strong>{sub.name}</strong>
                    <span>{pct}%</span>
                  </div>
                  <div className="db-subj-track">
                    <div className="db-subj-fill" style={{ width: `${pct}%`, background: sub.color || '#8b5cf6' }} />
                  </div>
                </div>
              )
            })}
            {!subjectsSummary.length && <p className="db-empty">Add subjects to track progress.</p>}
          </div>
          <Link className="db-card-link" to="/subjects">View All {'\u2192'}</Link>
        </section>

        {/* 9 - Today's Tasks */}
        <section className="db-card db-tasks">
          <span className="db-eyebrow">{'\u2705'} Today's Tasks</span>
          <div className="db-task-list">
            {taskList.map((task) => (
              <div key={task.id} className="db-task-row">
                <button
                  aria-label={task.status === 'done' ? 'Mark as not done' : 'Mark as done'}
                  className={`db-check ${task.status === 'done' ? 'done' : ''}`}
                  disabled={savingTaskId === task.id}
                  onClick={() => void toggleTask(task)}
                  type="button"
                />
                <span className={`db-task-text ${task.status === 'done' ? 'done' : ''}`}>{task.title}</span>
              </div>
            ))}
            {!taskList.length && <p className="db-empty">All caught up!</p>}
          </div>
          <div className="db-add-row">
            <input
              aria-label="Quick add task"
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void addTask() }}
              placeholder="+ Add a task"
              type="text"
              value={newTaskTitle}
            />
          </div>
          <Link className="db-card-link" to="/tasks">View All Tasks {'\u2192'}</Link>
        </section>
      </div>
    </PageShell>
  )
}
