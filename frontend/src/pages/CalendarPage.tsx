import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import PageShell from '../components/PageShell'
import { api, getErrorMessage } from '../lib/api'

type Exam = { id: number; subject: number | null; subject_name?: string; title: string; date: string; priority?: string; notes?: string }
type Task = { id: number; subject: number | null; subject_name?: string; title: string; due_date?: string; scheduled_for?: string; status: string; priority?: string }
type FocusSession = { id: number; subject: number | null; subject_name: string; task?: number; task_title?: string; duration_minutes: number; completed: boolean; mood?: string; date: string; created_at: string }
type Subject = { id: number; name: string; color: string }

type EventType = 'study' | 'task' | 'exam'
type ViewMode = 'month' | 'week' | 'day'

type CalEvent = {
  id: string
  type: EventType
  day: number
  month: number
  year: number
  title: string
  subtitle: string
  color: string
  duration?: number
  completed?: boolean
  priority?: string
  subjectId?: number | null
  sourceId: number
}

const WEEKDAY_LABELS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const MONTH_ABBR = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

const EVENT_COLORS: Record<EventType, string> = { study: '#76A9A5', task: '#5B8DEF', exam: '#E06060' }
const FILTER_OPTIONS: { key: EventType; label: string; color: string }[] = [
  { key: 'study', label: 'Study Sessions', color: '#76A9A5' },
  { key: 'task', label: 'Tasks', color: '#5B8DEF' },
  { key: 'exam', label: 'Exams', color: '#E06060' },
]

type NewEventForm = { type: EventType; title: string; subject: string; date: string; duration: string }
const HOURS = Array.from({ length: 16 }, (_, i) => i + 6)

function pad2(n: number) { return n < 10 ? '0' + n : '' + n }
function dateKey(y: number, m: number, d: number) { return y + '-' + pad2(m + 1) + '-' + pad2(d) }
function fmt12(h: number) { const ap = h >= 12 ? 'PM' : 'AM'; const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h; return pad2(h12) + ':00 ' + ap }
function startOfWeek(date: Date) { const d = new Date(date); const diff = d.getDay() === 0 ? -6 : 1 - d.getDay(); d.setDate(d.getDate() + diff); return d }
function addDays(date: Date, n: number) { const d = new Date(date); d.setDate(d.getDate() + n); return d }
function sameDay(a: Date, b: Date) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate() }
function isExamSoon(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  const diff = (d.getTime() - Date.now()) / 86400000
  return diff >= 0 && diff <= 14
}

