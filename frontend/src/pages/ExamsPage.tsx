import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { toast } from 'react-toastify'
import PageShell from '../components/PageShell'
import EmptyState from '../components/EmptyState'
import { api, getErrorMessage } from '../lib/api'
import { notifyStudyActivity } from '../lib/studyActivity'
type Exam = {
  id: number
  subject: number | null
  subject_name: string
  title: string
  date: string
  priority: string
  notes: string
  modules: Array<{ name: string; completed: boolean }>
  preparation_pct: number
  days_left: number
  created_at: string
}

type ExamDetail = {
  id: number
  title: string
  date: string
  priority: string
  notes: string
  subject: {
    id: number
    name: string
    color: string
    topics_completed: number
    total_topics: number
    weak_topics: string
    subject_code: string
  } | null
  modules: Array<{ name: string; completed: boolean }>
  preparation_pct: number
  days_left: number
  weak_areas: string[]
  upcoming_sessions: Array<{
    id: number
    title: string
    due_date: string
    duration_minutes: number
    priority: string
  }>
  today_plan: { sessions: number; minutes: number }
  tomorrow_plan: { sessions: number; minutes: number }
}

type Subject = { id: number; name: string; color: string }

function toLocalDateInput(date = new Date()): string {
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}

function shortDate(dateString: string): string {
  return new Date(`${dateString}T00:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

function fullDate(dateString: string): string {
  return new Date(`${dateString}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function daysLeftBadgeColor(days: number): { bg: string; color: string } {
  if (days <= 3) return { bg: 'rgba(239,68,68,0.18)', color: '#fca5a5' }
  if (days <= 14) return { bg: 'rgba(251,191,36,0.15)', color: '#fde68a' }
  return { bg: 'rgba(74,222,128,0.12)', color: '#86efac' }
}

function priorityBadgeStyle(priority: string): { bg: string; color: string } {
  if (priority === 'high') return { bg: 'rgba(251,113,133,0.15)', color: '#fca5a5' }
  if (priority === 'low') return { bg: 'rgba(74,222,128,0.12)', color: '#86efac' }
  return { bg: 'rgba(251,191,36,0.12)', color: '#fde68a' }
}

export default function ExamsPage() {
  const [exams, setExams] = useState<Exam[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [loading, setLoading] = useState(true)

  const [view, setView] = useState<'list' | 'detail'>('list')
  const [selectedExamId, setSelectedExamId] = useState<number | null>(null)
  const [examDetail, setExamDetail] = useState<ExamDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModules, setShowEditModules] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)

  const [formTitle, setFormTitle] = useState('')
  const [formSubject, setFormSubject] = useState('')
  const [formDate, setFormDate] = useState(toLocalDateInput())
  const [formPriority, setFormPriority] = useState('medium')
  const [formNotes, setFormNotes] = useState('')
  const [formModules, setFormModules] = useState<string[]>([])

  const loadExams = useCallback(async () => {
    try {
      const [examRes, subjectRes] = await Promise.all([
        api.get<Exam[]>('/study/exams/'),
        api.get<Subject[]>('/study/subjects/'),
      ])
      setExams(examRes.data)
      setSubjects(subjectRes.data)
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }, [])

  const loadExamDetail = useCallback(async (id: number) => {
    setDetailLoading(true)
    try {
      const { data } = await api.get<ExamDetail>(`/study/exams/${id}/detail/`)
      setExamDetail(data)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setDetailLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    async function init() {
      try {
        await loadExams()
      } finally {
        if (active) setLoading(false)
      }
    }
    void init()
    return () => { active = false }
  }, [loadExams])

  const upcomingExams = useMemo(
    () =>
      [...exams]
        .filter((e) => new Date(e.date) >= new Date())
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [exams],
  )

  const nearestExam = upcomingExams[0] ?? null

  const avgPrep = useMemo(() => {
    if (upcomingExams.length === 0) return 0
    const sum = upcomingExams.reduce((acc, e) => acc + e.preparation_pct, 0)
    return Math.round(sum / upcomingExams.length)
  }, [upcomingExams])

  function resetForm() {
    setFormTitle('')
    setFormSubject('')
    setFormDate(toLocalDateInput())
    setFormPriority('medium')
    setFormNotes('')
    setFormModules([])
  }

  function openViewExam(id: number) {
    setSelectedExamId(id)
    setView('detail')
    void loadExamDetail(id)
  }

  function backToList() {
    setView('list')
    setSelectedExamId(null)
    setExamDetail(null)
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault()
    try {
      await api.post('/study/exams/', {
        title: formTitle.trim(),
        subject: formSubject ? Number(formSubject) : null,
        date: formDate,
        priority: formPriority,
        notes: formNotes.trim(),
        modules: formModules.filter(Boolean).map((name) => ({ name, completed: false })),
      })
      notifyStudyActivity()
      toast.success('Exam created')
      resetForm()
      setShowCreateModal(false)
      await loadExams()
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  async function handleDelete(id: number) {
    try {
      await api.delete(`/study/exams/${id}/`)
      toast.success('Exam deleted')
      setConfirmDeleteId(null)
      if (selectedExamId === id) backToList()
      await loadExams()
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  async function toggleModule(index: number) {
    if (!examDetail) return
    const updated = examDetail.modules.map((m, i) =>
      i === index ? { ...m, completed: !m.completed } : m,
    )
    setExamDetail({ ...examDetail, modules: updated })
    try {
      await api.patch(`/study/exams/${examDetail.id}/`, { modules: updated })
    } catch (err) {
      toast.error(getErrorMessage(err))
      void loadExamDetail(examDetail.id)
    }
  }

  if (loading) {
    return (
      <PageShell title="Exam Preparation" subtitle="Track your exam readiness and plan your preparation.">
        <div className="page-card" style={{ padding: 60, textAlign: 'center', opacity: 0.6 }}>
          Loading exams...
        </div>
      </PageShell>
    )
  }

  if (view === 'detail' && selectedExamId) {
    const detailColor = examDetail?.subject?.color ?? '#a78bfa'
    return (
      <PageShell title="Exam Detail" subtitle="">
        <div style={{ marginBottom: 16 }}>
          <button className="ms-back" onClick={backToList} type="button">
            &#8592; Back to Exams
          </button>
        </div>

        {detailLoading ? (
          <div className="ex-center">Loading exam details...</div>
        ) : !examDetail ? (
          <div className="ex-center">Exam not found.</div>
        ) : (
          <div className="ex-detail" style={{ '--ex-color': detailColor, '--sub-color': detailColor } as React.CSSProperties}>
            <div className="ex-hero">
              <div className="ex-hero-left">
                <span className="ms-dot-lg" style={{ background: detailColor, boxShadow: `0 0 16px ${detailColor}55` }} />
                <div>
                  <h2>{examDetail.title}</h2>
                  <div className="ex-hero-meta">
                    {examDetail.subject && <span className="ex-hero-subject">{examDetail.subject.name}</span>}
                    <span className="tk-priority" style={{ background: priorityBadgeStyle(examDetail.priority).bg, color: priorityBadgeStyle(examDetail.priority).color, borderColor: priorityBadgeStyle(examDetail.priority).bg }}>{examDetail.priority}</span>
                  </div>
                  <p className="ex-hero-date">{fullDate(examDetail.date)}</p>
                </div>
              </div>
              <div className="ex-hero-days">
                <div className="ex-hero-num" style={{ color: daysLeftBadgeColor(examDetail.days_left).color }}>{examDetail.days_left}</div>
                <span className="ex-hero-label">days left</span>
              </div>
            </div>

            <div className="ex-card ex-card-block">
              <div className="ex-block-head">
                <span className="ex-card-title">Preparation</span>
                <span className="ex-pct-label">{examDetail.preparation_pct}%</span>
              </div>
              <div className="ex-progress-track">
                <div className="ex-progress-fill" style={{ width: `${examDetail.preparation_pct}%`, background: `linear-gradient(90deg, ${detailColor}, var(--cyan))` }} />
              </div>
              {examDetail.notes && <p className="ex-notes">{examDetail.notes}</p>}
            </div>

            <div className="ex-plan-grid">
              <div className="ex-card ex-plan">
                <span className="ex-card-title">Today</span>
                <strong className="ex-plan-num">{examDetail.today_plan.sessions}</strong>
                <span className="ex-plan-sub">sessions &middot; {examDetail.today_plan.minutes} min</span>
              </div>
              <div className="ex-card ex-plan">
                <span className="ex-card-title">Tomorrow</span>
                <strong className="ex-plan-num">{examDetail.tomorrow_plan.sessions}</strong>
                <span className="ex-plan-sub">sessions &middot; {examDetail.tomorrow_plan.minutes} min</span>
              </div>
            </div>

            <div className="ex-card ex-card-block">
              <div className="ex-block-head">
                <span className="ex-card-title">Modules</span>
                <button className="ghost-action" onClick={() => setShowEditModules(!showEditModules)} type="button" style={{ fontSize: '0.78rem', padding: '4px 12px' }}>
                  {showEditModules ? 'Done' : 'Edit'}
                </button>
              </div>
              {examDetail.modules.length === 0 ? (
                <p className="ex-empty-text">No modules added.</p>
              ) : (
                <div className="ex-modules">
                  {examDetail.modules.map((mod, i) => (
                    <div
                      key={`${mod.name}-${i}`}
                      className={`ex-module ${mod.completed ? 'ex-module-done' : ''}`}
                      onClick={showEditModules ? () => void toggleModule(i) : undefined}
                      style={{ cursor: showEditModules ? 'pointer' : 'default' }}
                    >
                      <span className={`ex-mod-check ${mod.completed ? 'ex-mod-check-done' : ''}`}>{mod.completed ? '✓' : ''}</span>
                      <span className="ex-mod-name">{mod.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {examDetail.weak_areas.length > 0 && (
              <div className="ex-card ex-card-block">
                <span className="ex-card-title">Weak Areas</span>
                <div className="ex-weak-tags">
                  {examDetail.weak_areas.map((area) => (
                    <span key={area} className="ex-weak-tag">{area}</span>
                  ))}
                </div>
              </div>
            )}

            {examDetail.upcoming_sessions.length > 0 && (
              <div className="ex-card ex-card-block">
                <span className="ex-card-title">Upcoming Sessions</span>
                <div className="ex-sessions">
                  {examDetail.upcoming_sessions.map((session) => (
                    <div key={session.id} className="ex-session">
                      <div>
                        <div className="ex-session-title">{session.title}</div>
                        <div className="ex-session-sub">{shortDate(session.due_date)} &middot; {session.duration_minutes} min</div>
                      </div>
                      <span className="tk-priority" style={{ background: priorityBadgeStyle(session.priority).bg, color: priorityBadgeStyle(session.priority).color, borderColor: priorityBadgeStyle(session.priority).bg }}>{session.priority}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="ex-delete-row">
              {confirmDeleteId === examDetail.id ? (
                <>
                  <button className="ghost-action" onClick={() => setConfirmDeleteId(null)} type="button">
                    Cancel
                  </button>
                  <button
                    className="danger-button"
                    onClick={() => void handleDelete(examDetail.id)}
                    type="button"
                  >
                    Confirm Delete
                  </button>
                </>
              ) : (
                <button
                  className="ghost-action"
                  onClick={() => setConfirmDeleteId(examDetail.id)}
                  type="button"
                  style={{ color: '#fca5a5' }}
                >
                  Delete Exam
                </button>
              )}
            </div>
          </div>
        )}
      </PageShell>
    )
  }

  return (
    <PageShell
      title="Exam Preparation"
      subtitle="Track your exam readiness and plan your preparation."
      actions={
        <button className="ms-add-btn" onClick={() => { resetForm(); setShowCreateModal(true) }} type="button">+ Add Exam</button>
      }
    >
      <div className="ex-stats">
        <div className="ex-stat ex-stat-wide" style={{ '--ex-color': nearestExam ? (subjects.find((s) => s.id === nearestExam.subject)?.color ?? '#a78bfa') : '#a78bfa' } as React.CSSProperties}>
          <span className="ex-stat-label">Nearest Exam</span>
          <strong className="ex-stat-title">{nearestExam ? nearestExam.title : 'No exams'}</strong>
          <span className="ex-stat-sub">{nearestExam ? shortDate(nearestExam.date) : 'Add an exam to get started'}</span>
        </div>
        <div className="ex-stat">
          <span className="ex-stat-label">Days Left</span>
          <strong className="ex-stat-num" style={nearestExam ? daysLeftBadgeColor(nearestExam.days_left) : { color: 'var(--muted)' }}>{nearestExam ? nearestExam.days_left : '—'}</strong>
        </div>
        <div className="ex-stat">
          <span className="ex-stat-label">Avg Prep</span>
          <strong className="ex-stat-num">{avgPrep}%</strong>
          <div className="ex-stat-track">
            <div className="ex-stat-fill" style={{ width: `${avgPrep}%` }} />
          </div>
        </div>
      </div>

      {exams.length === 0 ? (
        <EmptyState
          title="No exams yet"
          description="Add an exam to start tracking your preparation and readiness."
          actionLabel="+ Add Exam"
          onAction={() => { resetForm(); setShowCreateModal(true) }}
        />
      ) : (
        <div className="ex-list">
          {exams.map((exam) => {
            const badge = daysLeftBadgeColor(exam.days_left)
            const sub = subjects.find((s) => s.id === exam.subject)
            const color = sub?.color ?? '#a78bfa'
            return (
              <div key={exam.id} className="ex-card" style={{ '--ex-color': color, '--sub-color': color } as React.CSSProperties}>
                <div className="ex-card-head">
                  <span className="ms-avatar" style={{ background: `linear-gradient(135deg, ${color}, ${color}99)` }}>
                    {(exam.title.trim().charAt(0) || '•').toUpperCase()}
                  </span>
                  <div className="ex-card-main">
                    <h3 className="ex-card-name">{exam.title}</h3>
                    <span className="ex-card-subject">{exam.subject_name || 'No subject'}</span>
                  </div>
                  <span className="ex-days-badge" style={{ background: badge.bg, color: badge.color }}>
                    {exam.days_left}d
                  </span>
                </div>

                <div className="ex-card-meta">
                  <span className="ex-card-date">{shortDate(exam.date)}</span>
                  <span className="tk-priority" style={{ background: priorityBadgeStyle(exam.priority).bg, color: priorityBadgeStyle(exam.priority).color, borderColor: priorityBadgeStyle(exam.priority).bg }}>{exam.priority}</span>
                </div>

                <div className="ex-progress-row">
                  <div className="ex-progress-track">
                    <div className="ex-progress-fill" style={{ width: `${exam.preparation_pct}%`, background: `linear-gradient(90deg, ${color}, var(--cyan))` }} />
                  </div>
                  <span className="ex-progress-pct">{exam.preparation_pct}%</span>
                </div>

                {exam.modules.length > 0 && (
                  <div className="ex-mod-chips">
                    {exam.modules.slice(0, 5).map((mod, i) => (
                      <span key={`${mod.name}-${i}`} className={`ex-mod-chip ${mod.completed ? 'ex-mod-chip-done' : ''}`}>
                        {mod.completed ? '✓' : '○'} {mod.name}
                      </span>
                    ))}
                    {exam.modules.length > 5 && <span className="ex-mod-more">+{exam.modules.length - 5} more</span>}
                  </div>
                )}

                <div className="ex-card-foot">
                  <span className="ex-mod-count">{exam.modules.length} module{exam.modules.length === 1 ? '' : 's'}</span>
                  <button className="ms-view-btn" onClick={() => openViewExam(exam.id)} type="button">View Exam <span className="ms-view-arrow">→</span></button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showCreateModal && (
        <div
          className="cal-modal-overlay"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setShowCreateModal(false) }}
        >
          <div
            className="cal-modal"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="zq-modal-head">
              <h2>Add Exam</h2>
              <button className="zq-modal-close" onClick={() => setShowCreateModal(false)} type="button" aria-label="Close">{'\u00d7'}</button>
            </div>
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="cal-modal-field">
                <label>Title *</label>
                <input autoFocus placeholder="e.g. Calculus Midterm" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} required />
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
                  <label>Date *</label>
                  <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} required />
                </div>
                <div className="cal-modal-field">
                  <label>Priority</label>
                  <select value={formPriority} onChange={(e) => setFormPriority(e.target.value)}>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>
              <div className="cal-modal-field">
                <label>Notes</label>
                <textarea placeholder="Optional notes about this exam" value={formNotes} onChange={(e) => setFormNotes(e.target.value)} rows={3} />
              </div>
              <div className="cal-modal-field">
                <label>Modules</label>
                {formModules.map((name, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                    <input
                      placeholder={`Module ${i + 1}`}
                      value={name}
                      onChange={(e) => {
                        const updated = [...formModules]
                        updated[i] = e.target.value
                        setFormModules(updated)
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setFormModules(formModules.filter((_, j) => j !== i))}
                      style={{
                        padding: '0 10px',
                        borderRadius: 8,
                        border: '1px solid var(--line)',
                        background: 'transparent',
                        color: '#fca5a5',
                        cursor: 'pointer',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                      }}
                    >
                      &times;
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setFormModules([...formModules, ''])}
                  className="ghost-action"
                  style={{ fontSize: '0.82rem', padding: '6px 14px', marginTop: 4 }}
                >
                  + Add Module
                </button>
              </div>
              <div className="cal-modal-actions">
                <button type="button" className="cal-modal-cancel" onClick={() => setShowCreateModal(false)}>Cancel</button>
                <button type="submit" className="cal-modal-create">Save Exam</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PageShell>
  )
}
