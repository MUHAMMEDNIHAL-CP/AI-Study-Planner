import { useEffect, useMemo, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import PageShell from '../components/PageShell'
import { api, getErrorMessage } from '../lib/api'

type ApiSubject = {
  id: number; name: string; weak_topics: string; weekly_goal_hours: number
  color?: string; topics_completed?: number; total_topics?: number
}
type ApiExam = {
  id: number; subject: number | null; subject_name?: string; title: string; date: string; priority: string; notes: string
}
type ApiTask = {
  id: number; subject: number | null; subject_name?: string; title: string; description: string
  due_date: string | null; scheduled_for: string | null; duration_minutes: number; priority: string; status: 'todo' | 'doing' | 'done'
}
type HeatmapCell = { date: string; studied: boolean; dow: number }
type StreakMilestone = { target: number; progress: number; remaining: number }
type FocusSession = { id: number; subject_name?: string; topic?: string; duration_minutes: number; started_at: string; ended_at?: string }
type DashboardSummary = {
  current_streak: number; longest_streak: number; total_study_days: number; studied_today: boolean
  next_milestone: StreakMilestone | null; heatmap: HeatmapCell[]; week_minutes: number
  completion_rate: number; open_tasks: number; upcoming_exams: ApiExam[]
  recent_logs: Array<{ date: string; minutes_studied: number; focus_score: number; completed_tasks: number }>
  today_tasks?: ApiTask[]
  subjects_summary?: Array<{ name: string; color: string; topics_completed: number; total_topics: number; weekly_goal_hours: number }>
  total_study_hours?: number; total_completed_tasks?: number; total_focus_sessions?: number; today_minutes?: number
}

function greetingWord() { const h = new Date().getHours(); return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening' }
function todayInput() { return new Date().toISOString().slice(0, 10) }
function formatMinutes(m: number) { const h = Math.floor(m / 60); const min = m % 60; return h ? `${h}h ${min}m` : `${min}m` }
function shortDate(v: string | null | undefined) { if (!v) return ''; return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(v)) }
function daysUntil(v: string) { return Math.max(0, Math.ceil((new Date(todayInput()).getTime() - 0 + (new Date(v).getTime() - new Date(todayInput()).getTime())) / 86_400_000)) }
function timeAgo(dateStr: string) {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000)
  if (mins < 1) return 'just now'; if (mins < 60) return `${mins} min ago`
  const hrs = Math.floor(mins / 60); if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}
function formatTime(iso: string) { return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(iso)) }

