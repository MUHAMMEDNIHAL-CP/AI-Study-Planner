import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import PageShell from '../components/PageShell'
import { api, getErrorMessage } from '../lib/api'

type SubjectSummary = {
  name: string
  color: string
  topics_completed: number
  total_topics: number
  weekly_goal_hours: number
}

type RecentLog = {
  date: string
  minutes_studied: number
  focus_score: number
  completed_tasks: number
}

type HeatmapCell = {
  date: string
  studied: boolean
  dow: number
}

type Exam = {
  id: number
  subject: number | null
  subject_name?: string
  title: string
  date: string
  priority: string
}

type Dashboard = {
  current_streak: number
  longest_streak: number
  total_study_days: number
  studied_today: boolean
  next_milestone: string
  streak: number
  heatmap: HeatmapCell[]
  week_minutes: number[]
  completion_rate: number
  open_tasks: number
  upcoming_exams: Exam[]
  recent_logs: RecentLog[]
  today_tasks: unknown[]
  subjects_summary: SubjectSummary[]
  total_study_hours: number
  total_completed_tasks: number
  total_focus_sessions: number
  today_minutes: number
}

type FocusSession = {
  id: number
  subject_name: string
  task_title: string
  duration_minutes: number
  completed: boolean
  mood: string
  notes: string
  date: string
  created_at: string
}

type TimeFilter = 'today' | 'week' | 'month' | 'all'

function formatHours(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return hours ? `${hours}h ${mins}m` : `${mins}m`
}

function shortDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function daysUntil(date: string) {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const target = new Date(`${date}T00:00:00`)
  return Math.ceil((target.getTime() - now.getTime()) / 86_400_000)
}

function pctChange(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0
  return Math.round(((current - previous) / previous) * 100)
}

const FILTER_LABELS: Record<TimeFilter, string> = {
  today: 'Today',
  week: 'This Week',
  month: 'This Month',
  all: 'All Time',
}

const ACHIEVEMENT_DEFS = [
  { key: 'streak7', icon: '\uD83D\uDD25', title: '7 Day Streak', target: 7, type: 'streak' as const },
  { key: 'hours10', icon: '\uD83C\uDFAF', title: '10 Hours', target: 10, type: 'hours' as const },
  { key: 'firstExam', icon: '\uD83C\uDFC6', title: 'First Exam', target: 1, type: 'exams' as const },
  { key: 'streak30', icon: '\uD83D\uDD12', title: '30 Day Streak', target: 30, type: 'streak' as const },
  { key: 'hours50', icon: '\uD83D\uDD12', title: '50 Hours', target: 50, type: 'hours' as const },
  { key: 'tasks100', icon: '\uD83D\uDD12', title: '100 Tasks', target: 100, type: 'tasks' as const },
]

