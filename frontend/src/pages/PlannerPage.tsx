import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { toast } from 'react-toastify'
import PageShell from '../components/PageShell'
import { IconPlanner, IconSpark } from '../components/icons'
import { api, getErrorMessage } from '../lib/api'

type Subject = {
  id: number
  name: string
  weekly_goal_hours: number
  weak_topics: string
  topics_completed: number
  total_topics: number
}

type Exam = {
  id: number
  title: string
  date: string
  priority: string
  subject_name?: string
  subject?: number | null
}

type Task = {
  id: number
  title: string
  description: string
  status: string
  duration_minutes: number
  subject_name?: string
  subject?: number | null
  due_date?: string
  scheduled_for?: string
  priority?: string
}

type PlanBlock = {
  time: string
  subject: string
  duration_minutes: number | string
  task: string
}

type PlanResponse = {
  provider?: string
  goal: string
  focus_tip: string
  plan: PlanBlock[]
  revision_schedule: string[]
}

type ViewMode = 'day' | 'week' | 'month'
type ModalKind = 'session' | 'ai' | null

const HOURS = Array.from({ length: 16 }, (_, i) => i + 6)
const DURATION_OPTIONS = [25, 35, 45, 50, 60, 90, 120]
const SUBJECT_COLORS = [
  '#6366f1', '#ec4899', '#f59e0b', '#10b981',
  '#3b82f6', '#8b5cf6', '#ef4444', '#14b8a6',
  '#f97316', '#06b6d4', '#a855f7', '#84cc16',
]
const PRIORITY_OPTIONS = ['high', 'medium', 'low'] as const

function toLocalDateInput(date = new Date()): string {
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}

function daysUntil(dateString: string): number {
  const target = new Date(`${dateString}T00:00:00`)
  const now = new Date(`${toLocalDateInput()}T00:00:00`)
  return Math.max(0, Math.ceil((target.getTime() - now.getTime()) / 86_400_000))
}

