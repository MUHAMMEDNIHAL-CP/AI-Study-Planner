import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { floxToast as toast } from '../components/FloxToast'
import PageShell from '../components/PageShell'
import { ResponsiveBottomSheet } from '../components/ResponsiveBottomSheet'
import { IconPlanner, IconSpark } from '../components/icons'
import { api, getErrorMessage } from '../lib/api'
import { notifyStudyActivity } from '../lib/studyActivity'

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

function timeLabel(iso?: string): string {
  if (!iso) return 'Flexible'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return 'Flexible'
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
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

function getSubjectColorByName(name: string, subjects: Subject[]): string {
  const idx = subjects.findIndex((s) => s.name.toLowerCase() === name.toLowerCase())
  return SUBJECT_COLORS[Math.max(0, idx) % SUBJECT_COLORS.length]
}

function subjectInitial(text: string, fallback = '•'): string {
  return (text.trim().charAt(0) || fallback).toUpperCase()
}

/* Session card — one clean full-width row per study session. */
function SessionCard({ task, subjects, onToggle, onEdit, onStartDelete, onDelete, onCancelDelete, confirming }: {
  task: Task
  subjects: Subject[]
  onToggle: (t: Task) => void
  onEdit: (t: Task) => void
  onStartDelete: (t: Task) => void
  onDelete: (t: Task) => void
  onCancelDelete: () => void
  confirming: boolean
}) {
  const color = getSubjectColor(task.subject, subjects)
  const done = task.status === 'done'
  const priority = task.priority || 'medium'
  return (
    <div className={`pl-sess${done ? ' pl-sess-done' : ''}${confirming ? ' pl-sess-confirming' : ''}`} style={{ '--pl-color': color } as CSSProperties}>
      <button className="pl-sess-check" onClick={() => onToggle(task)} type="button" aria-label={done ? 'Mark as not done' : 'Mark as done'}>
        {done && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
        )}
      </button>
      <div className="pl-sess-body">
        <div className="pl-sess-top">
          <span className="pl-sess-time">{task.scheduled_for ? timeLabel(task.scheduled_for) : 'Flexible'}</span>
          <span className="pl-sess-subject">{task.subject_name || 'Study'}</span>
        </div>
        <span className="pl-sess-title">{task.title}</span>
        {task.description ? <span className="pl-sess-desc">{task.description}</span> : null}
        <div className="pl-sess-meta">
          <span className={`pl-pri pl-pri-${priority}`}>
            <i aria-hidden="true" />
            {priority}
          </span>
          <span className="pl-sess-spacer" />
          <button className="pl-sess-act" onClick={() => onEdit(task)} type="button" aria-label={`Edit ${task.title}`} title="Edit session">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></svg>
          </button>
          {confirming ? (
            <div className="pl-sess-ask" role="alertdialog" aria-label="Confirm delete">
              <span className="pl-sess-ask-txt">Delete session?</span>
              <button className="pl-sess-ask-yes" onClick={() => onDelete(task)} type="button">Delete</button>
              <button className="pl-sess-ask-no" onClick={onCancelDelete} type="button">Keep</button>
            </div>
          ) : (
            <button className="pl-sess-act pl-sess-del" onClick={() => onStartDelete(task)} type="button" aria-label={`Delete ${task.title}`} title="Delete session">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
            </button>
          )}
        </div>
      </div>
      <span className="pl-sess-dur">{minutesLabel(task.duration_minutes)}</span>
    </div>
  )
}

