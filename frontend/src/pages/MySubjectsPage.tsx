import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { toast } from 'react-toastify'
import PageShell from '../components/PageShell'
import { api, getErrorMessage } from '../lib/api'
import { notifyStudyActivity } from '../lib/studyActivity'

type Subject = {
  id: number; name: string; subject_code: string; teacher: string; color: string
  weekly_goal_hours: number; weak_topics: string; total_topics: number
  topics_completed: number; target_grade: string; created_at: string
}
type Task = { id: number; title: string; due_date: string; priority: string; status: string }
type Exam = { id: number; title: string; date: string; priority: string }

const COLORS = ['#ff6b4a', '#cb89ff', '#2dd4bf', '#fbbf24', '#fb7185', '#38bdf8', '#a78bfa', '#4ade80']

function daysUntil(d: string) { return Math.ceil((new Date(`${d}T00:00:00`).getTime() - new Date().setHours(0, 0, 0, 0)) / 86_400_000) }

export default function MySubjectsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [detailId, setDetailId] = useState<number | null>(null)
  const [detailTasks, setDetailTasks] = useState<Task[]>([])
  const [detailExams, setDetailExams] = useState<Exam[]>([])
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)

  const [fName, setFName] = useState('')
  const [fCode, setFCode] = useState('')
  const [fTeacher, setFTeacher] = useState('')
  const [fColor, setFColor] = useState(COLORS[0])
  const [fGoal, setFGoal] = useState('5')
  const [fWeak, setFWeak] = useState('')
  const [fGrade, setFGrade] = useState('')

  const load = useCallback(async () => {
    try { const { data } = await api.get<Subject[]>('/study/subjects/'); setSubjects(data) }
    catch (err) { toast.error(getErrorMessage(err)) }
  }, [])

  useEffect(() => { let a = true; load().finally(() => { if (a) setLoading(false) }); return () => { a = false } }, [load])

  const openDetail = useCallback(async (id: number) => {
    if (detailId === id) { setDetailId(null); return }
    setDetailId(id)
    try {
      const [t, e] = await Promise.all([
        api.get<Task[]>('/study/tasks/', { params: { subject: id } }),
        api.get<Exam[]>('/study/exams/', { params: { subject: id } }),
      ])
      setDetailTasks(t.data); setDetailExams(e.data)
    } catch (err) { toast.error(getErrorMessage(err)) }
  }, [detailId])

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    try {
      await api.post('/study/subjects/', {
        name: fName.trim(), subject_code: fCode.trim(), teacher: fTeacher.trim(),
        color: fColor,         weekly_goal_hours: Number(fGoal) || 5, weak_topics: fWeak.trim(),
        target_grade: fGrade.trim(),
      })
      notifyStudyActivity()
      toast.success('Subject created'); resetForm(); setShowModal(false); await load()
    } catch (err) { toast.error(getErrorMessage(err)) }
  }

  async function handleDelete(id: number) {
    try {
      await api.delete(`/study/subjects/${id}/`); toast.success('Subject deleted')
      if (detailId === id) setDetailId(null); setConfirmDeleteId(null); await load()
    } catch (err) { toast.error(getErrorMessage(err)) }
  }

  function resetForm() { setFName(''); setFCode(''); setFTeacher(''); setFColor(COLORS[0]); setFGoal('5'); setFWeak(''); setFGrade('') }

  const detail = subjects.find((s) => s.id === detailId)

  return (
    <PageShell
      className="ms-page"
      title="My Subjects"
      subtitle="Track every subject, monitor topic progress, and keep an eye on weak areas."
      actions={
        !loading && !detail ? (
          <button className="ms-add-btn" onClick={() => { resetForm(); setShowModal(true) }} type="button">+ Add Subject</button>
        ) : undefined
      }
    >
      {loading ? <div className="ms-loading">Loading subjects...</div>
      : subjects.length === 0 ? (
        <div className="ms-empty">
          <h2>Add your first subject</h2>
          <p>Subjects let Flox AI track your topics, weak areas, and progress.</p>
        </div>
      ) : detail ? (
        /* ── Detail View ── */
        <div className="ms-detail">
          <button className="ms-back" onClick={() => setDetailId(null)} type="button">← Back to Subjects</button>
          <div className="ms-detail-hero" style={{ borderColor: `${detail.color}33` }}>
            <div className="ms-detail-left">
              <span className="ms-dot-lg" style={{ background: detail.color, boxShadow: `0 0 16px ${detail.color}55` }} />
              <div>
                <h2>{detail.name}</h2>
                <span className="ms-detail-sub">{detail.subject_code} · {detail.teacher || 'No teacher'}</span>
              </div>
            </div>
            <div className="ms-detail-pct">{detail.total_topics ? Math.round((detail.topics_completed / detail.total_topics) * 100) : 0}% Complete</div>
          </div>

          <div className="ms-detail-grid">
            {/* Topics */}
            <div className="ms-card">
              <span className="ms-card-title">Topics</span>
              <div className="ms-topics-list">
                {Array.from({ length: detail.total_topics || 0 }, (_, i) => {
                  const done = i < detail.topics_completed
                  const weakList = detail.weak_topics ? detail.weak_topics.split(',').map((w) => w.trim().toLowerCase()) : []
                  const topicNames = ['Introduction', 'Classes', 'Objects', 'Constructors', 'Inheritance', 'Polymorphism', 'Encapsulation', 'Abstraction', 'Interfaces', 'Generics', 'Exception Handling', 'File I/O', 'Recursion', 'Sorting', 'Searching', 'Graphs', 'Trees', 'Hashing', 'Dynamic Programming', 'Networks']
                  const name = topicNames[i] || `Topic ${i + 1}`
                  const isWeak = weakList.some((w) => name.toLowerCase().includes(w))
                  return (
                    <div key={i} className={`ms-topic ${done ? 'ms-topic-done' : ''} ${isWeak ? 'ms-topic-weak' : ''}`}>
                      <span className="ms-topic-check">{done ? '✓' : '○'}</span>
                      <span>{name}</span>
                      {isWeak && <span className="ms-weak-badge">weak</span>}
                    </div>
                  )
                })}
                {detail.total_topics === 0 && <p className="ms-empty-text">No topics defined yet.</p>}
              </div>
            </div>

            {/* Sidebar */}
            <div className="ms-detail-side">
              <div className="ms-card">
                <span className="ms-card-title">Study Time</span>
                <strong className="ms-stat-big">{detail.weekly_goal_hours}h/week</strong>
                <span className="ms-stat-sub">{detail.target_grade ? `Target: ${detail.target_grade}` : 'No target set'}</span>
              </div>

              {detail.weak_topics && (
                <div className="ms-card ms-card-warn">
                  <span className="ms-card-title">Weak Areas</span>
                  <div className="ms-weak-tags">
                    {detail.weak_topics.split(',').map((w, i) => <span key={i} className="ms-weak-tag">{w.trim()}</span>)}
                  </div>
                </div>
              )}

              <div className="ms-card">
                <span className="ms-card-title">Tasks ({detailTasks.length})</span>
                <div className="ms-detail-list">
                  {detailTasks.length ? detailTasks.slice(0, 5).map((t) => (
                    <div key={t.id} className={`ms-list-item ${t.status === 'done' ? 'ms-list-done' : ''}`}>
                      <span>{t.title}</span>
                      <span className="ms-priority" data-p={t.priority}>{t.priority}</span>
                    </div>
                  )) : <p className="ms-empty-text">No tasks yet.</p>}
                </div>
              </div>

              <div className="ms-card">
                <span className="ms-card-title">Exams ({detailExams.length})</span>
                <div className="ms-detail-list">
                  {detailExams.length ? detailExams.slice(0, 3).map((ex) => (
                    <div key={ex.id} className="ms-list-item">
                      <span>{ex.title}</span>
                      <span className={daysUntil(ex.date) <= 7 ? 'ms-days-urgent' : 'ms-days'}>{daysUntil(ex.date)}d</span>
                    </div>
                  )) : <p className="ms-empty-text">No exams yet.</p>}
                </div>
              </div>

              <div className="ms-delete-row">
                {confirmDeleteId === detail.id ? (
                  <>
                    <span className="ms-delete-confirm">Delete this subject?</span>
                    <button className="ghost-action" onClick={() => setConfirmDeleteId(null)} type="button">Cancel</button>
                    <button className="danger-button" onClick={() => void handleDelete(detail.id)} type="button">Confirm</button>
                  </>
                ) : (
                  <button className="danger-button" onClick={() => setConfirmDeleteId(detail.id)} type="button">Delete Subject</button>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ── Cards Grid ── */
        <div className="ms-grid">
          {subjects.map((sub) => {
            const pct = sub.total_topics ? Math.round((sub.topics_completed / sub.total_topics) * 100) : 0
            const remaining = sub.total_topics - sub.topics_completed
            const weakList = sub.weak_topics ? sub.weak_topics.split(',').map((w) => w.trim()) : []
            return (
              <div key={sub.id} className="ms-card ms-card-subject" style={{ '--sub-color': sub.color } as React.CSSProperties}>
                <div className="ms-card-aura" aria-hidden="true" />
                <div className="ms-card-top">
                  <span className="ms-avatar" style={{ background: `linear-gradient(135deg, ${sub.color}, ${sub.color}99)` }}>
                    {(sub.name.trim().charAt(0) || '•').toUpperCase()}
                  </span>
                  <span className="ms-code">{sub.subject_code}</span>
                </div>
                <h3 className="ms-card-name">{sub.name}</h3>
                <div className="ms-card-teacher">{sub.teacher || 'No teacher'}</div>
                <div className="ms-progress-row">
                  <div className="ms-progress-track">
                    <div className="ms-progress-fill" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${sub.color}, var(--cyan))` }} />
                  </div>
                  <span className="ms-progress-pct">{pct}%</span>
                </div>
                <div className="ms-card-meta">
                  <span>{sub.topics_completed} / {sub.total_topics} topics</span>
                  {remaining > 0 && <span className="ms-remaining">{remaining} remaining</span>}
                </div>
                <div className="ms-card-footer">
                  {weakList.length > 0 && (
                    <div className="ms-card-weak">
                      <span>Next:</span> <strong>{weakList[0]}</strong>
                    </div>
                  )}
                  <button className="ms-view-btn" onClick={() => void openDetail(sub.id)} type="button">View Subject <span className="ms-view-arrow">→</span></button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Add Modal ── */}
      {showModal && (
        <div className="cal-modal-overlay" onClick={() => setShowModal(false)} onMouseDown={(e) => e.target === e.currentTarget && setShowModal(false)}>
            <section className="cal-modal" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="zq-modal-head">
              <h2>Add Subject</h2>
              <button className="zq-modal-close" onClick={() => setShowModal(false)} type="button" aria-label="Close">{'\u00d7'}</button>
            </div>
            <form style={{ display: 'flex', flexDirection: 'column', gap: 12 }} onSubmit={handleCreate}>
              <div className="cal-modal-field"><label>Subject Name *</label><input autoFocus placeholder="Computer Science" value={fName} onChange={(e) => setFName(e.target.value)} required /></div>
              <div className="cal-modal-field"><label>Subject Code</label><input placeholder="CS101" value={fCode} onChange={(e) => setFCode(e.target.value)} /></div>
              <div className="cal-modal-field"><label>Teacher</label><input placeholder="Dr. Smith" value={fTeacher} onChange={(e) => setFTeacher(e.target.value)} /></div>
              <div className="cal-modal-field">
                <label>Color</label>
                <div className="ms-color-row">
                  {COLORS.map((c) => <button key={c} type="button" className={`ms-color-btn ${fColor === c ? 'active' : ''}`} style={{ background: c }} onClick={() => setFColor(c)} />)}
                </div>
              </div>
              <div className="cal-modal-field"><label>Target Grade</label><input placeholder="A" value={fGrade} onChange={(e) => setFGrade(e.target.value)} /></div>
              <div className="cal-modal-field"><label>Weekly Goal (hrs)</label><input min="0" step="0.5" type="number" value={fGoal} onChange={(e) => setFGoal(e.target.value)} /></div>
              <div className="cal-modal-field"><label>Weak Topics</label><input placeholder="Inheritance, Polymorphism, ..." value={fWeak} onChange={(e) => setFWeak(e.target.value)} /></div>
              <div className="cal-modal-actions">
                <button type="button" className="cal-modal-cancel" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="cal-modal-create">Save Subject</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </PageShell>
  )
}