function shortDate(dateString?: string): string {
  if (!dateString) return 'No date'
  return new Date(`${dateString}T00:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

function minutesLabel(minutes: number | string): string {
  const n = Number(minutes)
  if (!Number.isFinite(n)) return `${minutes} min`
  if (n >= 60) {
    const h = Math.floor(n / 60)
    const m = n % 60
    return m ? `${h}h ${m}m` : `${h}h`
  }
  return `${n} min`
}

function getHourFromScheduled(scheduledFor?: string): number | null {
  if (!scheduledFor) return null
  const date = new Date(scheduledFor)
  if (isNaN(date.getTime())) return null
  return date.getHours()
}

function getWeekDays(dateStr: string): { date: string; dayName: string; dayNum: number; isToday: boolean }[] {
  const d = new Date(`${dateStr}T12:00:00`)
  const dayOfWeek = d.getDay()
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const monday = new Date(d)
  monday.setDate(d.getDate() + mondayOffset)
  const today = toLocalDateInput()
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(monday)
    day.setDate(monday.getDate() + i)
    const date = toLocalDateInput(day)
    return {
      date,
      dayName: day.toLocaleDateString(undefined, { weekday: 'short' }),
      dayNum: day.getDate(),
      isToday: date === today,
    }
  })
}

function getSubjectColor(subjectId: number | null | undefined, subjects: Subject[]): string {
  if (subjectId == null) return SUBJECT_COLORS[0]
  const index = subjects.findIndex((s) => s.id === subjectId)
  return SUBJECT_COLORS[Math.max(0, index) % SUBJECT_COLORS.length]
}

function formatFullDate(dateStr: string): string {
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function navigateDate(dateStr: string, direction: -1 | 1, view: ViewMode): string {
  const d = new Date(`${dateStr}T12:00:00`)
  if (view === 'day') d.setDate(d.getDate() + direction)
  else if (view === 'week') d.setDate(d.getDate() + direction * 7)
  else d.setMonth(d.getMonth() + direction)
  return toLocalDateInput(d)
}

function monthGrid(year: number, month: number) {
  const first = new Date(year, month, 1)
  const totalDays = new Date(year, month + 1, 0).getDate()
  const blanks = first.getDay()
  return {
    label: first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
    cells: [
      ...Array.from({ length: blanks }, () => null),
      ...Array.from({ length: totalDays }, (_, i) => {
        const d = new Date(year, month, i + 1)
        return toLocalDateInput(d)
      }),
    ],
  }
}

function priorityColor(priority?: string): string {
  if (priority === 'high') return '#ef4444'
  if (priority === 'low') return '#3b82f6'
  return '#f59e0b'
}

export default function PlannerPage() {
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [exams, setExams] = useState<Exam[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [viewMode, setViewMode] = useState<ViewMode>('day')
  const [selectedDate, setSelectedDate] = useState(toLocalDateInput())
  const [plan, setPlan] = useState<PlanResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [planLoading, setPlanLoading] = useState(false)
  const [modal, setModal] = useState<ModalKind>(null)

  const [sessionSubject, setSessionSubject] = useState('')
  const [sessionTopic, setSessionTopic] = useState('')
  const [sessionDate, setSessionDate] = useState(toLocalDateInput())
  const [sessionTime, setSessionTime] = useState('09:00')
  const [sessionDuration, setSessionDuration] = useState(45)
  const [sessionPriority, setSessionPriority] = useState<'high' | 'medium' | 'low'>('medium')
  const [sessionNotes, setSessionNotes] = useState('')

  const [aiExamDate, setAiExamDate] = useState(toLocalDateInput())
  const [aiDailyHours, setAiDailyHours] = useState(4)
  const [aiWeakSubject, setAiWeakSubject] = useState('')
  const [aiStrongSubject, setAiStrongSubject] = useState('')

  const today = toLocalDateInput()

  const upcomingExams = useMemo(
    () =>
      [...exams]
        .filter((e) => new Date(e.date) >= new Date(today))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(0, 5),
    [exams, today],
  )

  const todayTasks = useMemo(
    () =>
      tasks.filter((t) => {
        if (t.scheduled_for) {
          return t.scheduled_for.slice(0, 10) === selectedDate
        }
        return t.due_date === selectedDate && t.status !== 'done'
      }),
    [tasks, selectedDate],
  )

  const weekTasks = useMemo(() => {
    const days = getWeekDays(selectedDate)
    const start = days[0].date
    const end = days[6].date
    return tasks.filter((t) => {
      const ref = t.scheduled_for?.slice(0, 10) ?? t.due_date
      return ref && ref >= start && ref <= end
    })
  }, [tasks, selectedDate])

  const monthTasks = useMemo(() => {
    const d = new Date(`${selectedDate}T12:00:00`)
    const year = d.getFullYear()
    const month = d.getMonth()
    return tasks.filter((t) => {
      const ref = t.scheduled_for ?? t.due_date
      if (!ref) return false
      const rd = new Date(ref)
      return rd.getFullYear() === year && rd.getMonth() === month
    })
  }, [tasks, selectedDate])

  const completedCount = tasks.filter((t) => t.status === 'done').length
  const completionRate = tasks.length ? Math.round((completedCount / tasks.length) * 100) : 0

  const weekStart = getWeekDays(selectedDate)[0].date
  const weekEnd = getWeekDays(selectedDate)[6].date
  const weekSessions = tasks.filter(
    (t) =>
      t.scheduled_for &&
      t.scheduled_for.slice(0, 10) >= weekStart &&
      t.scheduled_for.slice(0, 10) <= weekEnd,
  )
  const weekHours = weekSessions.reduce((sum, t) => sum + (t.duration_minutes || 0), 0) / 60

  const dayTaskCount = todayTasks.length
  const dayHours = todayTasks.reduce((sum, t) => sum + (t.duration_minutes || 0), 0) / 60

  const calendarInfo = useMemo(() => {
    const d = new Date(`${selectedDate}T12:00:00`)
    return monthGrid(d.getFullYear(), d.getMonth())
  }, [selectedDate])

  const monthTaskDates = useMemo(() => {
    const set = new Set<string>()
    monthTasks.forEach((t) => {
      const ref = t.scheduled_for?.slice(0, 10) ?? t.due_date
      if (ref) set.add(ref)
    })
    return set
  }, [monthTasks])

  const weekDays = useMemo(() => getWeekDays(selectedDate), [selectedDate])

  const planBlocks = plan?.plan ?? []

  const loadPlanner = useCallback(async () => {
    const [subjectRes, examRes, taskRes] = await Promise.all([
      api.get<Subject[]>('/study/subjects/'),
      api.get<Exam[]>('/study/exams/'),
      api.get<Task[]>('/study/tasks/'),
    ])
    setSubjects(subjectRes.data)
    setExams(examRes.data)
    setTasks(taskRes.data)
  }, [])

  useEffect(() => {
    let active = true
    async function init() {
      try {
        await loadPlanner()
      } catch (err) {
        if (active) toast.error(getErrorMessage(err))
      } finally {
        if (active) setLoading(false)
      }
    }
    void init()
    return () => { active = false }
  }, [loadPlanner])

  function resetSessionForm() {
    setSessionSubject('')
    setSessionTopic('')
    setSessionDate(toLocalDateInput())
    setSessionTime('09:00')
    setSessionDuration(45)
    setSessionPriority('medium')
    setSessionNotes('')
  }

  function resetAiForm() {
    setAiExamDate(toLocalDateInput())
    setAiDailyHours(4)
    setAiWeakSubject('')
    setAiStrongSubject('')
  }

  async function handleCreateSession(e: FormEvent) {
    e.preventDefault()
    try {
      const subjectId = sessionSubject ? Number(sessionSubject) : null
      const subjectObj = subjects.find((s) => s.id === subjectId)
      const title = sessionTopic.trim() || (subjectObj ? `${subjectObj.name} session` : 'Study session')
      const scheduledFor = `${sessionDate}T${sessionTime}:00`
      await api.post('/study/tasks/', {
        title,
        description: sessionNotes.trim(),
        subject: subjectId,
        due_date: sessionDate,
        scheduled_for: scheduledFor,
        duration_minutes: sessionDuration,
        priority: sessionPriority,
        status: 'todo',
      })
      toast.success('Study session created')
      setModal(null)
      resetSessionForm()
      await loadPlanner()
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  async function handleAiGenerate(e: FormEvent) {
    e.preventDefault()
    setPlanLoading(true)
    try {
      const weakSubj = subjects.find((s) => s.id === Number(aiWeakSubject))
      const strongSubj = subjects.find((s) => s.id === Number(aiStrongSubject))
      const { data } = await api.post<PlanResponse>('/study/plan/generate/', {
        subjects: subjects.map((s) => s.name),
        weak_topics: weakSubj?.weak_topics || 'priority weak topics',
        daily_hours: aiDailyHours,
        exam_date: aiExamDate,
        goal: `Focus on ${weakSubj?.name || 'weak areas'}, leverage ${strongSubj?.name || 'strong subjects'}`,
      })
      setPlan(data)
      toast.success('AI plan generated')
      setModal(null)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setPlanLoading(false)
    }
  }

  async function toggleTask(task: Task) {
    const next = task.status === 'done' ? 'todo' : 'done'
    setTasks((cur) => cur.map((t) => (t.id === task.id ? { ...t, status: next } : t)))
    try {
      await api.patch(`/study/tasks/${task.id}/`, { status: next })
    } catch (err) {
      toast.error(getErrorMessage(err))
      await loadPlanner()
    }
  }

  async function deleteTask(taskId: number) {
    try {
      await api.delete(`/study/tasks/${taskId}/`)
      toast.success('Task removed')
      await loadPlanner()
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  if (loading) {
    return (
      <PageShell eyebrow="Study Planner" title="Plan Your Study" subtitle="Loading your planner...">
        <div className="page-card" style={{ padding: '2rem', textAlign: 'center', opacity: 0.6 }}>
          Loading planner workspace...
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell
      eyebrow="Study Planner"
      title="Plan Your Study"
      subtitle="Build your schedule."
    >
      <div className="pl-actions">
        <button className="pl-action-btn" onClick={() => { resetSessionForm(); setModal('session') }} type="button">
          <IconPlanner size={16} /> + Create Session
        </button>
        <button className="pl-action-btn pl-action-ghost" onClick={() => { resetAiForm(); setModal('ai') }} type="button">
          <IconSpark size={16} /> AI Generate
        </button>
      </div>

      <div className="pl-view-toggle">
        {(['day', 'week', 'month'] as ViewMode[]).map((mode) => (
          <button
            key={mode}
            className={`pl-view-btn ${viewMode === mode ? 'pl-view-active' : ''}`}
            onClick={() => setViewMode(mode)}
            type="button"
          >
            {mode.charAt(0).toUpperCase() + mode.slice(1)}
          </button>
        ))}
      </div>

      <div className="cal-nav planner-cal-nav">
        <button className="cal-nav-btn" onClick={() => setSelectedDate(navigateDate(selectedDate, -1, viewMode))} type="button">&#8249;</button>
        <div className="cal-nav-center">
          <span className="cal-nav-title">
            {viewMode === 'day' && formatFullDate(selectedDate)}
            {viewMode === 'week' && `${shortDate(weekStart)} – ${shortDate(weekEnd)}`}
            {viewMode === 'month' && calendarInfo.label}
          </span>
          <button className="cal-today-btn" onClick={() => setSelectedDate(toLocalDateInput())} type="button">Today</button>
        </div>
        <button className="cal-nav-btn" onClick={() => setSelectedDate(navigateDate(selectedDate, 1, viewMode))} type="button">&#8250;</button>
      </div>

      {planBlocks.length > 0 && (
        <div className="pl-card pl-plan-card">
          <div className="pl-plan-header">
            <IconSpark size={18} />
            <span className="eyebrow">AI Generated Plan</span>
          </div>
          {plan && <p className="pl-plan-tip">{plan.focus_tip}</p>}
          <div className="pl-plan-list">
            {planBlocks.map((block, i) => (
              <div key={`${block.time}-${i}`} className="pl-plan-block">
                <span className="pl-plan-time">{block.time}</span>
                <span className="pl-plan-subject">{block.subject}</span>
                <span className="pl-plan-dur">{minutesLabel(block.duration_minutes)}</span>
                <span className="pl-plan-task">{block.task}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {viewMode === 'day' && (
        <div className="pl-day-layout">
          <div className="pl-card pl-timeline">
            <h3 className="pl-card-title">Daily Schedule</h3>
            <div className="pl-timeline-grid">
              {HOURS.map((hour) => {
                const hourTasks = todayTasks.filter((t) => getHourFromScheduled(t.scheduled_for) === hour)
                const label = `${String(hour).padStart(2, '0')}:00`
                return (
                  <div key={hour} className="pl-timeline-row">
                    <span className="pl-timeline-hour">{label}</span>
                    <div className="pl-timeline-cell">
                      {hourTasks.length === 0 ? (
                        <div className="pl-timeline-empty" />
                      ) : (
                        hourTasks.map((task) => (
                          <div
                            key={task.id}
                            className="pl-timeline-task"
                            style={{ borderLeftColor: getSubjectColor(task.subject, subjects) }}
                          >
                            <div className="pl-timeline-task-info">
                              <span className="pl-timeline-task-subject">{task.subject_name || 'Study'}</span>
                              <span className="pl-timeline-task-title">{task.title}</span>
                            </div>
                            <span className="pl-timeline-task-dur" style={{ background: getSubjectColor(task.subject, subjects) + '22', color: getSubjectColor(task.subject, subjects) }}>
                              {minutesLabel(task.duration_minutes)}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="pl-day-summary">
              {dayTaskCount} session{dayTaskCount !== 1 ? 's' : ''} planned · {dayHours.toFixed(1)} hours
            </div>
          </div>

          <div className="pl-sidebar">
            <div className="pl-card pl-exam-card">
              <h3 className="pl-card-title">Exam Countdown</h3>
              {upcomingExams.length === 0 ? (
                <p className="pl-empty-text">No upcoming exams.</p>
              ) : (
                <div className="pl-exam-list">
                  {upcomingExams.map((exam) => {
                    const days = daysUntil(exam.date)
                    return (
                      <div key={exam.id} className="pl-exam-item">
                        <div className="pl-exam-info">
                          <span className="pl-exam-name">{exam.title}</span>
                          <span className="pl-exam-meta">{exam.subject_name || 'General'} · {shortDate(exam.date)}</span>
                        </div>
                        <span className={`pl-exam-badge ${days <= 3 ? 'pl-badge-urgent' : days <= 7 ? 'pl-badge-warn' : 'pl-badge-ok'}`}>
                          {days}d
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="pl-card pl-stats-card">
              <h3 className="pl-card-title">This Week</h3>
              <div className="pl-stats-list">
                {[
                  { label: 'Sessions', value: weekSessions.length },
                  { label: 'Total hours', value: `${weekHours.toFixed(1)}h` },
                  { label: 'Completion', value: `${completionRate}%` },
                ].map((stat) => (
                  <div key={stat.label} className="pl-stat-row">
                    <span className="pl-stat-label">{stat.label}</span>
                    <span className="pl-stat-value">{stat.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {viewMode === 'week' && (
        <div className="pl-card pl-week-wrap">
          <div className="pl-week-grid">
            {weekDays.map((day) => {
              const dayTasks = weekTasks.filter((t) => {
                const ref = t.scheduled_for?.slice(0, 10) ?? t.due_date
                return ref === day.date
              })
              return (
                <div key={day.date} className="pl-week-col">
                  <div className={`pl-week-header ${day.isToday ? 'pl-week-today' : ''}`}>
                    <span className="pl-week-dayname">{day.dayName}</span>
                    <span className="pl-week-daynum">{day.dayNum}</span>
                  </div>
                  <div className="pl-week-tasks">
                    {dayTasks.length === 0 ? (
                      <div className="pl-week-empty" />
                    ) : (
                      dayTasks.map((task) => (
                        <div key={task.id} className="pl-week-task" style={{ borderLeftColor: getSubjectColor(task.subject, subjects), background: getSubjectColor(task.subject, subjects) + '14' }}>
                          <span className="pl-week-task-name">{task.subject_name || 'Study'}</span>
                          <span className="pl-week-task-title">{task.title}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {viewMode === 'month' && (
        <div className="pl-card pl-month-wrap">
          <div className="pl-month-header">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="pl-month-dow">{d}</div>
            ))}
          </div>
          <div className="pl-month-grid">
            {calendarInfo.cells.map((cell, i) => {
              const hasSession = cell ? monthTaskDates.has(cell) : false
              const isToday = cell === today
              return (
                <button
                  key={i}
                  disabled={!cell}
                  className={`pl-month-cell ${isToday ? 'pl-month-today' : ''} ${!cell ? 'pl-month-blank' : ''}`}
                  onClick={() => { if (cell) { setSelectedDate(cell); setViewMode('day') } }}
                  type="button"
                >
                  <span>{cell ? cell.split('-')[2].replace(/^0/, '') : ''}</span>
                  {hasSession && <span className="pl-month-dot" />}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {modal === 'session' && (
        <div className="cal-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setModal(null) }}>
          <div className="cal-modal" onMouseDown={(e) => e.stopPropagation()}>
            <h3>New Study Session</h3>
            <form onSubmit={handleCreateSession} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="cal-modal-field">
                <label>Subject</label>
                <select value={sessionSubject} onChange={(e) => setSessionSubject(e.target.value)}>
                  <option value="">Select subject</option>
                  {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="cal-modal-field">
                <label>Topic</label>
                <input placeholder="e.g. Review chapter 5 notes" value={sessionTopic} onChange={(e) => setSessionTopic(e.target.value)} />
              </div>
              <div className="cal-modal-row">
                <div className="cal-modal-field"><label>Date</label><input type="date" value={sessionDate} onChange={(e) => setSessionDate(e.target.value)} /></div>
                <div className="cal-modal-field"><label>Start Time</label><input type="time" value={sessionTime} onChange={(e) => setSessionTime(e.target.value)} /></div>
              </div>
              <div className="cal-modal-field">
                <label>Duration</label>
                <select value={sessionDuration} onChange={(e) => setSessionDuration(Number(e.target.value))}>
                  {DURATION_OPTIONS.map((d) => <option key={d} value={d}>{minutesLabel(d)}</option>)}
                </select>
              </div>
              <div className="cal-modal-field">
                <label>Priority</label>
                <div className="pl-priority-row">
                  {PRIORITY_OPTIONS.map((p) => (
                    <button key={p} type="button" onClick={() => setSessionPriority(p)}
                      className={`pl-priority-btn ${sessionPriority === p ? 'pl-priority-active' : ''}`}
                      style={sessionPriority === p ? { borderColor: priorityColor(p), background: priorityColor(p) + '18' } : {}}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <div className="cal-modal-field"><label>Notes</label><textarea placeholder="Optional notes..." value={sessionNotes} onChange={(e) => setSessionNotes(e.target.value)} rows={3} /></div>
              <div className="cal-modal-actions">
                <button type="button" className="cal-modal-cancel" onClick={() => setModal(null)}>Cancel</button>
                <button type="submit" className="cal-modal-create">Create Session</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modal === 'ai' && (
        <div className="cal-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setModal(null) }}>
          <div className="cal-modal" onMouseDown={(e) => e.stopPropagation()}>
            <h3>Generate Study Plan</h3>
            <form onSubmit={handleAiGenerate} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="cal-modal-field"><label>Exam Date</label><input type="date" value={aiExamDate} onChange={(e) => setAiExamDate(e.target.value)} /></div>
              <div className="cal-modal-field"><label>Available Time per Day (hours)</label><input type="number" min={1} max={16} value={aiDailyHours} onChange={(e) => setAiDailyHours(Number(e.target.value))} /></div>
              <div className="cal-modal-row">
                <div className="cal-modal-field">
                  <label>Weak Subject</label>
                  <select value={aiWeakSubject} onChange={(e) => setAiWeakSubject(e.target.value)}>
                    <option value="">Select subject</option>
                    {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="cal-modal-field">
                  <label>Strong Subject</label>
                  <select value={aiStrongSubject} onChange={(e) => setAiStrongSubject(e.target.value)}>
                    <option value="">Select subject</option>
                    {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="cal-modal-actions">
                <button type="button" className="cal-modal-cancel" onClick={() => setModal(null)}>Cancel</button>
                <button type="submit" className="cal-modal-create" disabled={planLoading}>{planLoading ? 'Generating...' : 'Generate Plan'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PageShell>
  )
}