/* Scheduled list for one day — compact hour groups (no empty-hour filler). */
function DaySchedule({ tasks, subjects, onToggle, onCreate, onEdit, onStartDelete, onDelete, onCancelDelete, confirmDelete }: {
  tasks: Task[]
  subjects: Subject[]
  onToggle: (t: Task) => void
  onCreate: () => void
  onEdit: (t: Task) => void
  onStartDelete: (t: Task) => void
  onDelete: (t: Task) => void
  onCancelDelete: () => void
  confirmDelete: number | null
}) {
  const slots = useMemo(
    () =>
      HOURS.map((hour) => ({ hour, items: tasks.filter((t) => getHourFromScheduled(t.scheduled_for) === hour) }))
        .filter((s) => s.items.length > 0),
    [tasks],
  )
  const other = useMemo(() => tasks.filter((t) => getHourFromScheduled(t.scheduled_for) === null), [tasks])

  if (tasks.length === 0) {
    return (
      <div className="pl-empty-wrap">
        <span className="pl-empty-ico"><IconPlanner size={26} /></span>
        <h3 className="pl-empty-title">No study tasks for this day.</h3>
        <p className="pl-empty-sub">Plan a session and it will show up right here in your timeline.</p>
        <button className="pl-empty-cta" onClick={onCreate} type="button">+ Add Study Task</button>
      </div>
    )
  }

  return (
    <div className="pl-day-list">
      {slots.map((slot) => (
        <div key={slot.hour} className="pl-hour-group">
          <div className="pl-hour-head">
            <span className="pl-hour-label">{`${String(slot.hour).padStart(2, '0')}:00`}</span>
            <span className="pl-hour-line" />
          </div>
          <div className="pl-hour-tasks">
            {slot.items.map((t) => <SessionCard key={t.id} task={t} subjects={subjects} onToggle={onToggle} onEdit={onEdit} onStartDelete={onStartDelete} onDelete={onDelete} onCancelDelete={onCancelDelete} confirming={confirmDelete === t.id} />)}
          </div>
        </div>
      ))}
      {other.length > 0 && (
        <div className="pl-hour-group">
          <div className="pl-hour-head">
            <span className="pl-hour-label">Flexible</span>
            <span className="pl-hour-line" />
          </div>
          <div className="pl-hour-tasks">
            {other.map((t) => <SessionCard key={t.id} task={t} subjects={subjects} onToggle={onToggle} onEdit={onEdit} onStartDelete={onStartDelete} onDelete={onDelete} onCancelDelete={onCancelDelete} confirming={confirmDelete === t.id} />)}
          </div>
        </div>
      )}
    </div>
  )
}

function PlannerSkeleton() {
  return (
    <div className="pl-skeleton" aria-hidden="true">
      <div className="pl-skeleton-toolbar" />
      <div className="pl-skeleton-card">
        <div className="pl-skeleton-line w-40" />
        <div className="pl-skeleton-line w-90" />
        <div className="pl-skeleton-line w-70" />
      </div>
      <div className="pl-skeleton-card">
        <div className="pl-skeleton-line w-40" />
        <div className="pl-skeleton-line w-80" />
        <div className="pl-skeleton-line w-60" />
      </div>
      <div className="pl-skeleton-card">
        <div className="pl-skeleton-line w-50" />
        <div className="pl-skeleton-line w-75" />
      </div>
    </div>
  )
}