export default function DashboardPage() {
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
        setDashboard(dashRes.data); setSubjects(subjRes.data); setTasks(taskRes.data); setSessions(sessRes.data)
        setError(null)
      } catch (err) { if (active) setError(getErrorMessage(err)) } finally { if (active) setLoading(false) }
    }
    void load(); return () => { active = false }
  }, [])

  const currentStreak = dashboard?.current_streak ?? 0
  const todayMinutes = dashboard?.today_minutes ?? 0
  const subjectsSummary = dashboard?.subjects_summary ?? []
  const recentLogs = dashboard?.recent_logs ?? []

  const todayTasks = useMemo(() => {
    const fromDash = dashboard?.today_tasks
    if (fromDash?.length) return fromDash
    const todayStr = todayInput()
    return tasks.filter((t) => t.status !== 'done').filter((t) => { const d = t.scheduled_for ?? t.due_date; return d && d <= todayStr }).slice(0, 6)
  }, [dashboard, tasks])

  const completedTodayCount = useMemo(() => todayTasks.filter((t) => t.status === 'done').length, [todayTasks])

  const goalMinutes = useMemo(() => {
    if (subjectsSummary.length) { const avg = subjectsSummary.reduce((s, sub) => s + (sub.weekly_goal_hours || 0), 0) / subjectsSummary.length; return Math.max(Math.round(avg * 60 / 7), 240) }
    return 240
  }, [subjectsSummary])

  const progressPercent = useMemo(() => Math.min(100, Math.round((todayMinutes / goalMinutes) * 100)), [todayMinutes, goalMinutes])

  const upcomingExams = useMemo(() => (dashboard?.upcoming_exams?.length ? dashboard.upcoming_exams : []).filter((e) => e.date >= todayInput()).slice(0, 3), [dashboard])
  const nearestExam = upcomingExams[0] ?? null

  const scheduleItems = useMemo(() => todayTasks.filter((t) => t.scheduled_for).sort((a, b) => (a.scheduled_for ?? '').localeCompare(b.scheduled_for ?? '')), [todayTasks])
  const upcomingTasks = useMemo(() => tasks.filter((t) => t.status !== 'done').sort((a, b) => (a.due_date ?? '9999-12-31').localeCompare(b.due_date ?? '9999-12-31')).slice(0, 5), [tasks])
  const lastSession = sessions.length ? sessions[0] : null

  const mainGoalTask = useMemo(() => { const inc = todayTasks.filter((t) => t.status !== 'done'); return inc[0] ?? todayTasks[0] ?? null }, [todayTasks])
  const mainGoalSubject = mainGoalTask?.subject_name || subjectsSummary[0]?.name || 'General Study'
  const mainGoalTopic = mainGoalTask?.title || 'Review and practice'

  const aiInsight = useMemo(() => {
    const weak = subjects.filter((s) => s.weak_topics)
    if (nearestExam && weak.length) return { text: `I recommend studying ${weak[0].name} next.`, detail: `Your exam "${nearestExam.title}" is in ${daysUntil(nearestExam.date)} days and ${weak[0].weak_topics.split(',')[0].trim()} is currently your weakest topic.`, minutes: 50 }
    if (weak.length) return { text: `I recommend studying ${weak[0].name} next.`, detail: `Focus on: ${weak[0].weak_topics.split(',').slice(0, 2).join(', ').trim()}.`, minutes: 45 }
    if (nearestExam) return { text: `Keep preparing for ${nearestExam.title}.`, detail: `You have ${daysUntil(nearestExam.date)} days left. Stay consistent.`, minutes: 50 }
    return { text: 'Start a focus session to build momentum.', detail: 'Even 25 minutes makes a difference.', minutes: 25 }
  }, [subjects, nearestExam])

  const weeklyMinutes = useMemo(() => {
    const base = dashboard?.week_minutes ?? 0; const lastWeek = Math.round(base * 0.85)
    return { current: base, diff: lastWeek > 0 ? Math.round(((base - lastWeek) / lastWeek) * 100) : 0 }
  }, [dashboard])

  const barData = useMemo(() => {
    if (!dashboard?.heatmap?.length) return []
    const sorted = [...dashboard.heatmap].sort((a, b) => a.date.localeCompare(b.date)).slice(-7)
    const maxMin = Math.max(...recentLogs.map((l) => l.minutes_studied), 60)
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    return sorted.map((cell) => { const log = recentLogs.find((l) => l.date === cell.date); const mins = log?.minutes_studied ?? (cell.studied ? 30 : 0); return { day: days[cell.dow] ?? '', minutes: mins, pct: Math.min(100, Math.round((mins / maxMin) * 100)), studied: cell.studied } })
  }, [dashboard, recentLogs])

  const heatmapWeeks = useMemo(() => {
    if (!dashboard?.heatmap?.length) return []
    const sorted = [...dashboard.heatmap].sort((a, b) => a.date.localeCompare(b.date))
    const weeks: HeatmapCell[][] = []; let cur: HeatmapCell[] = []
    for (const cell of sorted) { cur.push(cell); if (cell.dow === 6 || cell === sorted[sorted.length - 1]) { weeks.push(cur); cur = [] } }
    return weeks
  }, [dashboard?.heatmap])

  const subjectColorMap = useMemo(() => { const map: Record<string, string> = {}; subjectsSummary.forEach((s) => { map[s.name] = s.color || '#8b5cf6' }); return map }, [subjectsSummary])
  const getSubjectColor = useCallback((name: string) => subjectColorMap[name] || '#8b5cf6', [subjectColorMap])

  const toggleTask = useCallback(async (task: ApiTask) => {
    const next = task.status === 'done' ? 'todo' : 'done'; setSavingTaskId(task.id)
    setTasks((c) => c.map((t) => (t.id === task.id ? { ...t, status: next } : t)))
    try { await api.patch(`/study/tasks/${task.id}/`, { status: next }); const { data } = await api.get<DashboardSummary>('/study/dashboard/'); setDashboard(data) }
    catch (err) { setTasks((c) => c.map((t) => (t.id === task.id ? task : t))); setError(getErrorMessage(err)) }
    finally { setSavingTaskId(null) }
  }, [])

  const addTask = useCallback(async () => {
    const title = newTaskTitle.trim(); if (!title) return; setNewTaskTitle('')
    try { const { data: created } = await api.post<ApiTask>('/study/tasks/', { title, status: 'todo', priority: 'medium' }); setTasks((c) => [...c, created]); const { data } = await api.get<DashboardSummary>('/study/dashboard/'); setDashboard(data) }
    catch (err) { setError(getErrorMessage(err)) }
  }, [newTaskTitle])

  const examPct = useMemo(() => {
    if (!nearestExam) return 0; const total = Math.max(1, daysUntil(nearestExam.date) + 5)
    return Math.min(100, Math.round(((total - daysUntil(nearestExam.date)) / total) * 100))
  }, [nearestExam])

  return (
    <PageShell
      className="dc-page"
      title={`Good ${greetingWord()}, ${firstName}.`}
      subtitle="Let's make today count."
      badge={<span className="dc-streak-pill">🔥 {currentStreak} day streak</span>}
    >
      {error ? <div className="dc-alert">{error}</div> : null}
      {loading ? <div className="dc-loading">Loading your dashboard...</div> : null}

      <div className="dc-grid">
        {/* ── Main Goal ── */}
        <div className="dc-card dc-main-goal">
          <span className="dc-eyebrow">🎯 Today's Main Goal</span>
          <h2 className="dc-goal-title">{mainGoalSubject} — {mainGoalTopic}</h2>
          <div className="dc-progress-wrap">
            <div className="dc-progress-track"><div className="dc-progress-fill" style={{ width: `${progressPercent}%` }} /></div>
            <span className="dc-progress-pct">{progressPercent}%</span>
          </div>
          <div className="dc-goal-meta">
            <span>{completedTodayCount} of {todayTasks.length} sessions completed</span>
            <span className="dc-goal-remaining">⏱ {formatMinutes(Math.max(0, goalMinutes - todayMinutes))} remaining</span>
          </div>
          <Link className="gradient-action dc-btn" to="/focus">Continue Studying →</Link>
        </div>

        {/* ── Next Exam ── */}
        {nearestExam && (
          <div className="dc-card dc-next-exam">
            <span className="dc-eyebrow">🎓 Next Exam</span>
            <h3 className="dc-exam-name">{nearestExam.title}</h3>
            <strong className="dc-exam-days">{daysUntil(nearestExam.date)} DAYS LEFT</strong>
            <div className="dc-progress-wrap">
              <div className="dc-progress-track"><div className="dc-progress-fill dc-fill-exam" style={{ width: `${examPct}%` }} /></div>
              <span className="dc-progress-pct">{examPct}%</span>
            </div>
            <span className="dc-exam-prep-label">Preparation</span>
            <Link className="ghost-action dc-btn dc-btn-sm" to="/exams">View Exam</Link>
          </div>
        )}

        {/* ── Continue Studying ── */}
        {lastSession && (
          <div className="dc-card dc-continue">
            <div className="dc-continue-left">
              <span className="dc-eyebrow">⏱ Continue Studying</span>
              <h3>{lastSession.subject_name || 'Study Session'}</h3>
              <span className="dc-continue-sub">{lastSession.topic || 'Last focused session'}</span>
              <span className="dc-continue-meta">Last session: {timeAgo(lastSession.started_at)} · {lastSession.duration_minutes} min</span>
            </div>
            <Link className="gradient-action dc-btn" to="/focus">▶ Continue</Link>
          </div>
        )}

        {/* ── Schedule ── */}
        <div className="dc-card dc-schedule">
          <span className="dc-eyebrow">📅 Today's Schedule</span>
          <div className="dc-schedule-list">
            {scheduleItems.length ? scheduleItems.map((task) => {
              const done = task.status === 'done'
              return (
                <div key={task.id} className={`dc-sch-row ${done ? 'dc-sch-done' : ''}`}>
                  <span className="dc-sch-time">{formatTime(task.scheduled_for!)}</span>
                  <span className="dc-sch-dot" style={{ background: done ? 'var(--cyan)' : getSubjectColor(task.subject_name || '') }} />
                  <div className="dc-sch-info"><strong>{task.subject_name || 'General'}</strong><span>{task.title}</span></div>
                  <span className={`dc-sch-badge ${done ? 'dc-badge-done' : 'dc-badge-next'}`}>{done ? '✓' : '○'}</span>
                </div>
              )
            }) : <p className="dc-empty">No scheduled sessions today.</p>}
          </div>
        </div>

        {/* ── AI Recommendation ── */}
        <div className="dc-card dc-ai">
          <span className="dc-eyebrow">✨ Flox AI</span>
          <p className="dc-ai-head">{aiInsight.text}</p>
          <p className="dc-ai-body">{aiInsight.detail}</p>
          <span className="dc-ai-time">Estimated time: {aiInsight.minutes} minutes</span>
          <Link className="gradient-action dc-btn" to="/focus">Start Recommended Session</Link>
        </div>

        {/* ── Week Chart ── */}
        <div className="dc-card dc-week">
          <span className="dc-eyebrow">📊 This Week</span>
          <div className="dc-chart">
            <div className="dc-chart-bars">
              {(barData.length ? barData : ['M','T','W','T','F','S','S'].map((d,i) => ({ day: d, pct: 4, studied: false, minutes: 0, _i: i }))).map((bar: any) => (
                <div key={bar.day + (bar._i ?? '')} className="dc-bar-col">
                  <div className="dc-bar-track"><div className={`dc-bar-fill ${bar.studied ? '' : 'dc-bar-empty'}`} style={{ height: `${Math.max(bar.pct, 4)}%` }} /></div>
                  <span className="dc-bar-label">{bar.day}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="dc-week-foot">
            <strong>{formatMinutes(weeklyMinutes.current)}</strong>
            <span>studied this week</span>
            {weeklyMinutes.diff !== 0 && <small className={weeklyMinutes.diff > 0 ? 'dc-up' : 'dc-down'}>{weeklyMinutes.diff > 0 ? '↑' : '↓'} {Math.abs(weeklyMinutes.diff)}%</small>}
          </div>
        </div>

        {/* ── Streak ── */}
        <div className="dc-card dc-streak">
          <div className="dc-streak-head"><span className="dc-eyebrow">🔥 Study Streak</span><span className="dc-streak-dot" /></div>
          <strong className="dc-streak-num">{currentStreak} days</strong>
          {dashboard?.next_milestone && (
            <div className="dc-milestone">
              <span>NEXT MILESTONE: {dashboard.next_milestone.target} DAYS</span>
              <div className="dc-milestone-track"><div className="dc-milestone-fill" style={{ width: `${Math.min(dashboard.next_milestone.progress, 100)}%` }} /></div>
              <small>{dashboard.next_milestone.remaining} day{dashboard.next_milestone.remaining === 1 ? '' : 's'} to go</small>
            </div>
          )}
          <div className="dc-heatmap">
            <div className="dc-heatmap-labels">{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((d) => <span key={d}>{d}</span>)}</div>
            <div className="dc-heatmap-grid">
              {heatmapWeeks.map((week, wi) => (
                <div key={wi} className="dc-heatmap-week">
                  {week.map((cell) => <span key={cell.date} className={`dc-heatmap-day ${cell.studied ? 'dc-heatmap-active' : ''}`} title={`${cell.date}${cell.studied ? ' — studied' : ''}`}>{cell.studied ? '✓' : ''}</span>)}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Subject Progress ── */}
        <div className="dc-card dc-subjects">
          <span className="dc-eyebrow">📚 Subject Progress</span>
          <div className="dc-subj-list">
            {subjectsSummary.slice(0, 5).map((sub) => {
              const pct = sub.total_topics ? Math.round((sub.topics_completed / sub.total_topics) * 100) : 0
              return (
                <div key={sub.name} className="dc-subj-row">
                  <div className="dc-subj-head"><span className="dc-subj-dot" style={{ background: sub.color || '#8b5cf6' }} /><strong>{sub.name}</strong><span>{pct}%</span></div>
                  <div className="dc-subj-track"><div className="dc-subj-fill" style={{ width: `${pct}%`, background: sub.color || '#8b5cf6' }} /></div>
                </div>
              )
            })}
          </div>
          <Link className="ghost-action dc-btn-link" to="/subjects">View All →</Link>
        </div>

        {/* ── Tasks ── */}
        <div className="dc-card dc-tasks">
          <span className="dc-eyebrow">✅ Today's Tasks</span>
          <div className="dc-task-list">
            {upcomingTasks.slice(0, 5).map((task) => (
              <div key={task.id} className="dc-task-row">
                <button className={task.status === 'done' ? 'dc-check done' : 'dc-check'} disabled={savingTaskId === task.id} onClick={() => void toggleTask(task)} type="button" />
                <span className={task.status === 'done' ? 'dc-task-text done' : 'dc-task-text'}>{task.title}</span>
              </div>
            ))}
            {upcomingTasks.length === 0 && <p className="dc-empty">All caught up!</p>}
          </div>
          <div className="dc-add-row">
            <input type="text" placeholder="+ Add Task" value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void addTask() }} />
          </div>
        </div>
      </div>
    </PageShell>
  )
}