export default function ProgressPage() {
  const navigate = useNavigate()
  const [dashboard, setDashboard] = useState<Dashboard | null>(null)
  const [sessions, setSessions] = useState<FocusSession[]>([])
  const [subjects, setSubjects] = useState<SubjectSummary[]>([])
  const [exams, setExams] = useState<Exam[]>([])
  const [loading, setLoading] = useState(true)
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('week')
  const [filterOpen, setFilterOpen] = useState(false)

  useEffect(() => {
    let active = true

    async function load() {
      try {
        const [dashRes, sessRes, subjRes, examRes] = await Promise.all([
          api.get<Dashboard>('/study/dashboard/'),
          api.get<FocusSession[]>('/productivity/focus-sessions/'),
          api.get<SubjectSummary[]>('/study/subjects/'),
          api.get<Exam[]>('/study/exams/'),
        ])
        if (active) {
          setDashboard(dashRes.data)
          setSessions(sessRes.data)
          setSubjects(subjRes.data)
          setExams(examRes.data)
        }
      } catch (err) {
        if (active) toast.error(getErrorMessage(err))
      } finally {
        if (active) setLoading(false)
      }
    }

    void load()
    return () => { active = false }
  }, [])

  const recentLogs = dashboard?.recent_logs ?? []

  const last7Logs = useMemo(() => {
    const byDate = new Map<string, RecentLog>()
    recentLogs.forEach((log) => byDate.set(log.date, log))
    const result: Array<{ label: string; minutes: number; date: string }> = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      const log = byDate.get(key)
      const dayLabel = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()]
      result.push({ label: dayLabel, minutes: log?.minutes_studied ?? 0, date: key })
    }
    return result
  }, [recentLogs])

  const weekTotalMinutes = last7Logs.reduce((s, d) => s + d.minutes, 0)
  const maxMinutes = Math.max(1, ...last7Logs.map((d) => d.minutes))

  const lastWeekLogs = useMemo(() => {
    const byDate = new Map<string, RecentLog>()
    recentLogs.forEach((log) => byDate.set(log.date, log))
    let total = 0
    for (let i = 13; i >= 7; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      total += byDate.get(key)?.minutes_studied ?? 0
    }
    return total
  }, [recentLogs])

  const lastWeekTasks = useMemo(() => {
    const byDate = new Map<string, RecentLog>()
    recentLogs.forEach((log) => byDate.set(log.date, log))
    let total = 0
    for (let i = 13; i >= 7; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      total += byDate.get(key)?.completed_tasks ?? 0
    }
    return total
  }, [recentLogs])

  const thisWeekTasks = recentLogs.reduce((s, l) => s + l.completed_tasks, 0)
  const thisWeekSessions = sessions.filter((s) => {
    const d = new Date(s.date + 'T00:00:00')
    const now = new Date()
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    return d >= weekAgo && d <= now
  }).length

  const completedSessions = sessions.filter((s) => s.completed)
  const avgSession = completedSessions.length
    ? Math.round(completedSessions.reduce((s, c) => s + c.duration_minutes, 0) / completedSessions.length)
    : 0
  const completionRate = sessions.length
    ? Math.round((completedSessions.length / sessions.length) * 100)
    : 0

  const moodToRating: Record<string, number> = { great: 5, good: 4, okay: 3, bad: 2, terrible: 1 }
  const ratedSessions = completedSessions.filter((s) => s.mood && moodToRating[s.mood])
  const avgFocusRating = ratedSessions.length
    ? (ratedSessions.reduce((s, c) => s + (moodToRating[c.mood] || 3), 0) / ratedSessions.length).toFixed(1)
    : '0'

  const moodDistribution = useMemo(() => {
    const dist = [0, 0, 0, 0, 0]
    ratedSessions.forEach((s) => {
      const r = moodToRating[s.mood]
      if (r >= 1 && r <= 5) dist[r - 1]++
    })
    return dist
  }, [ratedSessions])

  const maxMoodCount = Math.max(1, ...moodDistribution)

  const upcomingExams = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return exams
      .filter((e) => new Date(`${e.date}T00:00:00`) >= today)
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [exams])

  const subjectPerformance = useMemo(() => {
    return subjects.map((s) => {
      const pct = s.total_topics ? Math.round((s.topics_completed / s.total_topics) * 100) : 0
      const subjectSessions = completedSessions.filter((c) => c.subject_name === s.name)
      const totalMin = subjectSessions.reduce((sum, c) => sum + c.duration_minutes, 0)
      return { ...s, percent: pct, studyMinutes: totalMin }
    }).sort((a, b) => b.studyMinutes - a.studyMinutes)
  }, [subjects, completedSessions])

  const heatmap4Weeks = useMemo(() => {
    if (dashboard?.heatmap?.length) {
      return dashboard.heatmap
    }
    const cells: HeatmapCell[] = []
    const studiedDates = new Set(sessions.filter((s) => s.completed).map((s) => s.date))
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 7; col++) {
        const d = new Date()
        d.setDate(d.getDate() - (3 - row) * 7 - (6 - col))
        const key = d.toISOString().slice(0, 10)
        cells.push({ date: key, studied: studiedDates.has(key), dow: col })
      }
    }
    return cells
  }, [dashboard, sessions])

  const improvement = useMemo(() => {
    const thisWeekMin = weekTotalMinutes
    const studyPct = pctChange(thisWeekMin, lastWeekLogs)
    const taskPct = pctChange(thisWeekTasks, lastWeekTasks)
    const lastWeekSess = sessions.filter((s) => {
      const d = new Date(s.date + 'T00:00:00')
      const a = new Date(); a.setDate(a.getDate() - 14)
      const b = new Date(); b.setDate(b.getDate() - 7)
      return d >= a && d < b
    }).length
    const sessPct = pctChange(thisWeekSessions, lastWeekSess)
    return { studyPct, taskPct, sessPct, lastWeekMin: lastWeekLogs, lastWeekTasks, lastWeekSess }
  }, [weekTotalMinutes, lastWeekLogs, thisWeekTasks, lastWeekTasks, thisWeekSessions, sessions])

  const aiInsight = useMemo(() => {
    const lines: string[] = []
    if (weekTotalMinutes > lastWeekLogs) {
      lines.push(`You\u2019re studying more consistently this week. Your average session increased from ${Math.round(lastWeekLogs / 7)} to ${Math.round(weekTotalMinutes / 7)} minutes per day.`)
    } else if (weekTotalMinutes < lastWeekLogs && lastWeekLogs > 0) {
      lines.push(`Study time dropped this week compared to last. Try scheduling shorter, more frequent sessions to rebuild momentum.`)
    } else {
      lines.push(`You\u2019re maintaining steady study habits this week.`)
    }

    const weakest = subjectPerformance.filter((s) => s.percent < 50 && s.total_topics > 0).sort((a, b) => a.percent - b.percent)
    if (weakest.length) {
      lines.push(`However, ${weakest[0].name} received less attention despite being your weakest subject at ${weakest[0].percent}% completion.`)
    }

    if (avgSession > 0 && avgSession < 30) {
      lines.push(`Your average session is ${avgSession} minutes. Try extending to 45\u201350 minutes for deeper focus.`)
    }

    return lines
  }, [weekTotalMinutes, lastWeekLogs, subjectPerformance, avgSession])

  const recommendation = useMemo(() => {
    const weakest = subjectPerformance.filter((s) => s.percent < 50 && s.total_topics > 0).sort((a, b) => a.percent - b.percent)
    if (weakest.length) {
      return `Add two ${weakest[0].name} sessions next week to improve your ${weakest[0].percent}% completion rate.`
    }
    if (weekTotalMinutes < 600) {
      return `Aim for at least 10 hours of study next week to build stronger habits.`
    }
    return `Keep up the great work! Consider exploring advanced topics in your strongest subjects.`
  }, [subjectPerformance, weekTotalMinutes])

  const achievements = useMemo(() => {
    return ACHIEVEMENT_DEFS.map((a) => {
      let current = 0
      if (a.type === 'streak') current = dashboard?.current_streak ?? 0
      else if (a.type === 'hours') current = dashboard?.total_study_hours ?? 0
      else if (a.type === 'tasks') current = dashboard?.total_completed_tasks ?? 0
      else if (a.type === 'exams') current = exams.length
      return { ...a, unlocked: current >= a.target, current }
    })
  }, [dashboard, exams])

  if (loading) {
    return (
      <PageShell eyebrow="Progress" title="Loading progress..." subtitle="Gathering your study data.">
        <div className="page-card">Loading...</div>
      </PageShell>
    )
  }

  return (
    <PageShell
      className="progress-page"
      eyebrow="Progress"
      title="Your Study Progress"
      subtitle="Track your growth, review focus sessions, and discover insights about your study habits."
      actions={
        <div className="progress-filter-wrap">
          <button className="progress-filter-btn" onClick={() => setFilterOpen(!filterOpen)}>
            {FILTER_LABELS[timeFilter]} <span className="progress-filter-chevron">{filterOpen ? '\u25B2' : '\u25BC'}</span>
          </button>
          {filterOpen && (
            <div className="progress-filter-dropdown">
              {(Object.entries(FILTER_LABELS) as [TimeFilter, string][]).map(([key, label]) => (
                <button
                  key={key}
                  className={`progress-filter-option ${timeFilter === key ? 'active' : ''}`}
                  onClick={() => { setTimeFilter(key); setFilterOpen(false) }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      }
    >
      {/* ── 1. Top Performance Cards ── */}
      <div className="pg-stats-row">
        <article className="pg-stat-card">
          <span className="pg-stat-label">STUDY TIME</span>
          <strong className="pg-stat-value">{formatHours(weekTotalMinutes)}</strong>
          <span className={`pg-stat-trend ${improvement.studyPct >= 0 ? 'up' : 'down'}`}>
            {improvement.studyPct >= 0 ? '\u2191' : '\u2193'} {Math.abs(improvement.studyPct)}%
          </span>
        </article>
        <article className="pg-stat-card">
          <span className="pg-stat-label">TASKS</span>
          <strong className="pg-stat-value">{thisWeekTasks}</strong>
          <span className={`pg-stat-trend ${improvement.taskPct >= 0 ? 'up' : 'down'}`}>
            {improvement.taskPct >= 0 ? '\u2191' : '\u2193'} {Math.abs(improvement.taskPct)}%
          </span>
        </article>
        <article className="pg-stat-card">
          <span className="pg-stat-label">FOCUS SESSIONS</span>
          <strong className="pg-stat-value">{thisWeekSessions}</strong>
          <span className={`pg-stat-trend ${improvement.sessPct >= 0 ? 'up' : 'down'}`}>
            {improvement.sessPct >= 0 ? '\u2191' : '\u2193'} {Math.abs(improvement.sessPct)}%
          </span>
        </article>
        <article className="pg-stat-card">
          <span className="pg-stat-label">STREAK</span>
          <strong className="pg-stat-value">{'\uD83D\uDD25'} {dashboard?.current_streak ?? 0} days</strong>
          <span className="pg-stat-sub">Best: {dashboard?.longest_streak ?? 0} days</span>
        </article>
      </div>

      {/* ── 2. Study Activity + Study Streak ── */}
      <div className="pg-duo-row">
        <section className="pg-card pg-activity-card">
          <div className="pg-card-header">
            <span className="eyebrow">{'\uD83D\uDCCA'} Study Activity</span>
          </div>
          <div className="pg-chart-y-labels">
            {[5, 4, 3, 2, 1, 0].map((h) => (
              <span key={h}>{h}h</span>
            ))}
          </div>
          <div className="pg-chart-area">
            <svg className="pg-chart-svg" viewBox="0 0 700 200" preserveAspectRatio="none">
              {/* Grid lines */}
              {[0, 40, 80, 120, 160, 200].map((y) => (
                <line key={y} x1="0" y1={y} x2="700" y2={y} className="pg-chart-grid" />
              ))}
              {/* Area fill */}
              <path
                d={`M ${last7Logs.map((d, i) => {
                  const x = (i / 6) * 700
                  const y = 200 - (d.minutes / (maxMinutes || 1)) * 180
                  return `${x},${y}`
                }).join(' L ')} L 700,200 L 0,200 Z`}
                className="pg-chart-area-fill"
              />
              {/* Line */}
              <polyline
                points={last7Logs.map((d, i) => {
                  const x = (i / 6) * 700
                  const y = 200 - (d.minutes / (maxMinutes || 1)) * 180
                  return `${x},${y}`
                }).join(' ')}
                className="pg-chart-line"
              />
              {/* Dots */}
              {last7Logs.map((d, i) => {
                const x = (i / 6) * 700
                const y = 200 - (d.minutes / (maxMinutes || 1)) * 180
                return <circle key={i} cx={x} cy={y} r="5" className="pg-chart-dot" />
              })}
            </svg>
            <div className="pg-chart-x-labels">
              {last7Logs.map((d) => (
                <span key={d.label}>{d.label}</span>
              ))}
            </div>
          </div>
          <div className="pg-chart-summary">
            <strong>{formatHours(weekTotalMinutes)}</strong>
            <span>Total study time</span>
            {improvement.studyPct > 0 && (
              <span className="pg-chart-compare up">{'\u2191'} {improvement.studyPct}% compared to last week</span>
            )}
            {improvement.studyPct < 0 && (
              <span className="pg-chart-compare down">{'\u2193'} {Math.abs(improvement.studyPct)}% compared to last week</span>
            )}
          </div>
        </section>

        <section className="pg-card pg-streak-card">
          <div className="pg-card-header">
            <span className="eyebrow">{'\uD83D\uDD25'} Study Streak</span>
            <span className="pg-streak-emoji">{'\uD83D\uDFE0'}</span>
          </div>
          <div className="pg-streak-number">{dashboard?.current_streak ?? 0} days</div>
          <div className="pg-streak-label">LONGEST STREAK: {dashboard?.longest_streak ?? 0} DAYS</div>
          <div className="pg-streak-bar-track">
            <div
              className="pg-streak-bar-fill"
              style={{ width: `${Math.min(((dashboard?.current_streak ?? 0) / 30) * 100, 100)}%` }}
            />
            <div className="pg-streak-bar-milestone" style={{ left: '100%' }}>
              <span className="pg-streak-bar-milestone-dot" />
            </div>
          </div>
          <div className="pg-streak-progress-text">
            {dashboard?.current_streak ?? 0} / 30 days
          </div>
        </section>
      </div>

      {/* ── 3. Subject Performance ── */}
      {subjectPerformance.length ? (
        <section className="pg-card pg-subjects-card">
          <div className="pg-card-header">
            <span className="eyebrow">{'\uD83D\uDCDA'} Subject Performance</span>
          </div>
          <div className="pg-subjects-table-head">
            <span className="pg-subjects-col-name"></span>
            <span className="pg-subjects-col-time">Study Time</span>
            <span className="pg-subjects-col-progress">Progress</span>
          </div>
          {subjectPerformance.map((s) => (
            <button
              className="pg-subjects-row"
              key={s.name}
              onClick={() => navigate(`/subjects`)}
            >
              <span className="pg-subjects-col-name">
                <span className="pg-subject-dot" style={{ background: s.color || '#8b5cf6' }} />
                {s.name}
              </span>
              <span className="pg-subjects-col-time">{formatHours(s.studyMinutes)}</span>
              <span className="pg-subjects-col-progress">
                <span className="pg-subjects-bar-track">
                  <span className="pg-subjects-bar-fill" style={{ width: `${s.percent}%`, background: s.color || '#8b5cf6' }} />
                </span>
                <span className="pg-subjects-pct">{s.percent}%</span>
              </span>
            </button>
          ))}
        </section>
      ) : null}

      {/* ── 4. Improvement + Focus Quality ── */}
      <div className="pg-duo-row">
        <section className="pg-card pg-improvement-card">
          <div className="pg-card-header">
            <span className="eyebrow">{'\uD83D\uDCC8'} Your Improvement</span>
          </div>
          <div className="pg-improve-grid">
            <div className="pg-improve-item">
              <span className="pg-improve-title">Study Time</span>
              <div className="pg-improve-row">
                <span className="pg-improve-last">Last week: {formatHours(improvement.lastWeekMin)}</span>
                <span className="pg-improve-this">This week: {formatHours(weekTotalMinutes)}</span>
              </div>
              <span className={`pg-improve-delta ${improvement.studyPct >= 0 ? 'up' : 'down'}`}>
                {improvement.studyPct >= 0 ? '\u2191' : '\u2193'} {Math.abs(improvement.studyPct)}%
              </span>
            </div>
            <div className="pg-improve-item">
              <span className="pg-improve-title">Tasks</span>
              <div className="pg-improve-row">
                <span className="pg-improve-last">Last week: {improvement.lastWeekTasks}</span>
                <span className="pg-improve-this">This week: {thisWeekTasks}</span>
              </div>
              <span className={`pg-improve-delta ${improvement.taskPct >= 0 ? 'up' : 'down'}`}>
                {improvement.taskPct >= 0 ? '\u2191' : '\u2193'} {Math.abs(improvement.taskPct)}%
              </span>
            </div>
            <div className="pg-improve-item">
              <span className="pg-improve-title">Focus Sessions</span>
              <div className="pg-improve-row">
                <span className="pg-improve-last">Last week: {improvement.lastWeekSess}</span>
                <span className="pg-improve-this">This week: {thisWeekSessions}</span>
              </div>
              <span className={`pg-improve-delta ${improvement.sessPct >= 0 ? 'up' : 'down'}`}>
                {improvement.sessPct >= 0 ? '\u2191' : '\u2193'} {Math.abs(improvement.sessPct)}%
              </span>
            </div>
          </div>
        </section>

        <section className="pg-card pg-focus-card">
          <div className="pg-card-header">
            <span className="eyebrow">{'\uD83E\uDDE0'} Focus Quality</span>
          </div>
          <div className="pg-focus-grid">
            <div className="pg-focus-stat">
              <span className="pg-focus-stat-label">Average Session</span>
              <strong className="pg-focus-stat-value">{avgSession} min</strong>
            </div>
            <div className="pg-focus-stat">
              <span className="pg-focus-stat-label">Completed Sessions</span>
              <strong className="pg-focus-stat-value">{completedSessions.length} / {sessions.length}</strong>
            </div>
            <div className="pg-focus-stat">
              <span className="pg-focus-stat-label">Completion Rate</span>
              <strong className="pg-focus-stat-value">{completionRate}%</strong>
            </div>
            <div className="pg-focus-stat">
              <span className="pg-focus-stat-label">Average Focus Rating</span>
              <strong className="pg-focus-stat-value">{avgFocusRating} / 5</strong>
            </div>
          </div>
          <div className="pg-focus-rating-dist">
            <span className="pg-focus-rating-title">Focus Rating</span>
            {[5, 4, 3, 2, 1].map((rating) => (
              <div className="pg-focus-rating-row" key={rating}>
                <span className="pg-focus-rating-label">{rating} {'\u2B50'}</span>
                <span className="pg-focus-rating-track">
                  <span
                    className="pg-focus-rating-fill"
                    style={{ width: `${(moodDistribution[rating - 1] / maxMoodCount) * 100}%` }}
                  />
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* ── 5. Exam Readiness ── */}
      {upcomingExams.length ? (
        <section className="pg-card pg-exams-card">
          <div className="pg-card-header">
            <span className="eyebrow">{'\uD83C\uDF93'} Exam Readiness</span>
          </div>
          <div className="pg-exams-grid">
            {upcomingExams.map((exam) => {
              const subj = subjects.find((s) => s.name === exam.subject_name)
              const prepPct = subj?.total_topics
                ? Math.round((subj.topics_completed / subj.total_topics) * 100)
                : 0
              const remaining = daysUntil(exam.date)
              const onTrack = prepPct >= 60 || remaining > 14
              return (
                <button
                  className="pg-exam-item"
                  key={exam.id}
                  onClick={() => navigate('/exams')}
                >
                  <div className="pg-exam-head">
                    <strong>{exam.title}</strong>
                    <span className="pg-exam-date">Exam: {shortDate(exam.date)}</span>
                  </div>
                  <div className="pg-exam-prep">
                    <span className="pg-exam-prep-bar-track">
                      <span
                        className="pg-exam-prep-bar-fill"
                        style={{
                          width: `${prepPct}%`,
                          background: onTrack ? 'var(--mint)' : 'var(--amber)',
                        }}
                      />
                    </span>
                    <span className="pg-exam-prep-pct">{prepPct}%</span>
                  </div>
                  <div className="pg-exam-footer">
                    <span className="pg-exam-days">{remaining} days remaining</span>
                    <span className={`pg-exam-status ${onTrack ? 'on-track' : 'needs-attention'}`}>
                      {onTrack ? '\u2713 On track' : '\u26A0\uFE0F Needs attention'}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </section>
      ) : null}

      {/* ── 6. AI Progress Analysis ── */}
      <section className="pg-card pg-ai-card">
        <div className="pg-card-header">
          <span className="eyebrow pg-ai-eyebrow">{'\uD83E\uDD16'} Flox AI</span>
        </div>
        <div className="pg-ai-title">YOUR WEEKLY INSIGHT</div>
        <div className="pg-ai-body">
          {aiInsight.map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
        <div className="pg-ai-rec">
          <span className="pg-ai-rec-icon">{'\uD83D\uDCA1'} Recommendation</span>
          <p>{recommendation}</p>
        </div>
        <button className="pg-ai-btn" onClick={() => navigate('/planner')}>
          Create New Plan
        </button>
      </section>

      {/* ── 7. Study Consistency ── */}
      <section className="pg-card pg-consistency-card">
        <div className="pg-card-header">
          <span className="eyebrow">{'\uD83D\uDCC5'} Study Consistency</span>
        </div>
        <div className="pg-heatmap">
          <div className="pg-heatmap-header">
            <span></span>
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
              <span key={i}>{d}</span>
            ))}
          </div>
          {(() => {
            const rows: HeatmapCell[][] = []
            for (let i = 0; i < heatmap4Weeks.length; i += 7) {
              rows.push(heatmap4Weeks.slice(i, i + 7))
            }
            return rows.map((row, ri) => (
              <div className="pg-heatmap-row" key={ri}>
                <span className="pg-heatmap-week-label">Week {ri + 1}</span>
                {row.map((cell, ci) => (
                  <span
                    className={`pg-heatmap-cell ${cell.studied ? 'active' : ''}`}
                    key={`${cell.date}-${ci}`}
                    title={cell.date}
                  />
                ))}
              </div>
            ))
          })()}
        </div>
      </section>

      {/* ── 8. Achievements ── */}
      <section className="pg-card pg-achievements-card">
        <div className="pg-card-header">
          <span className="eyebrow">{'\uD83C\uDFC5'} Achievements</span>
        </div>
        <div className="pg-achievements-grid">
          {achievements.map((a) => {
            const cls = 'pg-achievement-item ' + (a.unlocked ? 'unlocked' : 'locked')
            const lockIcon = '\uD83D\uDD12'
            return (
              <div className={cls} key={a.key}>
                <span className="pg-achievement-icon">{a.unlocked ? a.icon : lockIcon}</span>
                <strong>{a.title}</strong>
                <span className="pg-achievement-status">
                  {a.unlocked ? 'Unlocked' : a.current + ' / ' + a.target}
                </span>
              </div>
            )
          })}
        </div>
      </section>
    </PageShell>
  )
}