export default function PlannerPage() {
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [exams, setExams] = useState<Exam[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [viewMode, setViewMode] = useState<ViewMode>('day')
  const [selectedDate, setSelectedDate] = useState(toLocalDateInput())
  const [plan, setPlan] = useState<PlanResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [planLoading, setPlanLoading] = useState(false)
  const [modal, setModal] = useState<ModalKind>(null)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [sessionSaving, setSessionSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)

  const [sessionSubject, setSessionSubject] = useState('')
  const [sessionTopic, setSessionTopic] = useState('')
  const [sessionDate, setSessionDate] = useState(toLocalDateInput())
  const [sessionTime, setSessionTime] = useState('09:00')
  const [sessionDuration, setSessionDuration] = useState(45)
  const [sessionPriority, setSessionPriority] = useState<'high' | 'medium' | 'low'>('medium')
  const [sessionNotes, setSessionNotes] = useState('')
  const [sessionErrors, setSessionErrors] = useState<{ subject?: string; topic?: string }>({})
  const subjectRef = useRef<HTMLSelectElement>(null)
  const topicRef = useRef<HTMLInputElement>(null)

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

  const selectedDayTasks = useMemo(
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

  const dayTaskCount = selectedDayTasks.length
  const dayHours = selectedDayTasks.reduce((sum, t) => sum + (t.duration_minutes || 0), 0) / 60
  const dayDoneMinutes = selectedDayTasks.filter((t) => t.status === 'done').reduce((sum, t) => sum + (t.duration_minutes || 0), 0)
  const dayTotalMinutes = selectedDayTasks.reduce((sum, t) => sum + (t.duration_minutes || 0), 0)
  const dayDoneCount = selectedDayTasks.filter((t) => t.status === 'done').length

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

  const retryLoad = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    try {
      await loadPlanner()
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [loadPlanner])

  useEffect(() => {
    let active = true
    async function init() {
      try {
        await loadPlanner()
      } catch (err) {
        if (active) {
          setLoadError(true)
          toast.error(getErrorMessage(err))
        }
      } finally {
        if (active) setLoading(false)
      }
    }
    void init()
    return () => { active = false }
  }, [loadPlanner])

  function resetSessionForm(date = toLocalDateInput()) {
    setSessionSubject('')
    setSessionTopic('')
    setSessionDate(date)
    setSessionTime('09:00')
    setSessionDuration(45)
    setSessionPriority('medium')
    setSessionNotes('')
    setSessionErrors({})
  }

  function openSession(date = toLocalDateInput(), task?: Task | null) {
    toast.dismiss()
    setConfirmDelete(null)
    if (task) {
      setEditingTask(task)
      setSessionSubject(task.subject != null ? String(task.subject) : '')
      setSessionTopic(task.title)
      setSessionDate(task.scheduled_for?.slice(0, 10) ?? task.due_date ?? date)
      setSessionTime(task.scheduled_for ? task.scheduled_for.slice(11, 16) : '09:00')
      setSessionDuration(task.duration_minutes || 45)
      setSessionPriority((task.priority as 'high' | 'medium' | 'low') || 'medium')
      setSessionNotes(task.description || '')
      setSessionErrors({})
    } else {
      resetSessionForm(date)
      setEditingTask(null)
    }
    setModal('session')
  }

  function closeSession() {
    setModal(null)
    resetSessionForm()
    setEditingTask(null)
    setConfirmDelete(null)
  }

  function resetAiForm() {
    setAiExamDate(toLocalDateInput())
    setAiDailyHours(4)
    setAiWeakSubject('')
    setAiStrongSubject('')
  }

  async function handleSubmitSession(e: FormEvent) {
    e.preventDefault()
    const errors: { subject?: string; topic?: string } = {}
    if (!sessionSubject) errors.subject = 'Please select a subject.'
    if (!sessionTopic.trim()) errors.topic = 'Enter a task name.'
    if (errors.subject || errors.topic) {
      setSessionErrors(errors)
      if (errors.subject) subjectRef.current?.focus()
      else topicRef.current?.focus()
      return
    }
    setSessionErrors({})
    setSessionSaving(true)
    try {
      const subjectId = Number(sessionSubject)
      const subjectObj = subjects.find((s) => s.id === subjectId)
      const title = sessionTopic.trim() || (subjectObj ? `${subjectObj.name} session` : 'Study session')
      const scheduledFor = `${sessionDate}T${sessionTime}:00`
      const payload = {
        title,
        description: sessionNotes.trim(),
        subject: subjectId,
        due_date: sessionDate,
        scheduled_for: scheduledFor,
        duration_minutes: sessionDuration,
        priority: sessionPriority,
      }
      if (editingTask) {
        await api.patch(`/study/tasks/${editingTask.id}/`, payload)
        setTasks((prev) => prev.map((t) => (t.id === editingTask.id ? { ...t, ...payload, status: t.status } : t)))
        toast.success('Study session updated')
      } else {
        await api.post('/study/tasks/', { ...payload, status: 'todo' })
        notifyStudyActivity()
        toast.success('Study session created')
        await loadPlanner()
      }
      setModal(null)
      resetSessionForm()
      setEditingTask(null)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSessionSaving(false)
    }
  }

  async function handleToggleTask(task: Task) {
    const next = task.status === 'done' ? 'todo' : 'done'
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: next } : t)))
    try {
      await api.patch(`/study/tasks/${task.id}/`, { status: next })
    } catch (err) {
      toast.error(getErrorMessage(err))
      await loadPlanner().catch(() => undefined)
    }
  }

  function handleEditTask(task: Task) {
    openSession(selectedDate, task)
  }

  async function handleDeleteTask(id: number) {
    setConfirmDelete(null)
    const previous = tasks
    setTasks((prev) => prev.filter((t) => t.id !== id))
    try {
      await api.delete(`/study/tasks/${id}/`)
      toast.success('Study session deleted')
    } catch (err) {
      toast.error(getErrorMessage(err))
      setTasks(previous)
    }
  }

  async function handleAiGenerate(e: FormEvent) {
    e.preventDefault()
    toast.dismiss()
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
      notifyStudyActivity()
      setPlan(data)
      toast.success('AI plan generated')
      setModal(null)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setPlanLoading(false)
    }
  }

  if (loading) {
    return (
      <PageShell title="Study Planner" className="planner-page">
        <PlannerSkeleton />
      </PageShell>
    )
  }

  if (loadError) {
    return (
      <PageShell title="Study Planner" className="planner-page">
        <div className="pl-error" role="alert">
          <span className="pl-error-ico"><IconSpark size={26} /></span>
          <h3 className="pl-error-title">Something went wrong</h3>
          <p className="pl-error-sub">We couldn&apos;t load your study plan.</p>
          <button className="pl-error-cta" onClick={() => void retryLoad()} type="button">Try Again</button>
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell
      title="Study Planner"
      subtitle="Plan your study sessions."
      className="planner-page"
      actions={
        <>
          <button className="pl-action-btn" onClick={() => openSession(selectedDate)} type="button">
            <IconPlanner size={16} /> Add Study Task
          </button>
          <button className="pl-action-btn pl-action-ghost" onClick={() => { resetAiForm(); setModal('ai') }} type="button">
            <IconSpark size={16} /> AI Generate
          </button>
        </>
      }
      mobileActions={
        <button
          className="pl-hadd"
          onClick={() => openSession(selectedDate)}
          type="button"
          aria-label="Add study task"
          title="Add study task"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      }
    >
      <div className="pl-toolbar">
        <div className="pl-toolbar-row">
          <div className="pl-view-toggle" role="tablist" aria-label="View mode">
            {(['day', 'week', 'month'] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                role="tab"
                aria-selected={viewMode === mode}
                className={`pl-view-btn ${viewMode === mode ? 'pl-view-active' : ''}`}
                onClick={() => setViewMode(mode)}
                type="button"
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>
          <button className="pl-ai-mini" onClick={() => { resetAiForm(); setModal('ai') }} type="button" aria-label="Generate AI study plan">
            <IconSpark size={15} /> AI
          </button>
        </div>

        <div className="pl-toolbar-row">
          <div className="cal-nav planner-cal-nav">
            <button className="cal-nav-btn" onClick={() => setSelectedDate(navigateDate(selectedDate, -1, viewMode))} type="button" aria-label="Previous">&#8249;</button>
            <div className="cal-nav-center">
              <span className="cal-nav-title">
                {viewMode === 'day' && (selectedDate === today ? `Today, ${shortDate(selectedDate)}` : shortDate(selectedDate))}
                {viewMode === 'week' && `${shortDate(weekStart)} – ${shortDate(weekEnd)}`}
                {viewMode === 'month' && calendarInfo.label}
              </span>
              <button className="cal-today-btn" onClick={() => setSelectedDate(today)} type="button">Today</button>
            </div>
            <button className="cal-nav-btn" onClick={() => setSelectedDate(navigateDate(selectedDate, 1, viewMode))} type="button" aria-label="Next">&#8250;</button>
          </div>
        </div>
      </div>

      {planBlocks.length > 0 && (
        <div className="pl-card pl-plan-card">
          <div className="pl-plan-header">
            <IconSpark size={18} />
            <h2 className="pl-plan-title">AI Study Plan</h2>
          </div>
          {plan && <p className="pl-plan-tip">{plan.focus_tip}</p>}
          <div className="pl-plan-list">
            {planBlocks.map((block, i) => (
              <div key={`${block.time}-${i}`} className="pl-plan-block" style={{ '--pl-color': getSubjectColorByName(block.subject, subjects) } as CSSProperties}>
                <span className="pl-plan-time">{block.time}</span>
                <span className="pl-plan-dot" />
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
            <h3 className="pl-card-title">{formatFullDate(selectedDate)}</h3>
            {dayTotalMinutes > 0 && (
              <div className="pl-progress" role="group" aria-label={selectedDate === today ? "Today's progress" : `Progress for ${shortDate(selectedDate)}`}>
                <div className="pl-progress-head">
                  <span className="pl-progress-title">{selectedDate === today ? "Today's Progress" : 'Day Progress'}</span>
                  <span className="pl-progress-val">{minutesLabel(dayDoneMinutes)} / {minutesLabel(dayTotalMinutes)}</span>
                </div>
                <div className="pl-progress-track" role="progressbar" aria-valuenow={Math.round((dayDoneMinutes / dayTotalMinutes) * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Tasks completed">
                  <span className="pl-progress-fill" style={{ width: `${Math.round((dayDoneMinutes / dayTotalMinutes) * 100)}%` }} />
                </div>
                <span className="pl-progress-sub">{dayDoneCount} of {dayTaskCount} tasks done</span>
              </div>
            )}
            <DaySchedule
              tasks={selectedDayTasks}
              subjects={subjects}
              onToggle={handleToggleTask}
              onCreate={() => openSession(selectedDate)}
              onEdit={handleEditTask}
              onStartDelete={(t) => setConfirmDelete(t.id)}
              onDelete={(t) => void handleDeleteTask(t.id)}
              onCancelDelete={() => setConfirmDelete(null)}
              confirmDelete={confirmDelete}
            />
            <div className="pl-day-summary">
              <span className="pl-chip">{dayTaskCount} task{dayTaskCount !== 1 ? 's' : ''}</span>
              <span className="pl-chip">{dayHours.toFixed(1)} hours planned</span>
            </div>
          </div>

          <div className="pl-sidebar">
            <div className="pl-card pl-exam-card">
              <div className="pl-exam-head">
                <h3 className="pl-card-title">Upcoming Exams</h3>
                <Link className="pl-exam-view" to="/exams">View all</Link>
              </div>
              {upcomingExams.length === 0 ? (
                <p className="pl-empty-text">No upcoming exams.</p>
              ) : (
                <div className="pl-exam-list">
                  {upcomingExams.map((exam) => {
                    const days = daysUntil(exam.date)
                    const color = getSubjectColor(exam.subject, subjects)
                    return (
                      <div key={exam.id} className="pl-exam-item" style={{ '--pl-color': color } as CSSProperties}>
                        <span className="pl-avatar" style={{ '--pl-color': color } as CSSProperties}>{subjectInitial(exam.title)}</span>
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
                  { label: 'Hours', value: `${weekHours.toFixed(1)}h` },
                  { label: 'Done', value: `${completionRate}%` },
                ].map((stat) => (
                  <div key={stat.label} className="pl-stat-tile">
                    <span className="pl-stat-value">{stat.value}</span>
                    <span className="pl-stat-label">{stat.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {viewMode === 'week' && (
        <div className="pl-card pl-week-wrap">
          <div className="pl-week-strip" role="tablist" aria-label="Day of week">
            {weekDays.map((day) => (
              <button
                key={day.date}
                role="tab"
                aria-selected={selectedDate === day.date}
                className={`pl-strip-day${selectedDate === day.date ? ' pl-strip-active' : ''}${day.isToday ? ' pl-strip-today' : ''}`}
                onClick={() => setSelectedDate(day.date)}
                type="button"
              >
                <span className="pl-strip-name">{day.dayName}</span>
                <span className="pl-strip-num">{day.dayNum}</span>
              </button>
            ))}
          </div>
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
                        <div key={task.id} className="pl-week-task" style={{ '--pl-color': getSubjectColor(task.subject, subjects) } as CSSProperties}>
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
          <div className="pl-week-detail">
            <h3 className="pl-card-title">{formatFullDate(selectedDate)}</h3>
            <DaySchedule
              tasks={selectedDayTasks}
              subjects={subjects}
              onToggle={handleToggleTask}
              onCreate={() => openSession(selectedDate)}
              onEdit={handleEditTask}
              onStartDelete={(t) => setConfirmDelete(t.id)}
              onDelete={(t) => void handleDeleteTask(t.id)}
              onCancelDelete={() => setConfirmDelete(null)}
              confirmDelete={confirmDelete}
            />
          </div>
        </div>
      )}

      {viewMode === 'month' && (
        <>
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
                const isSelected = cell === selectedDate
                return (
                  <button
                    key={i}
                    disabled={!cell}
                    className={`pl-month-cell ${isToday ? 'pl-month-today' : ''} ${isSelected ? 'pl-month-selected' : ''} ${!cell ? 'pl-month-blank' : ''}`}
                    onClick={() => { if (cell) setSelectedDate(cell) }}
                    type="button"
                  >
                    <span>{cell ? cell.split('-')[2].replace(/^0/, '') : ''}</span>
                    {hasSession && <span className="pl-month-dot" />}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="pl-card pl-month-detail">
            <div className="pl-month-detail-head">
              <h3 className="pl-card-title">{formatFullDate(selectedDate)}</h3>
              <button className="pl-month-open-day" onClick={() => setViewMode('day')} type="button">Day view &#8250;</button>
            </div>
            <DaySchedule
              tasks={selectedDayTasks}
              subjects={subjects}
              onToggle={handleToggleTask}
              onCreate={() => openSession(selectedDate)}
              onEdit={handleEditTask}
              onStartDelete={(t) => setConfirmDelete(t.id)}
              onDelete={(t) => void handleDeleteTask(t.id)}
              onCancelDelete={() => setConfirmDelete(null)}
              confirmDelete={confirmDelete}
            />
          </div>
        </>
      )}

      <div className="pl-card pl-ai-card">
        <span className="pl-ai-tile"><IconSpark size={20} /></span>
        <div className="pl-ai-body">
          <h3 className="pl-ai-title">FLOX AI Planner</h3>
          <p className="pl-ai-sub">A smart weekly schedule tuned to your weak topics and upcoming exams.</p>
        </div>
        <button className="pl-ai-gen" onClick={() => { resetAiForm(); setModal('ai') }} type="button">
          {plan ? 'Regenerate' : 'Generate'}
        </button>
      </div>

      <ResponsiveBottomSheet
        open={modal === 'session'}
        onClose={closeSession}
        title={editingTask ? 'Edit Study Task' : 'Add Study Task'}
        footer={
          <div className="cal-modal-actions rbs-actions">
            <button type="button" className="cal-modal-cancel" onClick={closeSession}>Cancel</button>
            <button type="submit" className="cal-modal-create" form="pl-session-form" disabled={sessionSaving}>
              {sessionSaving ? 'Saving...' : editingTask ? 'Save Changes' : 'Save Task'}
            </button>
          </div>
        }
      >
        <form id="pl-session-form" className="rbs-form" onSubmit={handleSubmitSession} noValidate>
          <div className="cal-modal-field">
            <label htmlFor="pl-session-subject">Subject</label>
            <select
              ref={subjectRef}
              id="pl-session-subject"
              value={sessionSubject}
              onChange={(e) => {
                setSessionSubject(e.target.value)
                if (sessionErrors.subject) setSessionErrors((p) => ({ ...p, subject: undefined }))
              }}
              aria-invalid={!!sessionErrors.subject}
            >
              <option value="">Select subject</option>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {sessionErrors.subject && <p className="pl-field-error" role="alert">{sessionErrors.subject}</p>}
          </div>
          <div className="cal-modal-field">
            <label htmlFor="pl-session-topic">Task name</label>
            <input
              ref={topicRef}
              id="pl-session-topic"
              placeholder="e.g. Revise Algebra"
              value={sessionTopic}
              onChange={(e) => {
                setSessionTopic(e.target.value)
                if (sessionErrors.topic) setSessionErrors((p) => ({ ...p, topic: undefined }))
              }}
              aria-invalid={!!sessionErrors.topic}
            />
            {sessionErrors.topic && <p className="pl-field-error" role="alert">{sessionErrors.topic}</p>}
          </div>
          <div className="cal-modal-field">
            <label htmlFor="pl-session-date">Date</label>
            <input id="pl-session-date" type="date" value={sessionDate} onChange={(e) => setSessionDate(e.target.value)} />
          </div>
          <div className="cal-modal-row">
            <div className="cal-modal-field"><label htmlFor="pl-session-time">Start time</label><input id="pl-session-time" type="time" value={sessionTime} onChange={(e) => setSessionTime(e.target.value)} /></div>
            <div className="cal-modal-field"><label htmlFor="pl-session-duration">Duration</label><select id="pl-session-duration" value={sessionDuration} onChange={(e) => setSessionDuration(Number(e.target.value))}>
              {DURATION_OPTIONS.map((d) => <option key={d} value={d}>{minutesLabel(d)}</option>)}
            </select></div>
          </div>
          <div className="cal-modal-field">
            <label>Priority</label>
            <div className="pl-priority-row" role="group" aria-label="Priority">
              {PRIORITY_OPTIONS.map((p) => (
                <button key={p} type="button" onClick={() => setSessionPriority(p)}
                  className={`pl-priority-btn ${sessionPriority === p ? 'pl-priority-active' : ''}`}
                  style={sessionPriority === p ? { borderColor: priorityColor(p), background: priorityColor(p) + '18' } : {}}>
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className="cal-modal-field"><label htmlFor="pl-session-notes">Notes</label><textarea id="pl-session-notes" placeholder="Optional notes..." value={sessionNotes} onChange={(e) => setSessionNotes(e.target.value)} rows={3} /></div>
        </form>
      </ResponsiveBottomSheet>

      <ResponsiveBottomSheet
        open={modal === 'ai'}
        onClose={() => { setModal(null); resetAiForm() }}
        title="Generate Study Plan"
        footer={
          <div className="cal-modal-actions rbs-actions">
            <button type="button" className="cal-modal-cancel" onClick={() => { setModal(null); resetAiForm() }}>Cancel</button>
            <button type="submit" className="cal-modal-create" form="pl-ai-form" disabled={planLoading}>{planLoading ? 'Generating...' : 'Generate Plan'}</button>
          </div>
        }
      >
        <form id="pl-ai-form" className="rbs-form" onSubmit={handleAiGenerate}>
          <div className="cal-modal-field"><label htmlFor="pl-ai-date">Exam Date</label><input id="pl-ai-date" type="date" value={aiExamDate} onChange={(e) => setAiExamDate(e.target.value)} /></div>
          <div className="cal-modal-field"><label htmlFor="pl-ai-hours">Available Time per Day (hours)</label><input id="pl-ai-hours" type="number" min={1} max={16} value={aiDailyHours} onChange={(e) => setAiDailyHours(Number(e.target.value))} /></div>
          <div className="cal-modal-row">
            <div className="cal-modal-field">
              <label htmlFor="pl-ai-weak">Weak Subject</label>
              <select id="pl-ai-weak" value={aiWeakSubject} onChange={(e) => setAiWeakSubject(e.target.value)}>
                <option value="">Select subject</option>
                {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="cal-modal-field">
              <label htmlFor="pl-ai-strong">Strong Subject</label>
              <select id="pl-ai-strong" value={aiStrongSubject} onChange={(e) => setAiStrongSubject(e.target.value)}>
                <option value="">Select subject</option>
                {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
        </form>
      </ResponsiveBottomSheet>
    </PageShell>
  )
}