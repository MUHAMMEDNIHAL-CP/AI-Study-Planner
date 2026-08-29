import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { toast } from 'react-toastify'
import PageShell from '../components/PageShell'
import { api, getErrorMessage } from '../lib/api'

type Task = {
  id: number
  subject: number | null
  subject_name: string
  title: string
  description: string
  due_date: string
  scheduled_for: string
  duration_minutes: number
  priority: string
  status: string
  created_at: string
  updated_at: string
}

type Subject = { id: number; name: string; color: string }

type TabKey = 'today' | 'upcoming' | 'all' | 'completed' | 'overdue'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'all', label: 'All' },
  { key: 'completed', label: 'Completed' },
  { key: 'overdue', label: 'Overdue' },
]

function toLocalDateInput(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}

const today = toLocalDateInput()

function shortDate(dateString?: string) {
  if (!dateString) return '—'
  return new Date(`${dateString}T00:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

function minutesLabel(minutes: number) {
  if (minutes >= 60) return `${Math.floor(minutes / 60)}h ${minutes % 60 ? `${minutes % 60}m` : ''}`.trim()
  return `${minutes} min`
}

function priorityStyles(priority: string) {
  if (priority === 'high') return { bg: 'rgba(251, 113, 133, 0.15)', color: '#fca5a5', border: 'rgba(251, 113, 133, 0.25)' }
  if (priority === 'low') return { bg: 'rgba(74, 222, 128, 0.12)', color: '#86efac', border: 'rgba(74, 222, 128, 0.2)' }
  return { bg: 'rgba(251, 191, 36, 0.12)', color: '#fde68a', border: 'rgba(251, 191, 36, 0.2)' }
}

function isToday(dateStr: string) {
  return dateStr === today
}

function isFuture(dateStr: string) {
  return dateStr > today
}

function isPast(dateStr: string) {
  return dateStr < today
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabKey>('today')
  const [showModal, setShowModal] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)

  const [formTitle, setFormTitle] = useState('')
  const [formSubject, setFormSubject] = useState('')
  const [formDueDate, setFormDueDate] = useState(today)
  const [formDuration, setFormDuration] = useState('45')
  const [formPriority, setFormPriority] = useState('medium')
  const [formDescription, setFormDescription] = useState('')

  const loadAll = useCallback(async () => {
    try {
      const [taskRes, subjectRes] = await Promise.all([
        api.get<Task[]>('/study/tasks/'),
        api.get<Subject[]>('/study/subjects/'),
      ])
      setTasks(taskRes.data)
      setSubjects(subjectRes.data)
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }, [])

  useEffect(() => {
    let active = true
    async function init() {
      try {
        await loadAll()
      } finally {
        if (active) setLoading(false)
      }
    }
    void init()
    return () => { active = false }
  }, [loadAll])

  const filteredTasks = useMemo(() => {
    const sorted = [...tasks].sort((a, b) => {
      const da = a.due_date || '9999-12-31'
      const db = b.due_date || '9999-12-31'
      if (da !== db) return da.localeCompare(db)
      const prio: Record<string, number> = { high: 0, medium: 1, low: 2 }
      return (prio[a.priority] ?? 1) - (prio[b.priority] ?? 1)
    })

    switch (activeTab) {
      case 'today':
        return sorted.filter((t) => isToday(t.due_date))
      case 'upcoming':
        return sorted.filter((t) => isFuture(t.due_date) && t.status !== 'done')
      case 'completed':
        return sorted.filter((t) => t.status === 'done')
      case 'overdue':
        return sorted.filter((t) => isPast(t.due_date) && t.status !== 'done')
      default:
        return sorted
    }
  }, [tasks, activeTab])

  const tabCounts = useMemo(() => {
    const count = (pred: (t: Task) => boolean) => tasks.filter(pred).length
    return {
      today: count((t) => isToday(t.due_date)),
      upcoming: count((t) => isFuture(t.due_date) && t.status !== 'done'),
      all: tasks.length,
      completed: count((t) => t.status === 'done'),
      overdue: count((t) => isPast(t.due_date) && t.status !== 'done'),
    }
  }, [tasks])

  async function toggleTask(task: Task) {
    const next = task.status === 'done' ? 'todo' : 'done'
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: next } : t)))
    try {
      await api.patch(`/study/tasks/${task.id}/`, { status: next })
    } catch (err) {
      toast.error(getErrorMessage(err))
      void loadAll()
    }
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault()
    try {
      await api.post('/study/tasks/', {
        title: formTitle.trim(),
        subject: formSubject ? Number(formSubject) : null,
        due_date: formDueDate,
        duration_minutes: Number(formDuration) || 30,
        priority: formPriority,
        description: formDescription.trim(),
      })
      toast.success('Task created')
      resetForm()
      setShowModal(false)
      await loadAll()
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  async function handleDelete(id: number) {
    try {
      await api.delete(`/study/tasks/${id}/`)
      toast.success('Task deleted')
      setConfirmDeleteId(null)
      await loadAll()
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  function resetForm() {
    setFormTitle('')
    setFormSubject('')
    setFormDueDate(today)
    setFormDuration('45')
    setFormPriority('medium')
    setFormDescription('')
  }

  return (
<PageShell
      title="Tasks"
      subtitle="Organize your study work. Filter by today, upcoming, or overdue to stay on track."
      actions={
        <button className="ms-add-btn" onClick={() => setShowModal(true)} type="button">+ Add Task</button>
      }
    >
      <div className="tk-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            type="button"
            className={`tk-tab ${activeTab === tab.key ? 'tk-tab-active' : ''}`}
          >
            {tab.label}
            <span className="tk-tab-count">{tabCounts[tab.key]}</span>
          </button>
        ))}
      </div>

      <div style={{ marginTop: 16 }}>
        {loading ? (
          <div className="tk-empty">
            <p>Loading tasks...</p>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="tk-empty">
            <h2>{activeTab === 'overdue' ? 'All caught up!' : 'Nothing here yet'}</h2>
            <p>
              {activeTab === 'overdue'
                ? 'Great job staying on top of things.'
                : 'Add a task to start tracking your study work.'}
            </p>
            <button className="ms-add-btn" onClick={() => setShowModal(true)} type="button">+ Add Task</button>
          </div>
        ) : (
          <div className="tk-list">
            {filteredTasks.map((task) => {
              const done = task.status === 'done'
              const sub = subjects.find((s) => s.id === task.subject)
              const ps = priorityStyles(task.priority)
              const overdue = isPast(task.due_date) && !done

              return (
                <div
                  key={task.id}
                  className={`tk-item ${done ? 'tk-item-done' : ''} ${overdue ? 'tk-item-overdue' : ''} ${confirmDeleteId === task.id ? 'tk-item-delete' : ''}`}
                  style={{ '--tk-color': sub?.color ?? '#a78bfa' } as React.CSSProperties}
                >
                  {task.subject_name && <div className="tk-ace" aria-hidden="true" />}
                  <button
                    className={`tk-check ${done ? 'tk-check-done' : ''}`}
                    onClick={() => void toggleTask(task)}
                    type="button"
                    aria-label={done ? 'Mark as todo' : 'Mark as done'}
                  >
                    {done ? '✓' : ''}
                  </button>

                  <div className="tk-main">
                    <div className="tk-title-row">
                      <strong className="tk-title">{task.title}</strong>
                      {task.subject_name && <span className="tk-subject-chip">{task.subject_name}</span>}
                      {overdue && <span className="tk-overdue-badge">overdue</span>}
                    </div>
                    <div className="tk-meta">
                      <span className={overdue ? 'tk-meta-date tk-date-overdue' : 'tk-meta-date'}>{shortDate(task.due_date)}</span>
                      <span className="tk-meta-sep">•</span>
                      <span className="tk-meta-dur">{minutesLabel(task.duration_minutes)}</span>
                    </div>
                  </div>

                  <div className="tk-actions">
                    <span className="tk-priority" style={{ background: ps.bg, color: ps.color, borderColor: ps.border }}>{task.priority}</span>
                    {confirmDeleteId === task.id ? (
                      <div className="tk-confirm">
                        <button className="tk-btn" onClick={() => setConfirmDeleteId(null)} type="button">No</button>
                        <button className="danger-button" onClick={() => void handleDelete(task.id)} type="button" style={{ minHeight: 0, padding: '5px 12px', fontSize: '0.72rem', borderRadius: 8 }}>Yes</button>
                      </div>
                    ) : (
                      <button className="tk-delete" onClick={() => setConfirmDeleteId(task.id)} type="button" title="Delete task">Delete</button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showModal && (
        <div
          className="cal-modal-overlay"
          onClick={() => setShowModal(false)}
          onMouseDown={(e) => { if (e.target === e.currentTarget) setShowModal(false) }}
        >
          <section
            aria-labelledby="add-task-title"
            aria-modal="true"
            className="cal-modal"
            onMouseDown={(e) => e.stopPropagation()}
            role="dialog"
          >
            <div className="zq-modal-head">
              <h2 id="add-task-title">Add Task</h2>
              <button className="zq-modal-close" onClick={() => setShowModal(false)} type="button" aria-label="Close">{'\u00d7'}</button>
            </div>
            <form style={{ display: 'flex', flexDirection: 'column', gap: 12 }} onSubmit={handleCreate}>
              <div className="cal-modal-field">
                <label>Title *</label>
                <input autoFocus placeholder="Solve 20 active recall questions" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} required />
              </div>
              <div className="cal-modal-field">
                <label>Subject</label>
                <select value={formSubject} onChange={(e) => setFormSubject(e.target.value)}>
                  <option value="">No subject</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div className="cal-modal-row">
                <div className="cal-modal-field">
                  <label>Due date *</label>
                  <input type="date" value={formDueDate} onChange={(e) => setFormDueDate(e.target.value)} required />
                </div>
                <div className="cal-modal-field">
                  <label>Duration (min)</label>
                  <input min="5" step="5" type="number" value={formDuration} onChange={(e) => setFormDuration(e.target.value)} />
                </div>
              </div>
              <div className="cal-modal-field">
                <label>Priority</label>
                <select value={formPriority} onChange={(e) => setFormPriority(e.target.value)}>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="low">Low</option>
                </select>
              </div>
              <div className="cal-modal-field">
                <label>Description</label>
                <textarea placeholder="Optional notes about this task" value={formDescription} onChange={(e) => setFormDescription(e.target.value)} />
              </div>
              <div className="cal-modal-actions">
                <button type="button" className="cal-modal-cancel" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="cal-modal-create">Save Task</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </PageShell>
  )
}
