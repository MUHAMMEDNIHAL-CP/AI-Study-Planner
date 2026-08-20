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

type Subject = { id: number; name: string }

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
      eyebrow="Task manager"
      title="Tasks"
      subtitle="Organize your study work. Filter by today, upcoming, or overdue to stay on track."
      actions={
        <button className="gradient-action" onClick={() => setShowModal(true)} type="button">
          + Add Task
        </button>
      }
    >
      <div className="page-card" style={{ padding: '6px 10px', marginBottom: 0, display: 'inline-flex', gap: 4, flexWrap: 'wrap' }}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            type="button"
            style={{
              padding: '10px 20px',
              borderRadius: 10,
              border: 'none',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              background: activeTab === tab.key ? 'linear-gradient(135deg, var(--purple), var(--cyan))' : 'transparent',
              color: activeTab === tab.key ? '#21105c' : 'var(--muted)',
              transition: 'all 0.15s',
            }}
          >
            {tab.label}
            {tab.key === 'overdue' && filteredTasks.length > 0 && activeTab !== 'overdue' ? null : null}
          </button>
        ))}
      </div>

      <div style={{ marginTop: 16 }}>
        {loading ? (
          <div className="page-card" style={{ textAlign: 'center', padding: 60 }}>
            Loading tasks...
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="page-card" style={{ textAlign: 'center', padding: 60 }}>
            <span className="eyebrow">
              {activeTab === 'today' && 'No tasks today'}
              {activeTab === 'upcoming' && 'Nothing upcoming'}
              {activeTab === 'all' && 'No tasks'}
              {activeTab === 'completed' && 'No completed tasks'}
              {activeTab === 'overdue' && 'No overdue tasks'}
            </span>
            <h2 style={{ margin: '8px 0' }}>
              {activeTab === 'overdue' ? 'All caught up!' : 'Nothing here yet'}
            </h2>
            <p style={{ color: 'var(--muted)' }}>
              {activeTab === 'overdue'
                ? 'Great job staying on top of things.'
                : 'Add a task to start tracking your study work.'}
            </p>
          </div>
        ) : (
          <div className="page-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ display: 'grid' }}>
              {filteredTasks.map((task) => {
                const done = task.status === 'done'
                const ps = priorityStyles(task.priority)
                const overdue = isPast(task.due_date) && !done

                return (
                  <div
                    key={task.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'auto 1fr auto',
                      gap: 14,
                      alignItems: 'center',
                      padding: '16px 24px',
                      borderBottom: '1px solid var(--line)',
                      opacity: done ? 0.5 : 1,
                    }}
                  >
                    <button
                      onClick={() => void toggleTask(task)}
                      type="button"
                      aria-label={done ? 'Mark as todo' : 'Mark as done'}
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 6,
                        border: done ? 'none' : '2px solid var(--line)',
                        background: done ? 'linear-gradient(135deg, var(--purple), var(--cyan))' : 'transparent',
                        cursor: 'pointer',
                        display: 'grid',
                        placeItems: 'center',
                        color: '#fff',
                        fontSize: '0.72rem',
                        fontWeight: 900,
                        flexShrink: 0,
                      }}
                    >
                      {done ? '✓' : ''}
                    </button>

                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <strong
                          style={{
                            fontSize: '0.92rem',
                            textDecoration: done ? 'line-through' : 'none',
                          }}
                        >
                          {task.title}
                        </strong>
                        {task.subject_name && (
                          <span
                            style={{
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: 6,
                              background: 'rgba(203, 182, 255, 0.1)',
                              color: '#cb89ff',
                            }}
                          >
                            {task.subject_name}
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                        <span
                          style={{
                            fontSize: '0.76rem',
                            color: overdue ? '#fca5a5' : 'var(--muted)',
                            fontWeight: overdue ? 700 : 400,
                          }}
                        >
                          {shortDate(task.due_date)}
                        </span>
                        <span style={{ fontSize: '0.76rem', color: 'var(--muted)' }}>
                          {minutesLabel(task.duration_minutes)}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          padding: '3px 10px',
                          borderRadius: 8,
                          background: ps.bg,
                          color: ps.color,
                          border: `1px solid ${ps.border}`,
                          textTransform: 'capitalize',
                        }}
                      >
                        {task.priority}
                      </span>
                      {confirmDeleteId === task.id ? (
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            type="button"
                            style={{
                              fontSize: '0.72rem',
                              padding: '4px 10px',
                              borderRadius: 6,
                              border: '1px solid var(--line)',
                              background: 'transparent',
                              color: 'var(--muted)',
                              cursor: 'pointer',
                            }}
                          >
                            No
                          </button>
                          <button
                            onClick={() => void handleDelete(task.id)}
                            type="button"
                            className="danger-button"
                            style={{ minHeight: 0, padding: '4px 10px', fontSize: '0.72rem', borderRadius: 6 }}
                          >
                            Yes
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteId(task.id)}
                          type="button"
                          title="Delete task"
                          style={{
                            fontSize: '0.72rem',
                            padding: '4px 10px',
                            borderRadius: 6,
                            border: '1px solid var(--line)',
                            background: 'transparent',
                            color: 'var(--muted)',
                            cursor: 'pointer',
                            opacity: 0.5,
                          }}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
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
            <h3 id="add-task-title">Add Task</h3>
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
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
