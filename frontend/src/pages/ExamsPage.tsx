import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { toast } from 'react-toastify'
import PageShell from '../components/PageShell'
import EmptyState from '../components/EmptyState'
import { api, getErrorMessage } from '../lib/api'

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

type Subject = { id: number; name: string }

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
    return (
      <PageShell title="Exam Detail" subtitle="">
        <div style={{ marginBottom: 16 }}>
          <button className="ghost-action" onClick={backToList} type="button">
            &#8249; Back to Exams
          </button>
        </div>

        {detailLoading ? (
          <div className="page-card" style={{ padding: 60, textAlign: 'center', opacity: 0.6 }}>
            Loading exam details...
          </div>
        ) : !examDetail ? (
          <div className="page-card" style={{ padding: 60, textAlign: 'center' }}>
            Exam not found.
          </div>
        ) : (
          <>
            <div className="page-card" style={{ padding: '1.5rem', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {examDetail.subject && (
                      <span
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          background: examDetail.subject.color,
                          flexShrink: 0,
                        }}
                      />
                    )}
                    <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700 }}>{examDetail.title}</h2>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
                    {examDetail.subject && (
                      <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{examDetail.subject.name}</span>
                    )}
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '3px 10px',
                        borderRadius: 8,
                        background: priorityBadgeStyle(examDetail.priority).bg,
                        color: priorityBadgeStyle(examDetail.priority).color,
                        textTransform: 'capitalize',
                      }}
                    >
                      {examDetail.priority}
                    </span>
                  </div>
                  <p style={{ margin: '8px 0 0', fontSize: '0.85rem', color: 'var(--muted)' }}>
                    {fullDate(examDetail.date)}
                  </p>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div
                    style={{
                      fontSize: '2.5rem',
                      fontWeight: 800,
                      lineHeight: 1,
                      ...(() => {
                        const badge = daysLeftBadgeColor(examDetail.days_left)
                        return { color: badge.color }
                      })(),
                    }}
                  >
                    {examDetail.days_left}
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 600 }}>days left</span>
                </div>
              </div>

              <div style={{ marginTop: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Preparation</span>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>{examDetail.preparation_pct}%</span>
                </div>
                <div className="streak-bar" style={{ height: 10 }}>
                  <i style={{ width: `${examDetail.preparation_pct}%` }} />
                </div>
              </div>

              {examDetail.notes && (
                <p style={{ marginTop: 14, fontSize: '0.85rem', color: 'var(--muted)', lineHeight: 1.5 }}>
                  {examDetail.notes}
                </p>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div className="page-card" style={{ padding: '1.25rem' }}>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: 4 }}>{examDetail.today_plan.sessions}</div>
                <div style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>
                  sessions &middot; {examDetail.today_plan.minutes} min
                </div>
              </div>
              <div className="page-card" style={{ padding: '1.25rem' }}>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: 4 }}>{examDetail.tomorrow_plan.sessions}</div>
                <div style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>
                  sessions &middot; {examDetail.tomorrow_plan.minutes} min
                </div>
              </div>
            </div>

            <div className="page-card" style={{ padding: '1.25rem', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 12 }}>
                <button className="ghost-action" onClick={() => setShowEditModules(!showEditModules)} type="button" style={{ fontSize: '0.78rem', padding: '4px 12px' }}>
                  {showEditModules ? 'Done' : 'Edit'}
                </button>
              </div>
              {examDetail.modules.length === 0 ? (
                <p style={{ fontSize: '0.85rem', color: 'var(--muted)', margin: 0 }}>No modules added.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {examDetail.modules.map((mod, i) => (
                    <div
                      key={`${mod.name}-${i}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '8px 12px',
                        borderRadius: 8,
                        background: 'rgba(255,255,255,0.03)',
                        cursor: showEditModules ? 'pointer' : 'default',
                      }}
                      onClick={showEditModules ? () => void toggleModule(i) : undefined}
                    >
                      <span
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 6,
                          border: mod.completed ? 'none' : '2px solid var(--line)',
                          background: mod.completed ? 'linear-gradient(135deg, var(--purple), var(--cyan))' : 'transparent',
                          display: 'grid',
                          placeItems: 'center',
                          color: '#fff',
                          fontSize: '0.72rem',
                          fontWeight: 900,
                          flexShrink: 0,
                        }}
                      >
                        {mod.completed ? '✓' : ''}
                      </span>
                      <span
                        style={{
                          fontSize: '0.88rem',
                          fontWeight: 500,
                          textDecoration: mod.completed ? 'line-through' : 'none',
                          opacity: mod.completed ? 0.6 : 1,
                        }}
                      >
                        {mod.name}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {examDetail.weak_areas.length > 0 && (
              <div className="page-card" style={{ padding: '1.25rem', marginBottom: 16 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                  {examDetail.weak_areas.map((area) => (
                    <span
                      key={area}
                      style={{
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        padding: '4px 12px',
                        borderRadius: 8,
                        background: 'rgba(239,68,68,0.12)',
                        color: '#fca5a5',
                      }}
                    >
                      {area}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {examDetail.upcoming_sessions.length > 0 && (
              <div className="page-card" style={{ padding: '1.25rem', marginBottom: 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                  {examDetail.upcoming_sessions.map((session) => (
                    <div
                      key={session.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        borderRadius: 8,
                        background: 'rgba(255,255,255,0.03)',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{session.title}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                          {shortDate(session.due_date)} &middot; {session.duration_minutes} min
                        </div>
                      </div>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          padding: '3px 10px',
                          borderRadius: 8,
                          background: priorityBadgeStyle(session.priority).bg,
                          color: priorityBadgeStyle(session.priority).color,
                          textTransform: 'capitalize',
                        }}
                      >
                        {session.priority}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
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
          </>
        )}
      </PageShell>
    )
  }

  return (
    <PageShell
      title="Exam Preparation"
      subtitle="Track your exam readiness and plan your preparation."
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
        <div className="page-card" style={{ padding: '1.1rem' }}>
          <div style={{ fontSize: '1rem', fontWeight: 700, marginTop: 6, minHeight: 30 }}>
            {nearestExam ? nearestExam.title : 'No exams'}
          </div>
          {nearestExam && (
            <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: 2 }}>
              {shortDate(nearestExam.date)}
            </div>
          )}
        </div>
        <div className="page-card" style={{ padding: '1.1rem' }}>
          <div
            style={{
              fontSize: '1.8rem',
              fontWeight: 800,
              marginTop: 4,
              ...(nearestExam ? daysLeftBadgeColor(nearestExam.days_left) : { color: 'var(--muted)' }),
            }}
          >
            {nearestExam ? nearestExam.days_left : '—'}
          </div>
        </div>
        <div className="page-card" style={{ padding: '1.1rem' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: 4 }}>{avgPrep}%</div>
          <div className="streak-bar" style={{ marginTop: 8 }}>
            <i style={{ width: `${avgPrep}%` }} />
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {exams.map((exam) => {
            const badge = daysLeftBadgeColor(exam.days_left)
            return (
              <div className="page-card" key={exam.id} style={{ padding: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {exam.subject_name && (
                        <span
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            background: 'var(--purple)',
                            flexShrink: 0,
                          }}
                        />
                      )}
                      <strong style={{ fontSize: '1rem' }}>{exam.title}</strong>
                      {exam.subject_name && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{exam.subject_name}</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{shortDate(exam.date)}</span>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          padding: '3px 10px',
                          borderRadius: 8,
                          background: badge.bg,
                          color: badge.color,
                        }}
                      >
                        {exam.days_left}d left
                      </span>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          padding: '3px 10px',
                          borderRadius: 8,
                          background: priorityBadgeStyle(exam.priority).bg,
                          color: priorityBadgeStyle(exam.priority).color,
                          textTransform: 'capitalize',
                        }}
                      >
                        {exam.priority}
                      </span>
                    </div>
                  </div>
                  <button className="ghost-action" onClick={() => openViewExam(exam.id)} type="button" style={{ fontSize: '0.82rem', flexShrink: 0 }}>
                    View Exam
                  </button>
                </div>

                <div style={{ marginTop: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>Preparation</span>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>{exam.preparation_pct}%</span>
                  </div>
                  <div className="streak-bar">
                    <i style={{ width: `${exam.preparation_pct}%` }} />
                  </div>
                </div>

                {exam.modules.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                    {exam.modules.slice(0, 5).map((mod, i) => (
                      <span
                        key={`${mod.name}-${i}`}
                        style={{
                          fontSize: '0.72rem',
                          padding: '3px 8px',
                          borderRadius: 6,
                          background: mod.completed ? 'rgba(74,222,128,0.1)' : 'rgba(255,255,255,0.05)',
                          color: mod.completed ? '#86efac' : 'var(--muted)',
                          fontWeight: 500,
                        }}
                      >
                        {mod.completed ? '✓' : '○'} {mod.name}
                      </span>
                    ))}
                    {exam.modules.length > 5 && (
                      <span style={{ fontSize: '0.72rem', color: 'var(--muted)', padding: '3px 6px' }}>
                        +{exam.modules.length - 5} more
                      </span>
                    )}
                  </div>
                )}
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
