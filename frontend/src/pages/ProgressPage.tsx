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

type QuizItem = {
  id: number
  topic: string
  difficulty: string
  score: number | null
  total_questions: number
  created_at: string
}

type MeInfo = {
  username: string
  profile?: {
    daily_study_goal?: number
    preferred_study_time?: string
  }
}

type Dashboard = {
  current_streak: number
  longest_streak: number
  total_study_days: number
  studied_today: boolean
  next_milestone: string
  heatmap: HeatmapCell[]
  recent_logs: RecentLog[]
  subjects_summary: SubjectSummary[]
  total_study_hours: number
  total_completed_tasks: number
  total_focus_sessions: number
  today_minutes: number
}

type TimeFilter = 'today' | 'week' | 'month' | 'quarter' | 'all'

const PERIOD_LABELS: Record<TimeFilter, string> = {
  today: 'Today',
  week: 'This Week',
  month: 'This Month',
  quarter: 'Last 3 Months',
  all: 'All Time',
}

const PERIOD_DAYS: Record<TimeFilter, number> = {
  today: 1,
  week: 7,
  month: 30,
  quarter: 90,
  all: 0,
}

function dayKey(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function fmtHM(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return h ? `${h}h ${m}m` : `${m}m`
}

function pctChange(cur: number, prev: number) {
  if (prev === 0) return cur > 0 ? 100 : 0
  return Math.round(((cur - prev) / prev) * 100)
}

function timeBucket(hour: number) {
  if (hour >= 5 && hour < 12) return 'Morning'
  if (hour >= 12 && hour < 17) return 'Afternoon'
  if (hour >= 17 && hour < 22) return 'Evening'
  return 'Night'
}

function bucketIcon(name: string) {
  if (name === 'Morning') return '\u{1F305}'
  if (name === 'Afternoon') return '\u2600\uFE0F'
  if (name === 'Evening') return '\uD83C\uDF19'
  return '\u2728'
}

const ACHIEVEMENT_DEFS = [
  { key: 'streak7', icon: '\uD83D\uDD25', title: '7 Day Streak', target: 7, type: 'streak' as const },
  { key: 'acc80', icon: '\uD83C\uDFAF', title: '80% Accuracy', target: 80, type: 'accuracy' as const },
  { key: 'hours10', icon: '\u23F1\uFE0F', title: '10 Hours Studied', target: 10, type: 'hours' as const },
  { key: 'firstExam', icon: '\uD83C\uDFC6', title: 'First Exam Completed', target: 1, type: 'exams' as const },
]

export default function ProgressPage() {
  const navigate = useNavigate()
  const [dashboard, setDashboard] = useState<Dashboard | null>(null)
  const [logs, setLogs] = useState<RecentLog[]>([])
  const [sessions, setSessions] = useState<FocusSession[]>([])
  const [subjects, setSubjects] = useState<SubjectSummary[]>([])
  const [quizzes, setQuizzes] = useState<QuizItem[]>([])
  const [me, setMe] = useState<MeInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('week')
  const [filterOpen, setFilterOpen] = useState(false)
  const [openSubject, setOpenSubject] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function load() {
      try {
        const [dashRes, logRes, sessRes, subjRes] = await Promise.all([
          api.get<Dashboard>('/study/dashboard/'),
          api.get<RecentLog[]>('/productivity/logs/'),
          api.get<FocusSession[]>('/productivity/focus-sessions/'),
          api.get<SubjectSummary[]>('/study/subjects/'),
        ])
        if (!active) return
        setDashboard(dashRes.data)
        setLogs(logRes.data ?? [])
        setSessions(sessRes.data ?? [])
        setSubjects(subjRes.data ?? [])
      } catch (err) {
        if (active) toast.error(getErrorMessage(err))
      } finally {
        if (active) setLoading(false)
      }
      try {
        const quizRes = await api.get<QuizItem[]>('/quiz/history/')
        if (active) setQuizzes(quizRes.data ?? [])
      } catch {
        /* optional */
      }
      try {
        const meRes = await api.get<MeInfo>('/auth/me/')
        if (active) setMe(meRes.data)
      } catch {
        /* optional */
      }
    }

    void load()
    return () => { active = false }
  }, [])

  /* ── date windows ── */

  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const windowFor = (filter: TimeFilter): { start: Date; end: Date } => {
    if (filter === 'today') return { start: today, end: today }
    if (filter === 'all') {
      const oldest = logs.length
        ? logs.reduce((min, l) => (l.date < min ? l.date : min), logs[0].date)
        : dayKey(today)
      const start = new Date(`${oldest}T00:00:00`)
      return { start, end: today }
    }
    const start = new Date(today)
    start.setDate(start.getDate() - (PERIOD_DAYS[filter] - 1))
    return { start, end: today }
  }

  const win = useMemo(() => windowFor(timeFilter), [timeFilter, logs, today])

  const minutesByDate = useMemo(() => {
    const m = new Map<string, number>()
    logs.forEach((l) => m.set(l.date, l.minutes_studied))
    return m
  }, [logs])

  const tasksByDate = useMemo(() => {
    const m = new Map<string, number>()
    logs.forEach((l) => m.set(l.date, l.completed_tasks))
    return m
  }, [logs])

  function sumRange(start: Date, end: Date, src: Map<string, number>) {
    let total = 0
    const d = new Date(start)
    while (d <= end) {
      total += src.get(dayKey(d)) ?? 0
      d.setDate(d.getDate() + 1)
    }
    return total
  }

  const periodMinutes = useMemo(() => sumRange(win.start, win.end, minutesByDate), [win, minutesByDate])
  const periodTasks = useMemo(() => sumRange(win.start, win.end, tasksByDate), [win, tasksByDate])

  const prevWin = useMemo(() => {
    const span = Math.max(1, Math.round((win.end.getTime() - win.start.getTime()) / 86_400_000) + 1)
    const end = new Date(win.start)
    end.setDate(end.getDate() - 1)
    const start = new Date(end)
    start.setDate(start.getDate() - (span - 1))
    return { start, end }
  }, [win])

  const prevMinutes = useMemo(
    () => (timeFilter === 'all' ? 0 : sumRange(prevWin.start, prevWin.end, minutesByDate)),
    [prevWin, minutesByDate, timeFilter],
  )
  const minuteDelta = pctChange(periodMinutes, prevMinutes)

  /* ── activity chart buckets ── */

  const bars = useMemo(() => {
    const out: Array<{ label: string; minutes: number }> = []
    if (timeFilter === 'today') {
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today)
        d.setDate(d.getDate() - i)
        out.push({ label: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()], minutes: minutesByDate.get(dayKey(d)) ?? 0 })
      }
      return out
    }
    if (timeFilter === 'all' || timeFilter === 'quarter') {
      const weeks = timeFilter === 'all' ? 12 : 13
      for (let w = weeks - 1; w >= 0; w--) {
        const end = new Date(today)
        end.setDate(end.getDate() - w * 7)
        const start = new Date(end)
        start.setDate(start.getDate() - 6)
        out.push({ label: `${start.getMonth() + 1}/${start.getDate()}`, minutes: sumRange(start, end, minutesByDate) })
      }
      return out
    }
    const d = new Date(win.start)
    while (d <= win.end) {
      const label = timeFilter === 'week'
        ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()]
        : `${d.getDate()}`
      out.push({ label, minutes: minutesByDate.get(dayKey(d)) ?? 0 })
      d.setDate(d.getDate() + 1)
    }
    return out
  }, [timeFilter, win, minutesByDate, today])

  const maxBarMinutes = Math.max(60, ...bars.map((b) => b.minutes))

  /* ── streak ── */

  const currentStreak = dashboard?.current_streak ?? 0
  const longestStreak = dashboard?.longest_streak ?? 0
  const milestone = Number.parseInt(dashboard?.next_milestone ?? '30', 10) || 30
  const streakPct = Math.min(100, Math.round((currentStreak / milestone) * 100))

  /* ── heatmap (last 15 weeks, github-style) ── */

  const heatWeeks = useMemo(() => {
    const weeks: Array<Array<{ key: string; level: number }>> = []
    const totalDays = 15 * 7
    const offsetToSunday = today.getDay()
    const cells: Array<{ key: string; level: number }> = []
    for (let i = totalDays - 1 + (6 - offsetToSunday); i >= -(offsetToSunday); i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const mins = minutesByDate.get(dayKey(d)) ?? 0
      const level = mins <= 0 ? 0 : mins <= 30 ? 1 : mins <= 60 ? 2 : mins <= 120 ? 3 : 4
      cells.push({ key: dayKey(d), level })
    }
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
    return weeks
  }, [minutesByDate, today])

  /* ── quiz performance ── */

  const scoredQuizzes = useMemo(() => quizzes.filter((q) => q.score !== null && q.total_questions > 0), [quizzes])
  const answered = scoredQuizzes.reduce((s, q) => s + q.total_questions, 0)
  const correct = scoredQuizzes.reduce((s, q) => s + (q.score ?? 0), 0)
  const accuracyPct = answered ? Math.round((correct / answered) * 100) : 0
  const avgScore = scoredQuizzes.length
    ? (scoredQuizzes.reduce((s, q) => s + (q.score ?? 0) / q.total_questions * 10, 0) / scoredQuizzes.length).toFixed(1)
    : '0.0'

  const monthWindow = (back: number) => {
    const end = new Date(today)
    end.setDate(end.getDate() - back * 30)
    const start = new Date(end)
    start.setDate(start.getDate() - 29)
    return { start, end }
  }
  const quizAccBetween = (start: Date, end: Date) => {
    let c = 0
    let t = 0
    scoredQuizzes.forEach((q) => {
      const d = new Date(q.created_at)
      if (d >= start && d <= end) {
        t += q.total_questions
        c += q.score ?? 0
      }
    })
    return t ? Math.round((c / t) * 100) : null
  }
  const accThisMonth = quizAccBetween(new Date(today.getTime() - 29 * 86_400_000), today)
  const accLastMonth = quizAccBetween(monthWindow(1).start, monthWindow(1).end)
  const accTrend = accThisMonth !== null && accLastMonth !== null ? accThisMonth - accLastMonth : null

  /* ── topics to improve ── */

  const topicStats = useMemo(() => {
    const all = new Map<string, { correct: number; total: number; count: number }>()
    const recent = new Map<string, { correct: number; total: number }>()
    const prior = new Map<string, { correct: number; total: number }>()
    const monthAgo = new Date(today.getTime() - 29 * 86_400_000)
    const twoMonthsAgo = new Date(today.getTime() - 59 * 86_400_000)
    scoredQuizzes.forEach((q) => {
      const key = q.topic.trim()
      const cur = all.get(key) ?? { correct: 0, total: 0, count: 0 }
      cur.correct += q.score ?? 0
      cur.total += q.total_questions
      cur.count += 1
      all.set(key, cur)
      const d = new Date(q.created_at)
      if (d >= monthAgo) {
        const r = recent.get(key) ?? { correct: 0, total: 0 }
        r.correct += q.score ?? 0
        r.total += q.total_questions
        recent.set(key, r)
      } else if (d >= twoMonthsAgo) {
        const p = prior.get(key) ?? { correct: 0, total: 0 }
        p.correct += q.score ?? 0
        p.total += q.total_questions
        prior.set(key, p)
      }
    })
    const acc = (v?: { correct: number; total: number }) =>
      v && v.total ? Math.round((v.correct / v.total) * 100) : null
    return [...all.entries()]
      .map(([topic, v]) => {
        const rAcc = acc(recent.get(topic))
        const pAcc = acc(prior.get(topic))
        return {
          topic,
          count: v.count,
          accuracy: Math.round((v.correct / v.total) * 100),
          trend: rAcc !== null && pAcc !== null ? rAcc - pAcc : null,
        }
      })
      .sort((a, b) => a.accuracy - b.accuracy)
  }, [scoredQuizzes, today])

  const weakTopics = topicStats.filter((t) => t.accuracy < 80).slice(0, 3)

  /* ── focus performance ── */

  const completedSessions = sessions.filter((s) => s.completed)
  const avgSession = completedSessions.length
    ? Math.round(completedSessions.reduce((s, c) => s + c.duration_minutes, 0) / completedSessions.length)
    : 0
  const focusRate = sessions.length ? Math.round((completedSessions.length / sessions.length) * 100) : 0

  const bestTime = useMemo(() => {
    const totals = new Map<string, { minutes: number; count: number }>()
    completedSessions.forEach((s) => {
      const h = new Date(s.created_at).getHours()
      const b = timeBucket(h)
      const cur = totals.get(b) ?? { minutes: 0, count: 0 }
      cur.minutes += s.duration_minutes
      cur.count += 1
      totals.set(b, cur)
    })
    if (!totals.size) {
      const pref = me?.profile?.preferred_study_time
      const label = pref ? pref.charAt(0).toUpperCase() + pref.slice(1) : 'Evening'
      return { label: `${bucketIcon(label)} ${label}`, avg: avgSession }
    }
    const [label, v] = [...totals.entries()].sort((a, b) => b[1].minutes - a[1].minutes)[0]
    return { label: `${bucketIcon(label)} ${label}`, avg: Math.round(v.minutes / v.count) }
  }, [completedSessions, me, avgSession])

  /* ── subjects ── */

  const subjectRows = useMemo(() => {
    return subjects
      .map((s) => {
        const pct = s.total_topics ? Math.round((s.topics_completed / s.total_topics) * 100) : 0
        const subSessions = completedSessions.filter((c) => c.subject_name === s.name)
        const studyMin = subSessions.reduce((sum, c) => sum + c.duration_minutes, 0)
        const subjQuizzes = scoredQuizzes.filter((q) => q.topic.toLowerCase().includes(s.name.toLowerCase()))
        const qTotal = subjQuizzes.reduce((n, q) => n + q.total_questions, 0)
        const qCorrect = subjQuizzes.reduce((n, q) => n + (q.score ?? 0), 0)
        const quizAcc = qTotal ? Math.round((qCorrect / qTotal) * 100) : null
        const strongest = [...subjQuizzes].sort((a, b) => (b.score ?? 0) / b.total_questions - (a.score ?? 0) / a.total_questions)[0]
        const weakestQ = [...subjQuizzes].sort((a, b) => (a.score ?? 0) / a.total_questions - (b.score ?? 0) / b.total_questions)[0]
        return { ...s, percent: pct, studyMin, sessionCount: subSessions.length, quizAcc, strongest, weakest: weakestQ }
      })
      .sort((a, b) => b.studyMin - a.studyMin)
  }, [subjects, completedSessions, scoredQuizzes])

  /* ── goals ── */

  const dailyGoalHours = me?.profile?.daily_study_goal
    ?? (subjects.length ? Math.max(1, Math.round(subjects.reduce((s, x) => s + (x.weekly_goal_hours || 5), 0) / subjects.length / 7)) : 4)
  const dailyGoalMin = dailyGoalHours * 60
  const last7Min = sumRange(new Date(new Date(today).setDate(today.getDate() - 6)), today, minutesByDate)
  const last30Min = sumRange(new Date(new Date(today).setDate(today.getDate() - 29)), today, minutesByDate)
  const goals = [
    { key: 'daily', title: 'DAILY GOAL', done: dashboard?.today_minutes ?? 0, target: dailyGoalMin },
    { key: 'weekly', title: 'WEEKLY GOAL', done: last7Min, target: dailyGoalMin * 7 },
    { key: 'monthly', title: 'MONTHLY GOAL', done: last30Min, target: dailyGoalMin * 30 },
  ]

  /* ── achievements ── */

  const examCountRef = dashboard?.total_focus_sessions ?? 0
  const achievements = ACHIEVEMENT_DEFS.map((a) => {
    let current = 0
    if (a.type === 'streak') current = currentStreak
    else if (a.type === 'hours') current = dashboard?.total_study_hours ?? 0
    else if (a.type === 'accuracy') current = accuracyPct
    else if (a.type === 'exams') current = examCountRef > 0 ? 1 : 0
    return { ...a, unlocked: current >= a.target, current }
  })
  const recentAchievements = achievements.filter((a) => a.unlocked).slice(0, 4)

  /* ── AI insight ── */

  const firstName = (me?.username ?? 'there').split(' ')[0]
  const topImprovedTopic = useMemo(() => {
    const withTwoAttempts = topicStats.filter((t) => t.count >= 2)
    return withTwoAttempts.sort((a, b) => b.accuracy - a.accuracy)[0] ?? null
  }, [topicStats])
  const opportunity = weakTopics[0] ?? null

  const aiMetrics = [
    { icon: '\uD83D\uDCC8', label: 'Study time', value: `${minuteDelta >= 0 ? '+' : ''}${minuteDelta}%` },
    { icon: '\uD83C\uDFAF', label: 'Accuracy', value: accTrend !== null ? `${accTrend >= 0 ? '+' : ''}${accTrend}%` : `${accuracyPct}%` },
    { icon: '\uD83D\uDD25', label: 'Streak', value: `${currentStreak} days` },
  ]

  const insightLines = [
    opportunity
      ? `Your main opportunity right now is ${opportunity.topic}. Its accuracy is ${opportunity.accuracy}%.`
      : topImprovedTopic
        ? `Your strongest topic lately is ${topImprovedTopic.topic} at ${topImprovedTopic.accuracy}% accuracy.`
        : 'Take a short quiz so Flox AI can pinpoint your strengths and weak areas.',
    opportunity && opportunity.accuracy < 65
      ? `I recommend 3 short revision sessions on ${opportunity.topic} this week, then a retry quiz.`
      : 'Keep your streak alive with one focused session tomorrow.',
  ]

  if (loading) {
    return (
      <PageShell title="Loading progress..." subtitle="Gathering your study data.">
        <div className="page-card">Loading...</div>
      </PageShell>
    )
  }

  return (
    <PageShell
      className="progress-page"
      title="Progress"
      subtitle="See how your study habits and performance are improving."
      actions={
        <div className="progress-filter-wrap">
          <button className="progress-filter-btn" onClick={() => setFilterOpen(!filterOpen)}>
            {PERIOD_LABELS[timeFilter]} <span className="progress-filter-chevron">{filterOpen ? '\u25B2' : '\u25BC'}</span>
          </button>
          {filterOpen && (
            <div className="progress-filter-dropdown">
              {(Object.entries(PERIOD_LABELS) as [TimeFilter, string][]).map(([key, label]) => (
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
      {/* ── 1. Top statistics ── */}
      <div className="pg-stats-row">
        <article className="pg-stat-card">
          <span className="pg-stat-label">{'\u23F1\uFE0F'} STUDY TIME</span>
          <strong className="pg-stat-value">{fmtHM(periodMinutes)}</strong>
          <span className={`pg-stat-trend ${minuteDelta >= 0 ? 'up' : 'down'}`}>
            {minuteDelta >= 0 ? '\u2191' : '\u2193'} {Math.abs(minuteDelta)}%
          </span>
        </article>
        <article className="pg-stat-card">
          <span className="pg-stat-label">{'\uD83D\uDD25'} STREAK</span>
          <strong className="pg-stat-value">{currentStreak} days</strong>
          <span className="pg-stat-sub">Longest: {longestStreak} days</span>
        </article>
        <article className="pg-stat-card">
          <span className="pg-stat-label">{'\uD83C\uDFAF'} ACCURACY</span>
          <strong className="pg-stat-value">{answered ? `${accuracyPct}%` : '\u2014'}</strong>
          <span className={`pg-stat-trend ${(accTrend ?? 0) >= 0 ? 'up' : 'down'}`}>
            {accTrend !== null ? `${accTrend >= 0 ? '\u2191' : '\u2193'} ${Math.abs(accTrend)}% this month` : `${scoredQuizzes.length} quizzes`}
          </span>
        </article>
        <article className="pg-stat-card">
          <span className="pg-stat-label">{'\u2713'} TASKS DONE</span>
          <strong className="pg-stat-value">{periodTasks}</strong>
          <span className="pg-stat-sub">{dashboard?.total_completed_tasks ?? 0} all time</span>
        </article>
      </div>

      {/* ── 2. Activity chart + streak ── */}
      <div className="pg-duo-row">
        <section className="pg-card pg-activity-card">
          <div className="pg-card-header">
            <span className="pg-section-title">{'\uD83D\uDCCA'} STUDY ACTIVITY</span>
          </div>
          <div className="pg-barwrap">
            <div className="pg-barylabels">
              {[4, 3, 2, 1, 0].map((i) => (
                <span key={i}>{Math.round((maxBarMinutes / 4) * i / 60)}h</span>
              ))}
            </div>
            <div className="pg-bars">
              {bars.map((b, i) => (
                <div className="pg-barcol" key={`${b.label}-${i}`} title={`${b.label}: ${fmtHM(b.minutes)}`}>
                  <span
                    className={'pg-barfill' + (b.minutes > 0 ? '' : ' empty')}
                    style={{ height: `${Math.max(b.minutes > 0 ? 4 : 2, (b.minutes / maxBarMinutes) * 100)}%` }}
                  />
                  {(bars.length <= 10 || i % Math.ceil(bars.length / 10) === 0) && (
                    <span className="pg-barlabel">{b.label}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="pg-chart-summary">
            <strong>{fmtHM(periodMinutes)}</strong>
            <span>{PERIOD_LABELS[timeFilter] === 'Today' ? 'today' : `this ${timeFilter === 'week' ? 'week' : timeFilter === 'month' ? 'month' : 'period'}`}</span>
            {timeFilter !== 'all' && (
              <span className={`pg-chart-compare ${minuteDelta >= 0 ? 'up' : 'down'}`}>
                {minuteDelta >= 0 ? '\u2191' : '\u2193'} {Math.abs(minuteDelta)}% vs previous
              </span>
            )}
          </div>
        </section>

        <section className="pg-card pg-streak-card">
          <div className="pg-card-header">
            <span className="pg-section-title">{'\uD83D\uDD25'} STUDY STREAK</span>
          </div>
          <div className="pg-streak-number">{currentStreak} days</div>
          <div className="pg-streak-label">LONGEST: {longestStreak} DAYS</div>
          <div className="pg-streak-bar-track">
            <div className="pg-streak-bar-fill" style={{ width: `${streakPct}%` }} />
            <div className="pg-streak-bar-milestone" style={{ left: '100%' }}>
              <span className="pg-streak-bar-milestone-dot" />
            </div>
          </div>
          <div className="pg-streak-progress-text">{currentStreak} / {milestone} days</div>
          <div className="pg-streak-next">Next milestone: {milestone} days</div>
        </section>
      </div>

      {/* ── 3. Consistency heatmap ── */}
      <section className="pg-card pg-consistency-card">
        <div className="pg-card-header">
          <span className="pg-section-title">{'\uD83D\uDCC5'} STUDY CONSISTENCY</span>
          <span className="pg-heat-legend">
            Less
            <i className="pg-heat-cell l0" /><i className="pg-heat-cell l1" /><i className="pg-heat-cell l2" /><i className="pg-heat-cell l3" /><i className="pg-heat-cell l4" />
            More
          </span>
        </div>
        <div className="pg-heatgrid-wrap">
          <div className="pg-heatgrid">
            {heatWeeks.map((week, wi) => (
              <div className="pg-heat-col" key={wi}>
                {week.map((cell) => (
                  <span
                    className={`pg-heat-cell l${cell.level}`}
                    key={cell.key}
                    title={`${cell.key}: ${fmtHM(minutesByDate.get(cell.key) ?? 0)}`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 4. Subjects + Quiz performance ── */}
      <div className="pg-duo-row">
        {subjectRows.length ? (
          <section className="pg-card pg-subjects-card">
            <div className="pg-card-header">
              <span className="pg-section-title">{'\uD83D\uDCDA'} SUBJECT PERFORMANCE</span>
            </div>
            {subjectRows.map((s) => (
              <div key={s.name}>
                <button
                  className={'pg-subjects-row' + (openSubject === s.name ? ' open' : '')}
                  onClick={() => setOpenSubject(openSubject === s.name ? null : s.name)}
                >
                  <span className="pg-subjects-col-name">
                    <span className="pg-subject-dot" style={{ background: s.color || '#8b5cf6' }} />
                    {s.name}
                  </span>
                  <span className="pg-subjects-bar-track">
                    <span className="pg-subjects-bar-fill" style={{ width: `${s.percent}%`, background: s.color || '#8b5cf6' }} />
                  </span>
                  <span className="pg-subjects-pct">{s.percent}%</span>
                </button>
                {openSubject === s.name && (
                  <div className="pg-subj-detail">
                    <div><span>Study Time</span><strong>{fmtHM(s.studyMin)}</strong></div>
                    <div><span>Quiz Accuracy</span><strong>{s.quizAcc !== null ? `${s.quizAcc}%` : '\u2014'}</strong></div>
                    <div><span>Topics Completed</span><strong>{s.topics_completed}/{s.total_topics}</strong></div>
                    <div><span>Focus Sessions</span><strong>{s.sessionCount}</strong></div>
                    {s.strongest && <div><span>Strongest Topic</span><strong>{s.strongest.topic} {'\u2014'} {Math.round(((s.strongest.score ?? 0) / s.strongest.total_questions) * 100)}%</strong></div>}
                    {s.weakest && <div><span>Needs Practice</span><strong>{s.weakest.topic} {'\u2014'} {Math.round(((s.weakest.score ?? 0) / s.weakest.total_questions) * 100)}%</strong></div>}
                    <button className="pg-mini-btn" onClick={() => navigate('/subjects')}>View Subjects {'\u2192'}</button>
                  </div>
                )}
              </div>
            ))}
          </section>
        ) : null}

        <section className="pg-card pg-quiz-card">
          <div className="pg-card-header">
            <span className="pg-section-title">{'\uD83D\uDCDD'} QUIZ PERFORMANCE</span>
          </div>
          <div className="pg-kvlist">
            <div><span>Accuracy</span><strong>{answered ? `${accuracyPct}%` : '\u2014'}</strong></div>
            <div><span>Quizzes Completed</span><strong>{scoredQuizzes.length}</strong></div>
            <div><span>Questions Answered</span><strong>{answered}</strong></div>
            <div><span>Correct Answers</span><strong>{correct}</strong></div>
            <div><span>Average Score</span><strong>{avgScore} / 10</strong></div>
          </div>
          {accThisMonth !== null && accLastMonth !== null && (
            <div className="pg-quiz-trend">
              <div><span>Last month</span><strong>{accLastMonth}%</strong></div>
              <div><span>This month</span><strong>{accThisMonth}%</strong></div>
              <span className={`pg-quiz-delta ${accTrend! >= 0 ? 'up' : 'down'}`}>
                {accTrend! >= 0 ? '\u2191' : '\u2193'} {Math.abs(accTrend!)}%
              </span>
            </div>
          )}
          <button className="pg-mini-btn" onClick={() => navigate('/quiz')}>View Quizzes {'\u2192'}</button>
        </section>
      </div>

      {/* ── 5. Focus + Goals ── */}
      <div className="pg-duo-row">
        <section className="pg-card pg-focus-card">
          <div className="pg-card-header">
            <span className="pg-section-title">{'\u23F1\uFE0F'} FOCUS PERFORMANCE</span>
          </div>
          <div className="pg-kvlist">
            <div><span>Total Sessions</span><strong>{sessions.length}</strong></div>
            <div><span>Completed</span><strong>{completedSessions.length}</strong></div>
            <div><span>Average Session</span><strong>{avgSession} min</strong></div>
            <div><span>Focus Rate</span><strong>{focusRate}%</strong></div>
          </div>
          <div className="pg-focus-ratebar">
            <div className="pg-focus-ratebar-fill" style={{ width: `${focusRate}%` }} />
          </div>
          <div className="pg-besttime">
            <span>Best study time</span>
            <strong>{bestTime.label}</strong>
            <em>{bestTime.avg ? `\u2248 ${bestTime.avg} min average` : ''}</em>
          </div>
        </section>

        <section className="pg-card pg-goals-card">
          <div className="pg-card-header">
            <span className="pg-section-title">{'\uD83C\uDFAF'} GOAL PROGRESS</span>
          </div>
          {goals.map((g) => {
            const pct = g.target ? Math.min(100, Math.round((g.done / g.target) * 100)) : 0
            return (
              <div className="pg-goal-item" key={g.key}>
                <div className="pg-goal-head"><span>{g.title}</span><strong>{pct}%</strong></div>
                <div className="pg-goal-track"><div className="pg-goal-fill" style={{ width: `${pct}%` }} /></div>
                <div className="pg-goal-sub">{fmtHM(g.done)} / {fmtHM(g.target)}</div>
              </div>
            )
          })}
        </section>
      </div>

      {/* ── 6. Topics to improve ── */}
      {weakTopics.length ? (
        <section className="pg-card pg-topics-card">
          <div className="pg-card-header">
            <span className="pg-section-title">{'\u26A0\uFE0F'} TOPICS TO IMPROVE</span>
          </div>
          {weakTopics.map((t, i) => (
            <div className="pg-topic-row" key={t.topic}>
              <span className={`pg-topic-dot s${i === 0 ? 0 : i === 1 ? 1 : 2}`} />
              <span className="pg-topic-name">
                {t.topic}
                <em>
                  {t.accuracy}% quiz accuracy
                  {t.trend !== null && t.trend !== 0 ? ` \u00B7 ${t.trend > 0 ? '\u2191' : '\u2193'} ${Math.abs(t.trend)}% this month` : ''}
                </em>
              </span>
              <button className="pg-mini-btn" onClick={() => navigate('/quiz')}>Practice {'\u2192'}</button>
            </div>
          ))}
        </section>
      ) : null}

      {/* ── 7. Recent achievements ── */}
      {recentAchievements.length ? (
        <section className="pg-card pg-achstrip-card">
          <div className="pg-card-header">
            <span className="pg-section-title">{'\uD83C\uDFC6'} RECENT ACHIEVEMENTS</span>
            <button className="pg-mini-btn" onClick={() => navigate('/profile')}>View All {'\u2192'}</button>
          </div>
          <div className="pg-achstrip">
            {recentAchievements.map((a) => (
              <span className="pg-achchip" key={a.key}>{a.icon} {a.title}</span>
            ))}
          </div>
        </section>
      ) : null}

      {/* ── 8. AI progress insight ── */}
      <section className="pg-card pg-ai-card">
        <div className="pg-card-header">
          <span className="pg-ai-eyebrow">{'\u2726'} AI PROGRESS INSIGHT</span>
        </div>
        <div className="pg-ai-title">You{"\u2019"}re improving, {firstName}.</div>
        <div className="pg-ai-metrics">
          {aiMetrics.map((m) => (
            <div className="pg-ai-metric" key={m.label}>
              <span>{m.icon} {m.label}</span>
              <strong>{m.value}</strong>
            </div>
          ))}
        </div>
        <div className="pg-ai-body">
          {insightLines.map((line, i) => <p key={i}>{line}</p>)}
        </div>
        <div className="pg-ai-actions">
          <button className="pg-ai-btn" onClick={() => navigate('/planner')}>Start Recommended Plan</button>
          <button className="pg-mini-btn" onClick={() => navigate('/ai-tutor')}>Ask AI About My Progress</button>
        </div>
      </section>
    </PageShell>
  )
}