export default function CalendarPage() {
  const now = new Date()
  const [currentMonth, setCurrentMonth] = useState(now.getMonth())
  const [currentYear, setCurrentYear] = useState(now.getFullYear())
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [view, setView] = useState<ViewMode>('month')
  const [exams, setExams] = useState<Exam[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [sessions, setSessions] = useState<FocusSession[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<Record<EventType, boolean>>({ study: true, task: true, exam: true })
  const [search, setSearch] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [newEvent, setNewEvent] = useState<NewEventForm>({ type: 'study', title: '', subject: '', date: '', duration: '50' })
  const [creating, setCreating] = useState(false)
  const [weekStart, setWeekStart] = useState(() => startOfWeek(now))
  const [dayViewDate, setDayViewDate] = useState(() => new Date(now))

  const loadData = useCallback(async () => {
    try {
      const [examRes, taskRes, sessionRes, subjectRes] = await Promise.all([
        api.get<Exam[]>('/study/exams/'),
        api.get<Task[]>('/study/tasks/'),
        api.get<FocusSession[]>('/productivity/focus-sessions/'),
        api.get<Subject[]>('/study/subjects/'),
      ])
      setExams(examRes.data)
      setTasks(taskRes.data)
      setSessions(sessionRes.data)
      setSubjects(subjectRes.data)
    } catch (err) { toast.error(getErrorMessage(err)) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void loadData() }, [loadData])

  const allEvents = useMemo<CalEvent[]>(() => {
    const evts: CalEvent[] = []
    for (const e of exams) {
      if (!e.date) continue
      const d = new Date(e.date + 'T00:00:00')
      evts.push({ id: 'exam-' + e.id, type: 'exam', day: d.getDate(), month: d.getMonth(), year: d.getFullYear(), title: e.title, subtitle: e.subject_name || 'Exam', color: EVENT_COLORS.exam, priority: e.priority, subjectId: e.subject, sourceId: e.id })
    }
    for (const t of tasks) {
      const ds = t.due_date || t.scheduled_for
      if (!ds) continue
      const d = new Date(ds + 'T00:00:00')
      evts.push({ id: 'task-' + t.id, type: 'task', day: d.getDate(), month: d.getMonth(), year: d.getFullYear(), title: t.title, subtitle: t.subject_name || 'Task', color: EVENT_COLORS.task, priority: t.priority, completed: t.status === 'done', subjectId: t.subject, sourceId: t.id })
    }
    for (const s of sessions) {
      if (!s.date) continue
      const d = new Date(s.date + 'T00:00:00')
      evts.push({ id: 'sess-' + s.id, type: 'study', day: d.getDate(), month: d.getMonth(), year: d.getFullYear(), title: s.subject_name || 'Study', subtitle: s.task_title || s.duration_minutes + ' min', color: EVENT_COLORS.study, duration: s.duration_minutes, completed: s.completed, subjectId: s.subject, sourceId: s.id })
    }
    return evts
  }, [exams, tasks, sessions])

  const filteredEvents = useMemo(() => {
    let evts = allEvents.filter((e) => filters[e.type])
    if (search) { const q = search.toLowerCase(); evts = evts.filter((e) => e.title.toLowerCase().includes(q) || e.subtitle.toLowerCase().includes(q)) }
    return evts
  }, [allEvents, filters, search])

  const eventsByDateKey = useMemo(() => {
    const map = new Map<string, CalEvent[]>()
    for (const e of filteredEvents) { const k = dateKey(e.year, e.month, e.day); const arr = map.get(k); if (arr) arr.push(e); else map.set(k, [e]) }
    return map
  }, [filteredEvents])

  const todayStr = dateKey(now.getFullYear(), now.getMonth(), now.getDate())

  const selectedDayEvents = useMemo(() => {
    if (selectedDay == null) return []
    return filteredEvents.filter((e) => e.day === selectedDay && e.month === currentMonth && e.year === currentYear).sort((a, b) => {
      const aMin = a.completed ? 1 : 0, bMin = b.completed ? 1 : 0
      return aMin - bMin
    })
  }, [filteredEvents, selectedDay, currentMonth, currentYear])

  const selectedDateObj = useMemo(() => selectedDay != null ? new Date(currentYear, currentMonth, selectedDay) : null, [selectedDay, currentMonth, currentYear])

  const prevMonth = () => { setSelectedDay(null); if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear((y) => y - 1) } else setCurrentMonth((m) => m - 1) }
  const nextMonth = () => { setSelectedDay(null); if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear((y) => y + 1) } else setCurrentMonth((m) => m + 1) }
  const goToday = () => { const n = new Date(); setCurrentMonth(n.getMonth()); setCurrentYear(n.getFullYear()); setSelectedDay(n.getDate()); setDayViewDate(n); setWeekStart(startOfWeek(n)) }

  const monthCells = useMemo(() => {
    const first = new Date(currentYear, currentMonth, 1)
    const total = new Date(currentYear, currentMonth + 1, 0).getDate()
    let blanks = first.getDay() - 1; if (blanks < 0) blanks = 6
    const cells: (number | null)[] = []
    for (let i = 0; i < blanks; i++) cells.push(null)
    for (let i = 1; i <= total; i++) cells.push(i)
    return cells
  }, [currentMonth, currentYear])

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])

  function toggleFilter(key: EventType) { setFilters((p) => ({ ...p, [key]: !p[key] })) }

  async function createEvent() {
    if (!newEvent.title.trim()) { toast.error('Title is required'); return }
    setCreating(true)
    try {
      if (newEvent.type === 'task') {
        await api.post('/study/tasks/', { title: newEvent.title.trim(), subject: newEvent.subject ? Number(newEvent.subject) : null, due_date: newEvent.date || undefined, priority: 'medium', status: 'todo' })
      } else if (newEvent.type === 'exam') {
        await api.post('/study/exams/', { title: newEvent.title.trim(), subject: newEvent.subject ? Number(newEvent.subject) : null, date: newEvent.date || undefined, priority: 'medium' })
      } else {
        await api.post('/productivity/focus-sessions/', { subject: newEvent.subject ? Number(newEvent.subject) : null, duration_minutes: Number(newEvent.duration) || 50, date: newEvent.date || undefined, completed: false })
      }
      toast.success('Event created')
      setShowAddModal(false)
      setNewEvent({ type: 'study', title: '', subject: '', date: '', duration: '50' })
      await loadData()
    } catch (err) { toast.error(getErrorMessage(err)) }
    finally { setCreating(false) }
  }

  function selectDayFromMonth(d: number) {
    setSelectedDay(d)
    setDayViewDate(new Date(currentYear, currentMonth, d))
    setView('day')
  }

  function navWeek(dir: number) { setWeekStart((p) => addDays(p, dir * 7)) }
  function navDay(dir: number) { const nd = addDays(dayViewDate, dir); setDayViewDate(nd); setSelectedDay(nd.getDate()); if (nd.getMonth() !== currentMonth || nd.getFullYear() !== currentYear) { setCurrentMonth(nd.getMonth()); setCurrentYear(nd.getFullYear()) } }

  function openAddModal() {
    const dk = selectedDay != null ? dateKey(currentYear, currentMonth, selectedDay) : todayStr
    setNewEvent((p) => ({ ...p, date: dk.slice(0, 10) }))
    setShowAddModal(true)
  }

  if (loading) return <PageShell eyebrow="Calendar" title="Loading..." subtitle="Fetching your schedule."><div className="page-card">Loading...</div></PageShell>

  const examCount = allEvents.filter((e) => e.type === 'exam').length

  return (
    <PageShell className="cal-page" eyebrow="Calendar" title="Calendar" subtitle="Your complete study schedule." actions={<div className="cal-top-actions"><button className="cal-add-btn" onClick={openAddModal} type="button">+ Add Event</button></div>}>
      <div className="cal-controls">
        <div className="cal-nav">
          <button className="cal-nav-btn" onClick={() => view === 'month' ? prevMonth() : view === 'week' ? navWeek(-1) : navDay(-1)} type="button">{'\u2039'}</button>
          <div className="cal-nav-center">
            <span className="cal-nav-title">
              {view === 'month' ? MONTH_NAMES[currentMonth] + ' ' + currentYear :
               view === 'week' ? MONTH_ABBR[weekDays[0].getMonth()] + ' ' + weekDays[0].getDate() + ' \u2014 ' + MONTH_ABBR[weekDays[6].getMonth()] + ' ' + weekDays[6].getDate() :
               dayViewDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </span>
            <button className="cal-today-btn" onClick={goToday} type="button">Today</button>
          </div>
          <button className="cal-nav-btn" onClick={() => view === 'month' ? nextMonth() : view === 'week' ? navWeek(1) : navDay(1)} type="button">{'\u203A'}</button>
        </div>
        <div className="cal-view-tabs">
          {(['month', 'week', 'day'] as ViewMode[]).map((v) => (
            <button key={v} className={'cal-view-tab' + (view === v ? ' active' : '')} onClick={() => setView(v)} type="button">{v.charAt(0).toUpperCase() + v.slice(1)}</button>
          ))}
        </div>
        <div className="cal-controls-right">
          <div className="cal-search-wrap">
            <input placeholder="Search events..." value={search} onChange={(e) => setSearch(e.target.value)} type="text" />
          </div>
          <div className="cal-filter-wrap">
            <button className={'cal-filter-btn' + (showFilters ? ' active' : '')} onClick={() => setShowFilters(!showFilters)} type="button">{'\u2699'} Filters</button>
            {showFilters && (
              <div className="cal-filter-dropdown">
                <span className="cal-filter-label">SHOW</span>
                {FILTER_OPTIONS.map((f) => (
                  <button key={f.key} className={'cal-filter-item' + (filters[f.key] ? ' on' : '')} onClick={() => toggleFilter(f.key)} type="button">
                    <span className="cal-filter-check">{filters[f.key] ? '\u2611' : '\u2610'}</span>
                    <span className="cal-filter-dot" style={{ background: f.color }} />
                    {f.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="cal-body">
        <div className="cal-grid-wrap">
          {view === 'month' && (
            <>
              <div className="cal-month-label">{MONTH_ABBR[currentMonth]} {currentYear}</div>
              <div className="cal-weekdays">
                {WEEKDAY_LABELS.map((d) => <span key={d}>{d}</span>)}
              </div>
              <div className="cal-month-grid">
                {monthCells.map((day, idx) => {
                  if (day == null) return <div key={'b-' + idx} className="cal-cell empty" />
                  const dk = dateKey(currentYear, currentMonth, day)
                  const isToday = dk === todayStr
                  const isSel = day === selectedDay
                  const de = eventsByDateKey.get(dk) || []
                  return (
                    <div key={dk} className={'cal-cell' + (isToday ? ' today' : '') + (isSel ? ' selected' : '') + (de.length ? ' has-events' : '')} onClick={() => selectDayFromMonth(day)}>
                      <span className={'cal-day-num' + (isToday ? ' today-num' : '')}>{day}</span>
                      <div className="cal-cell-pills">
                        {de.slice(0, 3).map((ev) => (
                          <span key={ev.id} className="cal-pill" style={{ background: ev.color + '1a', color: ev.color, borderLeft: '3px solid ' + ev.color }}>{ev.title}</span>
                        ))}
                        {de.length > 3 && <span className="cal-more">+{de.length - 3} more</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {view === 'week' && (
            <div className="cal-week-wrap">
              <div className="cal-week-header">
                {weekDays.map((wd) => {
                  const dk = dateKey(wd.getFullYear(), wd.getMonth(), wd.getDate())
                  const isT = dk === todayStr
                  return (
                    <div key={dk} className={'cal-week-hcell' + (isT ? ' today' : '')}>
                      <span className="cal-week-hday">{WEEKDAY_LABELS[wd.getDay() === 0 ? 6 : wd.getDay() - 1]}</span>
                      <span className={'cal-week-hnum' + (isT ? ' today-num' : '')}>{wd.getDate()}</span>
                    </div>
                  )
                })}
              </div>
              <div className="cal-week-body">
                <div className="cal-week-times">
                  {HOURS.map((h) => <div key={h} className="cal-week-time">{fmt12(h)}</div>)}
                </div>
                {weekDays.map((wd) => {
                  const dk = dateKey(wd.getFullYear(), wd.getMonth(), wd.getDate())
                  const de = eventsByDateKey.get(dk) || []
                  return (
                    <div key={dk} className="cal-week-col">
                      {HOURS.map((h) => <div key={h} className="cal-week-cell" />)}
                      {de.map((ev) => (
                        <div key={ev.id} className="cal-week-event" style={{ background: ev.color + '20', borderLeft: '3px solid ' + ev.color, color: ev.color }}>
                          <span className="cal-week-ev-title">{ev.title}</span>
                          {ev.duration && <span className="cal-week-ev-sub">{ev.duration}m</span>}
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {view === 'day' && (
            <div className="cal-day-wrap">
              <div className="cal-day-header">
                <span className="cal-day-hname">{dayViewDate.toLocaleDateString(undefined, { weekday: 'long' })}</span>
                <span className="cal-day-hnum">{dayViewDate.getDate()} {MONTH_ABBR[dayViewDate.getMonth()]}</span>
              </div>
              <div className="cal-day-timeline">
                {HOURS.map((h) => <div key={h} className="cal-day-time">{fmt12(h)}</div>)}
              </div>
              <div className="cal-day-events-col">
                {HOURS.map((h) => <div key={h} className="cal-day-slot" />)}
                {filteredEvents.filter((e) => e.day === dayViewDate.getDate() && e.month === dayViewDate.getMonth() && e.year === dayViewDate.getFullYear()).map((ev) => (
                  <div key={ev.id} className="cal-day-event" style={{ background: ev.color + '1a', borderLeft: '3px solid ' + ev.color, color: ev.color }}>
                    <span className="cal-day-ev-title">{ev.title}</span>
                    <span className="cal-day-ev-sub">{ev.subtitle}{ev.duration ? ' \u00b7 ' + ev.duration + ' min' : ''}</span>
                    {ev.completed && <span className="cal-day-ev-done">{'\u2713'} Completed</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right day panel */}
        {selectedDay != null && selectedDateObj && (
          <div className="cal-day-panel">
            <div className="cal-panel-header">
              <div>
                <span className="cal-panel-dayname">{selectedDateObj.toLocaleDateString(undefined, { weekday: 'long' }).toUpperCase()}</span>
                <span className="cal-panel-date">{selectedDateObj.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}</span>
              </div>
              <span className="cal-panel-count">{selectedDayEvents.length} events</span>
            </div>
            <div className="cal-panel-list">
              {selectedDayEvents.length === 0 ? (
                <div className="cal-panel-empty">
                  <p>No events scheduled.</p>
                  <button className="cal-panel-add" onClick={openAddModal} type="button">+ Add Event</button>
                </div>
              ) : selectedDayEvents.map((ev) => (
                <div key={ev.id} className="cal-panel-item">
                  <div className="cal-panel-item-indicator" style={{ background: ev.color }} />
                  <div className="cal-panel-item-body">
                    <div className="cal-panel-item-head">
                      <span className="cal-panel-item-title">{ev.title}</span>
                      {ev.completed && <span className="cal-panel-done">{'\u2713'} Completed</span>}
                    </div>
                    <span className="cal-panel-item-sub">{ev.subtitle}{ev.duration ? ' \u00b7 ' + ev.duration + ' min' : ''}</span>
                    {ev.priority && <span className="cal-panel-item-priority">Priority: {ev.priority}</span>}
                    {ev.type === 'exam' && isExamSoon(dateKey(ev.year, ev.month, ev.day)) && (
                      <span className="cal-panel-exam-badge">Exam Soon</span>
                    )}
                    {ev.type === 'study' && (
                      <button className="cal-panel-focus-btn" onClick={() => window.location.href = '/focus'} type="button">Start Focus Session</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <button className="cal-panel-add-btn" onClick={openAddModal} type="button">+ Add Event</button>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="cal-legend">
        {FILTER_OPTIONS.map((f) => (
          <span key={f.key}><span className="cal-legend-dot" style={{ background: f.color }} />{f.label}</span>
        ))}
        {examCount > 0 && <span className="cal-legend-exam">{'\uD83C\uDF93'} {examCount} exams upcoming</span>}
      </div>

      {/* Add Event Modal */}
      {showAddModal && (
        <div className="cal-modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="cal-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Create Event</h3>
            <div className="cal-modal-field">
              <label>Type</label>
              <select value={newEvent.type} onChange={(e) => setNewEvent((p) => ({ ...p, type: e.target.value as EventType }))}>
                <option value="study">Study Session</option>
                <option value="task">Task</option>
                <option value="exam">Exam</option>
              </select>
            </div>
            <div className="cal-modal-field">
              <label>Title</label>
              <input placeholder="Event title" value={newEvent.title} onChange={(e) => setNewEvent((p) => ({ ...p, title: e.target.value }))} />
            </div>
            <div className="cal-modal-field">
              <label>Subject</label>
              <select value={newEvent.subject} onChange={(e) => setNewEvent((p) => ({ ...p, subject: e.target.value }))}>
                <option value="">None</option>
                {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="cal-modal-field">
              <label>Date</label>
              <input type="date" value={newEvent.date} onChange={(e) => setNewEvent((p) => ({ ...p, date: e.target.value }))} />
            </div>
            {newEvent.type === 'study' && (
              <div className="cal-modal-field">
                <label>Duration</label>
                <select value={newEvent.duration} onChange={(e) => setNewEvent((p) => ({ ...p, duration: e.target.value }))}>
                  <option value="25">25 min</option>
                  <option value="50">50 min</option>
                  <option value="60">60 min</option>
                  <option value="90">90 min</option>
                </select>
              </div>
            )}
            <div className="cal-modal-actions">
              <button className="cal-modal-cancel" onClick={() => setShowAddModal(false)} type="button">Cancel</button>
              <button className="cal-modal-create" disabled={creating} onClick={() => void createEvent()} type="button">{creating ? 'Creating...' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  )
}
