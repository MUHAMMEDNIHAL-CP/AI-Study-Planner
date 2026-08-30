import { useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as RPointerEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import PageShell from '../components/PageShell'
import { api, getErrorMessage } from '../lib/api'
import { notifyStudyActivity } from '../lib/studyActivity'

/* ── Types ─────────────────────────────────────────────────── */

type EventType = 'study' | 'task' | 'exam' | 'assignment' | 'reminder' | 'personal'
type ViewMode = 'day' | 'week' | 'month' | 'schedule'

type Exam = {
  id: number
  subject: number | null
  subject_name?: string
  title: string
  date: string
  priority?: string
  preparation_pct?: number
  days_left?: number
}
type Task = {
  id: number
  subject: number | null
  subject_name?: string
  title: string
  due_date?: string | null
  scheduled_for?: string | null
  duration_minutes: number
  status: string
  priority?: string
}
type Subject = { id: number; name: string; color: string; weak_topics?: string[] }

type CustomEvent = {
  id: string
  type: EventType
  title: string
  subjectName?: string
  date: string
  time?: string
  minutes?: number
}

type CalEvent = {
  id: string
  kind: 'task' | 'exam' | 'custom'
  type: EventType
  title: string
  subtitle: string
  date: string
  time?: string
  minutes?: number
  completed?: boolean
  important?: boolean
  examDaysLeft?: number
  examPrepPct?: number
  subjectId?: number | null
  refId: number | string
}

type FreeSlot = { date: string; time: string }

/* ── Constants & helpers ───────────────────────────────────── */

const HOUR_START = 7
const HOUR_END = 23
const HOUR_PX = 56
const SNAP = 15
const GRID_MINUTES_START = HOUR_START * 60
const GRID_MINUTES_END = HOUR_END * 60

const EVENT_COLORS: Record<EventType, { accent: string }> = {
  study: { accent: '#76BDA5' },
  task: { accent: '#82BDD0' },
  exam: { accent: '#E08B8B' },
  assignment: { accent: '#E3B341' },
  reminder: { accent: '#A78BFA' },
  personal: { accent: '#94A3B8' },
}

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const WEEKDAY_UPPER = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DURATIONS = ['25', '30', '45', '50', '60', '90']

const CUSTOM_KEY = 'flox.calendar.custom'

function pad2(n: number) { return n < 10 ? '0' + n : '' + n }
function dateKey(y: number, m: number, d: number) { return `${y}-${pad2(m + 1)}-${pad2(d)}` }
function keyOf(dt: Date) { return dateKey(dt.getFullYear(), dt.getMonth(), dt.getDate()) }
function todayKey() { return keyOf(new Date()) }
function parseKey(dk: string) { return new Date(dk + 'T00:00:00') }

function addDays(date: Date, n: number) {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  d.setHours(0, 0, 0, 0)
  return d
}

function fmtTime12(hhmm: string) {
  const [hStr, mStr] = hhmm.split(':')
  const h = Number(hStr)
  const ap = h >= 12 ? 'PM' : 'AM'
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h
  return `${h12}:${mStr ?? '00'} ${ap}`
}

function hourLabel(h: number) {
  const ap = h >= 12 ? 'PM' : 'AM'
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h
  return `${h12} ${ap}`
}

function toMinutes(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + (m || 0)
}

function fromMinutes(mins: number) {
  return `${pad2(Math.floor(mins / 60) % 24)}:${pad2(mins % 60)}`
}

function endTime(time: string, minutes: number) {
  return fromMinutes(toMinutes(time) + minutes)
}

function nowMinutes() {
  const d = new Date()
  return d.getHours() * 60 + d.getMinutes()
}

function snapMin(mins: number) {
  return Math.max(GRID_MINUTES_START, Math.min(GRID_MINUTES_END - SNAP, Math.round(mins / SNAP) * SNAP))
}

function formatMinutes(m: number) {
  const h = Math.floor(m / 60)
  const min = m % 60
  return h ? `${h}h ${min}m` : `${min}m`
}

function friendlyDate(dk: string) {
  const d = parseKey(dk)
  const tk = todayKey()
  if (dk === tk) return 'Today'
  if (dk === keyOf(addDays(new Date(), 1))) return 'Tomorrow'
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

function loadCustom(): CustomEvent[] {
  try {
    const raw = localStorage.getItem(CUSTOM_KEY)
    return raw ? (JSON.parse(raw) as CustomEvent[]) : []
  } catch {
    return []
  }
}

function saveCustom(events: CustomEvent[]) {
  localStorage.setItem(CUSTOM_KEY, JSON.stringify(events))
}

function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 900px)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 900px)')
    const fn = () => setMobile(mq.matches)
    mq.addEventListener('change', fn)
    return () => mq.removeEventListener('change', fn)
  }, [])
  return mobile
}

/* Form state shared by create/edit modal */

type FormState = {
  open: boolean
  mode: 'create' | 'edit'
  eventId: string | null
  kind: 'task' | 'exam' | 'custom'
  type: EventType
  title: string
  subject: string
  date: string
  time: string
  duration: string
}

const emptyForm = (): FormState => ({
  open: false,
  mode: 'create',
  eventId: null,
  kind: 'task',
  type: 'study',
  title: '',
  subject: '',
  date: todayKey(),
  time: '18:00',
  duration: '50',
})

/* ── Page ──────────────────────────────────────────────────── */

export default function CalendarPage() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()

  const [view, setView] = useState<ViewMode>('week')
  const [anchor, setAnchor] = useState<Date>(() => new Date())
  const [selectedDate, setSelectedDate] = useState<string>(() => todayKey())
  const [ddOpen, setDdOpen] = useState(false)

  const [exams, setExams] = useState<Exam[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [customs, setCustoms] = useState<CustomEvent[]>(() => loadCustom())
  const [loading, setLoading] = useState(true)

  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [aiBusy, setAiBusy] = useState(false)
  const [nowMin, setNowMin] = useState(() => nowMinutes())
  const [detail, setDetail] = useState<CalEvent | null>(null)

  const scrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const [examRes, taskRes, subjectRes] = await Promise.all([
          api.get<Exam[]>('/study/exams/'),
          api.get<Task[]>('/study/tasks/'),
          api.get<Subject[]>('/study/subjects/'),
        ])
        if (!active) return
        setExams(examRes.data)
        setTasks(taskRes.data)
        setSubjects(subjectRes.data)
      } catch (err) {
        if (active) toast.error(getErrorMessage(err))
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [])

  useEffect(() => {
    const id = window.setInterval(() => setNowMin(nowMinutes()), 60_000)
    return () => window.clearInterval(id)
  }, [])

  /* ── Events assembly ── */

  const allEvents = useMemo<CalEvent[]>(() => {
    const evts: CalEvent[] = []
    for (const e of exams) {
      if (!e.date) continue
      evts.push({
        id: `exam-${e.id}`,
        kind: 'exam',
        type: 'exam',
        title: e.subject_name ? `${e.subject_name} Exam` : e.title,
        subtitle: e.subject_name ? e.title : 'Exam',
        date: e.date.slice(0, 10),
        examDaysLeft: e.days_left,
        examPrepPct: e.preparation_pct,
        subjectId: e.subject,
        refId: e.id,
      })
    }
    for (const t of tasks) {
      if (t.scheduled_for) {
        evts.push({
          id: `task-${t.id}`,
          kind: 'task',
          type: 'study',
          title: t.subject_name ?? t.title,
          subtitle: t.subject_name ? t.title : 'Focus session',
          date: t.scheduled_for.slice(0, 10),
          time: t.scheduled_for.slice(11, 16),
          minutes: t.duration_minutes || 50,
          completed: t.status === 'done',
          important: t.priority === 'high',
          subjectId: t.subject,
          refId: t.id,
        })
      } else if (t.due_date) {
        evts.push({
          id: `task-${t.id}`,
          kind: 'task',
          type: 'task',
          title: t.subject_name ?? t.title,
          subtitle: t.subject_name ? t.title : 'To-do',
          date: t.due_date.slice(0, 10),
          minutes: t.duration_minutes,
          completed: t.status === 'done',
          important: t.priority === 'high',
          subjectId: t.subject,
          refId: t.id,
        })
      }
    }
    for (const c of customs) {
      evts.push({
        id: `custom-${c.id}`,
        kind: 'custom',
        type: c.type,
        title: c.subjectName ?? c.title,
        subtitle: c.subjectName ? c.title : 'Personal event',
        date: c.date,
        time: c.time,
        minutes: c.minutes,
        refId: c.id,
      })
    }
    return evts
  }, [exams, tasks, customs])

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalEvent[]>()
    for (const e of allEvents) {
      const arr = map.get(e.date)
      if (arr) arr.push(e)
      else map.set(e.date, [e])
    }
    for (const arr of map.values()) {
      arr.sort((x, y) => (x.time ?? '99:99').localeCompare(y.time ?? '99:99'))
    }
    return map
  }, [allEvents])

  /* ── Navigation ranges ── */

  const weekDates = useMemo(() => {
    const start = addDays(anchor, -anchor.getDay())
    return Array.from({ length: 7 }, (_, i) => addDays(start, i))
  }, [anchor])

  const monthCells = useMemo(() => {
    const y = anchor.getFullYear()
    const m = anchor.getMonth()
    const first = new Date(y, m, 1)
    const blanks = first.getDay()
    const total = new Date(y, m + 1, 0).getDate()
    const cells: Array<string | null> = []
    for (let i = 0; i < blanks; i++) cells.push(null)
    for (let i = 1; i <= total; i++) cells.push(dateKey(y, m, i))
    while (cells.length % 7 !== 0) cells.push(null)
    return cells
  }, [anchor])

  const navLabel = useMemo(() => {
    if (view === 'month') return `${MONTH_NAMES[anchor.getMonth()]} ${anchor.getFullYear()}`
    if (view === 'week') {
      const a = weekDates[0]
      const b = weekDates[6]
      if (a.getMonth() === b.getMonth()) return `${MONTH_NAMES[a.getMonth()].slice(0, 3)} ${a.getDate()} \u2013 ${b.getDate()}, ${b.getFullYear()}`
      return `${MONTH_NAMES[a.getMonth()].slice(0, 3)} ${a.getDate()} \u2013 ${MONTH_NAMES[b.getMonth()].slice(0, 3)} ${b.getDate()}, ${b.getFullYear()}`
    }
    if (view === 'schedule') return 'Upcoming'
    const d = parseKey(selectedDate)
    return `${d.toLocaleDateString(undefined, { weekday: 'long' })}, ${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getDate()}`
  }, [view, anchor, weekDates, selectedDate])

  function nav(dir: number) {
    if (view === 'week') setAnchor((p) => addDays(p, dir * 7))
    else if (view === 'day') {
      const nd = addDays(parseKey(selectedDate), dir)
      setSelectedDate(keyOf(nd))
      setAnchor(nd)
    } else if (view === 'month') setAnchor((p) => new Date(p.getFullYear(), p.getMonth() + dir, 1))
    else setAnchor((p) => addDays(p, dir * 7))
  }

  function goToday() {
    const t = new Date()
    setAnchor(new Date(t))
    setSelectedDate(todayKey())
  }

  function switchView(v: ViewMode) {
    setView(v)
    setDdOpen(false)
  }

  function openDay(dk: string) {
    setSelectedDate(dk)
    const d = parseKey(dk)
    setAnchor(new Date(d))
    if (isMobile || view === 'month') setView('day')
  }

  /* ── Grid interactions (click / drag to create) ── */

  const dragRef = useRef<{ colIdx: number; startMin: number; endMin: number; moved: boolean } | null>(null)
  const [ghost, setGhost] = useState<{ colIdx: number; startMin: number; endMin: number } | null>(null)

  function gridPointerDown(e: RPointerEvent<HTMLDivElement>, colIdx: number) {
    if (e.button !== 0) return
    if ((e.target as HTMLElement).closest('.cal-evblock, .cal-nowline')) return
    const rect = e.currentTarget.getBoundingClientRect()
    const min = snapMin(GRID_MINUTES_START + ((e.clientY - rect.top) / HOUR_PX) * 60)
    dragRef.current = { colIdx, startMin: min, endMin: min, moved: false }
    setGhost({ colIdx, startMin: min, endMin: min + SNAP })

    function onMove(ev: PointerEvent) {
      const drag = dragRef.current
      if (!drag) return
      const target = document.querySelector<HTMLElement>(`[data-col="${drag.colIdx}"]`)
      if (!target) return
      const r = target.getBoundingClientRect()
      const end = snapMin(GRID_MINUTES_START + ((ev.clientY - r.top) / HOUR_PX) * 60)
      drag.endMin = Math.max(drag.startMin + SNAP, end)
      drag.moved = Math.abs(end - drag.startMin) >= SNAP
      setGhost({ colIdx: drag.colIdx, startMin: Math.min(drag.startMin, end), endMin: Math.max(drag.startMin + SNAP, end) })
    }
    function onUp() {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      const drag = dragRef.current
      dragRef.current = null
      setGhost(null)
      if (!drag) return
      if (drag.moved) {
        openCreate(colDateKey(drag.colIdx), fromMinutes(drag.startMin), drag.endMin - drag.startMin)
      } else {
        openCreate(colDateKey(drag.colIdx), fromMinutes(drag.startMin), 50)
      }
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  function colDateKey(idx: number) {
    if (view === 'day') return selectedDate
    return keyOf(weekDates[idx])
  }

  const colCount = view === 'day' ? 1 : 7

  function openCreate(dk: string, time: string, minutes: number) {
    setForm({
      ...emptyForm(),
      open: true,
      mode: 'create',
      date: dk,
      time,
      duration: String(minutes >= 25 ? minutes : 50),
    })
    setSelectedDate(dk)
  }

  function openEdit(ev: CalEvent) {
    setDetail(null)
    const generic = ev.subtitle === 'Focus session' || ev.subtitle === 'To-do' || ev.subtitle === 'Exam' || ev.subtitle === 'Personal event'
    setForm({
      open: true,
      mode: 'edit',
      eventId: ev.id,
      kind: ev.kind,
      type: ev.type,
      title: generic ? ev.title : ev.subtitle,
      subject: ev.subjectId != null ? String(ev.subjectId) : '',
      date: ev.date,
      time: ev.time ?? '18:00',
      duration: String(ev.minutes ?? 50),
    })
  }

  async function deleteEvent(ev: CalEvent) {
    try {
      if (ev.kind === 'task') await api.delete(`/study/tasks/${ev.refId}/`)
      else if (ev.kind === 'exam') await api.delete(`/study/exams/${ev.refId}/`)
      else {
        const next = loadCustom().filter((c) => String(c.id) !== String(ev.refId))
        saveCustom(next)
        setCustoms(next)
      }
      toast.success('Event deleted')
      setDetail(null)
      if (ev.kind !== 'custom') {
        const [examRes, taskRes] = await Promise.all([api.get<Exam[]>('/study/exams/'), api.get<Task[]>('/study/tasks/')])
        setExams(examRes.data)
        setTasks(taskRes.data)
      }
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  async function submitForm() {
    const title = form.title.trim()
    if (!title) { toast.error('Title is required'); return }
    if (!form.date) { toast.error('Please pick a date'); return }
    setSaving(true)
    try {
      if (form.mode === 'create') {
        if (form.type === 'study') {
          await api.post('/study/tasks/', {
            title,
            subject: form.subject ? Number(form.subject) : null,
            scheduled_for: `${form.date}T${form.time}:00`,
            duration_minutes: Number(form.duration) || 50,
            priority: 'medium',
            status: 'todo',
          })
          notifyStudyActivity()
        } else if (form.type === 'exam') {
          await api.post('/study/exams/', { title, subject: form.subject ? Number(form.subject) : null, date: form.date, priority: 'medium' })
          notifyStudyActivity()
        } else {
          const subj = subjects.find((s) => String(s.id) === form.subject)
          const entry: CustomEvent = { id: `c${Date.now()}`, type: form.type, title, subjectName: subj?.name, date: form.date, time: form.time, minutes: Number(form.duration) || 30 }
          const next = [...loadCustom(), entry]
          saveCustom(next)
          setCustoms(next)
        }
        toast.success('Session created')
      } else if (form.eventId?.startsWith('task-')) {
        const id = form.eventId.replace('task-', '')
        await api.patch(`/study/tasks/${id}/`, {
          title,
          subject: form.subject ? Number(form.subject) : null,
          scheduled_for: `${form.date}T${form.time}:00`,
          duration_minutes: Number(form.duration) || 50,
        })
        toast.success('Session updated')
      } else if (form.eventId?.startsWith('exam-')) {
        const id = form.eventId.replace('exam-', '')
        await api.patch(`/study/exams/${id}/`, { title, subject: form.subject ? Number(form.subject) : null, date: form.date })
        toast.success('Exam updated')
      } else if (form.eventId?.startsWith('custom-')) {
        const cid = form.eventId.replace('custom-', '')
        const subj = subjects.find((s) => String(s.id) === form.subject)
        const next = loadCustom().map((c) => (String(c.id) === cid ? { ...c, title, time: form.time, minutes: Number(form.duration) || 30, subjectName: subj?.name ?? c.subjectName } : c))
        saveCustom(next)
        setCustoms(next)
        toast.success('Event updated')
      }
      setForm(emptyForm())
      if (form.mode === 'create' || form.eventId?.startsWith('task-') || form.eventId?.startsWith('exam-')) {
        const [examRes, taskRes] = await Promise.all([api.get<Exam[]>('/study/exams/'), api.get<Task[]>('/study/tasks/')])
        setExams(examRes.data)
        setTasks(taskRes.data)
      }
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  /* ── AI free-slot finder ── */

  const aiSlots = useMemo(() => {
    const slots: FreeSlot[] = []
    const today = new Date()
    for (let i = 0; i < 7; i++) {
      const d = addDays(today, i)
      const dk = keyOf(d)
      const busy = (eventsByDate.get(dk) ?? [])
        .filter((e) => e.time && e.minutes && !e.completed)
        .map((e) => ({ s: toMinutes(e.time!), en: toMinutes(e.time!) + (e.minutes ?? 50) }))
        .sort((x, y) => x.s - y.s)
      let cursor = Math.max(8 * 60, i === 0 ? Math.ceil(nowMin / 30) * 30 : 8 * 60)
      const limit = 21 * 60
      for (const b of busy) {
        if (b.s - cursor >= 50) slots.push({ date: dk, time: fromMinutes(cursor) })
        cursor = Math.max(cursor, b.en)
      }
      if (limit - cursor >= 50) slots.push({ date: dk, time: fromMinutes(cursor) })
      if (slots.length >= 3) break
    }
    return slots.slice(0, 3)
  }, [eventsByDate, nowMin])

  const aiSubject = useMemo(
    () => subjects.find((s) => s.weak_topics)?.name ?? subjects[0]?.name ?? null,
    [subjects],
  )

  async function addAiSlots() {
    if (!aiSlots.length) return
    setAiBusy(true)
    try {
      const name = aiSubject ?? 'Focus'
      for (const slot of aiSlots) {
        await api.post('/study/tasks/', {
          title: `${name} Focus Session`,
          subject: subjects.find((s) => s.name === aiSubject)?.id ?? null,
          scheduled_for: `${slot.date}T${slot.time}:00`,
          duration_minutes: 50,
          priority: 'medium',
          status: 'todo',
        })
      }
      notifyStudyActivity()
      const { data } = await api.get<Task[]>('/study/tasks/')
      setTasks(data)
      toast.success(`Added ${aiSlots.length} study sessions.`)
      setAiOpen(false)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setAiBusy(false)
    }
  }

  /* Auto-scroll the grid near current time */
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const target = ((Math.max(nowMin - 60, GRID_MINUTES_START) - GRID_MINUTES_START) / 60) * HOUR_PX
    el.scrollTop = Math.max(0, target)
  }, [view, isMobile, nowMin])

  /* ── Shared fragments ── */

  const tk = todayKey()
  const cols: Array<{ key: string; date: Date }> =
    view === 'day'
      ? [{ key: selectedDate, date: parseKey(selectedDate) }]
      : weekDates.map((d) => ({ key: keyOf(d), date: d }))

  function accentOf(t: EventType) { return EVENT_COLORS[t].accent }

  const scheduleList = (() => {
    const groups: ReturnType<typeof keyOf>[] = []
    for (let i = 0; i < 30; i++) groups.push(keyOf(addDays(new Date(), i)))
    let any = false
    const out = groups.map((dk) => {
      const evs = eventsByDate.get(dk) ?? []
      if (!evs.length) return null
      any = true
      return (
        <div key={dk} className="cal-sc-group">
          <h4 className={dk === tk ? 'is-today' : undefined}>{friendlyDate(dk)}</h4>
          {evs.map((e) => (
            <button key={e.id} className="cal-sc-row" onClick={() => setDetail(e)}>
              <span className="sc-time">{e.time ? `${fmtTime12(e.time)}${e.minutes ? ` \u2013 ${fmtTime12(endTime(e.time, e.minutes))}` : ''}` : 'All day'}</span>
              <span className="sc-dot" style={{ background: accentOf(e.type) }} />
              <span className="sc-body"><b>{e.title}</b><em>{e.subtitle}</em></span>
              {e.minutes ? <span className="sc-len">{formatMinutes(e.minutes)}</span> : null}
            </button>
          ))}
        </div>
      )
    })
    return any ? out : <div className="cal-empty">{'\u2726'} Nothing scheduled ahead. Tap + to plan something.</div>
  })()

  const monthView = (
    <div className="cal-month">
      <div className="cal-mo-headrow">
        {WEEKDAY_UPPER.map((w) => <span key={w}>{w}</span>)}
      </div>
      <div className="cal-mo-grid">
        {monthCells.map((dk, i) => {
          if (!dk) return <div key={`b${i}`} className="cal-mo-cell blank" />
          const d = parseKey(dk)
          const evs = eventsByDate.get(dk) ?? []
          const shown = evs.slice(0, 3)
          const extra = evs.length - shown.length
          return (
            <button
              key={dk}
              className={'cal-mo-cell' + (dk === tk ? ' is-today' : '') + (dk === selectedDate ? ' sel' : '')}
              onClick={() => openDay(dk)}
            >
              <span className="mo-num">{d.getDate()}</span>
              <span className="mo-events">
                {shown.map((e) => (
                  <span
                    key={e.id}
                    className="mo-chip"
                    role="button"
                    tabIndex={0}
                    onClick={(ev) => { ev.stopPropagation(); setDetail(e) }}
                    onKeyDown={(ev) => { if (ev.key === 'Enter') { ev.stopPropagation(); setDetail(e) } }}
                    style={{ ['--ev-accent' as string]: accentOf(e.type) }}
                  >
                    {e.title}
                  </span>
                ))}
                {extra > 0 && <span className="mo-more">+{extra} more</span>}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )

  const dayHeaderRow = (
    <div className="cal-headrow">
      <div className="cal-gutter-spacer" />
      <div className={'cal-headcells' + (colCount === 1 ? ' single' : '')}>
        {cols.map((c) => (
          <button
            key={c.key}
            className={'cal-headcell' + (c.key === tk ? ' is-today' : '')}
            onClick={() => setSelectedDate(c.key)}
          >
            <span className="hc-dow">{WEEKDAY_UPPER[c.date.getDay()]}</span>
            <span className="hc-num">{c.date.getDate()}</span>
          </button>
        ))}
      </div>
    </div>
  )

  const timeGridView = (
    <>
      <div className="cal-allday-row">
        <div className="cal-ad-gutter">{colCount > 1 ? 'All day' : ''}</div>
        <div className={'cal-ad-cells' + (colCount === 1 ? ' single' : '')}>
          {cols.map((c) => {
            const allDay = (eventsByDate.get(c.key) ?? []).filter((e) => !e.time)
            return (
              <div key={c.key} className="cal-ad-cell">
                {allDay.map((e) => (
                  <button
                    key={e.id}
                    className={'cal-chip' + (e.type === 'exam' ? ' chip-exam' : e.type === 'task' ? ' chip-task' : ' chip-other') + (e.completed ? ' done' : '')}
                    style={{ ['--ev-accent' as string]: accentOf(e.type) }}
                    onClick={() => setDetail(e)}
                  >
                    {e.type === 'exam' ? '\uD83C\uDF93 ' : e.type === 'task' ? '\u2610 ' : ''}
                    {e.title}
                  </button>
                ))}
              </div>
            )
          })}
        </div>
      </div>
      <div className="cal-gridbody" ref={scrollRef}>
        <div className="cal-gridinner">
          <div className="cal-gutter">
            {Array.from({ length: HOUR_END - HOUR_START }, (_, i) => (
              <span key={i} className="cal-hourlabel" style={{ top: i * HOUR_PX - 8 }}>{hourLabel(HOUR_START + i)}</span>
            ))}
          </div>
          <div className={'cal-daycols' + (colCount === 1 ? ' single' : '')}>
            {cols.map((c, idx) => {
              const timed = (eventsByDate.get(c.key) ?? []).filter((e) => e.time)
              const isToday = c.key === tk
              return (
                <div
                  key={c.key}
                  data-col={idx}
                  className={'cal-daycol' + (isToday ? ' is-today' : '')}
                  onPointerDown={(e) => gridPointerDown(e, idx)}
                >
                  {timed.map((e) => {
                    const start = toMinutes(e.time!)
                    const top = ((start - GRID_MINUTES_START) / 60) * HOUR_PX
                    const h = Math.max(22, ((e.minutes ?? 50) / 60) * HOUR_PX - 3)
                    return (
                      <button
                        key={e.id}
                        className={'cal-evblock' + (e.completed ? ' done' : '') + (e.important ? ' imp' : '')}
                        style={{ top, height: h, ['--ev-accent' as string]: accentOf(e.type) }}
                        onClick={(ev) => { ev.stopPropagation(); setDetail(e) }}
                      >
                        <span className="ev-title">{e.completed ? '\u2713 ' : ''}{e.title}</span>
                        {h >= 46 && <span className="ev-sub">{e.subtitle}</span>}
                        {h >= 66 && <span className="ev-time">{fmtTime12(e.time!)}{e.minutes ? ` \u2013 ${fmtTime12(endTime(e.time!, e.minutes))}` : ''}</span>}
                      </button>
                    )
                  })}
                  {isToday && nowMin >= GRID_MINUTES_START && nowMin <= GRID_MINUTES_END && (
                    <div className="cal-nowline" style={{ top: ((nowMin - GRID_MINUTES_START) / 60) * HOUR_PX }}>
                      <span className="now-dot" />
                      <span className="now-time">{fmtTime12(fromMinutes(nowMin))}</span>
                    </div>
                  )}
                  {ghost?.colIdx === idx && (
                    <div
                      className="cal-ghost"
                      style={{
                        top: ((ghost.startMin - GRID_MINUTES_START) / 60) * HOUR_PX,
                        height: Math.max((SNAP / 60) * HOUR_PX, ((ghost.endMin - ghost.startMin) / 60) * HOUR_PX),
                      }}
                    >
                      {fmtTime12(fromMinutes(ghost.startMin))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </>
  )

  const mobileStrip = (
    <>
      <div className="cal-stripnav">
        <button className="sn-arrow" onClick={() => nav(-1)} aria-label="Previous week">&#8249;</button>
        <span className="sn-label">{MONTH_NAMES[anchor.getMonth()]} {anchor.getFullYear()}</span>
        <button className="sn-arrow" onClick={() => nav(1)} aria-label="Next week">&#8250;</button>
        <button className="sn-today" onClick={goToday}>Today</button>
      </div>
      <div className="cal-strip">
        {weekDates.map((d) => {
          const k = keyOf(d)
          return (
            <button key={k} className={'strip-day' + (k === tk ? ' is-today' : '') + (k === selectedDate ? ' sel' : '')} onClick={() => setSelectedDate(k)}>
              <span>{WEEKDAY_SHORT[d.getDay()].charAt(0)}</span>
              <b>{d.getDate()}</b>
              {(eventsByDate.get(k)?.length ?? 0) > 0 && <i />}
            </button>
          )
        })}
      </div>
    </>
  )

  const mobileAgenda = (() => {
    const evs = eventsByDate.get(selectedDate) ?? []
    const allDay = evs.filter((e) => !e.time)
    const timed = evs.filter((e) => e.time)
    return (
      <div className="cal-agenda">
        <h4 className="ag-datehead">
          {parseKey(selectedDate).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase()}
        </h4>
        {allDay.map((e) => (
          <button key={e.id} className="ag-card allday" style={{ ['--ev-accent' as string]: accentOf(e.type) }} onClick={() => setDetail(e)}>
            <span className="ag-dot" />
            <span className="ag-info"><b>{e.type === 'exam' ? '\uD83C\uDF93 ' : ''}{e.title}</b><em>{e.subtitle}</em><small>All day</small></span>
          </button>
        ))}
        {Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i).map((h) => {
          const bucket = timed.filter((e) => Math.floor(toMinutes(e.time!) / 60) === h)
          return (
            <div className="ag-hour" key={h}>
              <span className="ag-hl">{hourLabel(h)}</span>
              <div className="ag-slot">
                {bucket.map((e) => (
                  <button key={e.id} className={'ag-card' + (e.completed ? ' done' : '')} style={{ ['--ev-accent' as string]: accentOf(e.type) }} onClick={() => setDetail(e)}>
                    <span className="ag-dot" />
                    <span className="ag-info">
                      <b>{e.important ? '\uD83D\uDFE0 ' : e.completed ? '\u2705 ' : ''}{e.title}</b>
                      <em>{e.subtitle}</em>
                      <small>{fmtTime12(e.time!)} \u2013 {fmtTime12(endTime(e.time!, e.minutes ?? 50))}</small>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )
        })}
        {evs.length === 0 && <div className="cal-empty">{'\u2726'} Free day. Tap + to add a session.</div>}
      </div>
    )
  })()

  const editingEvent = useMemo(() => allEvents.find((e) => e.id === form.eventId) ?? null, [allEvents, form.eventId])

  /* ── Render ── */

  return (
    <PageShell
      className="cal-page"
      title="Calendar"
      subtitle="Your week at a glance."
    >
      <div className="cal-topbar">
        <div className="cal-tb-left">
          <button className="cal-btn" onClick={goToday}>Today</button>
          <div className="cal-navgroup">
            <button className="cal-navarrow" onClick={() => nav(-1)} aria-label="Previous">&#8249;</button>
            <span className="cal-navlabel">{navLabel}</span>
            <button className="cal-navarrow" onClick={() => nav(1)} aria-label="Next">&#8250;</button>
          </div>
        </div>
        <div className="cal-tb-right">
          <div className="cal-dd">
            <button className="cal-btn dd-toggle" onClick={() => setDdOpen((o) => !o)}>
              {view.charAt(0).toUpperCase() + view.slice(1)} <span className="chev">&#9662;</span>
            </button>
            {ddOpen && (
              <div className="cal-dd-menu">
                {(['day', 'week', 'month', 'schedule'] as ViewMode[]).map((v) => (
                  <button key={v} className={'cal-dd-item' + (view === v ? ' active' : '')} onClick={() => switchView(v)}>
                    {v.charAt(0).toUpperCase() + v.slice(1)}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button className="cal-ai-btn" onClick={() => setAiOpen(true)}>&#10022; AI Schedule</button>
          <button className="cal-addfab" onClick={() => openCreate(isMobile ? selectedDate : tk, '18:00', 50)} aria-label="Create event">&#65291;</button>
        </div>
      </div>

      {loading ? (
        <div className="cal-empty big">{'Loading your calendar\u2026'}</div>
      ) : isMobile ? (
        <div className="cal-mobile">
          {mobileStrip}
          <div className="cal-mobile-scroll">
            {view === 'month' ? monthView : view === 'schedule' ? scheduleList : mobileAgenda}
          </div>
        </div>
      ) : view === 'week' || view === 'day' ? (
        <div className="cal-desktopgrid">
          {dayHeaderRow}
          {timeGridView}
        </div>
      ) : view === 'month' ? (
        monthView
      ) : (
        <div className="cal-schedule">{scheduleList}</div>
      )}

      {/* Create / edit modal */}
      {form.open && (
        <div className="cal-modal-overlay" onClick={() => setForm(emptyForm())}>
          <div className="cal-modal cal-formmodal" onClick={(e) => e.stopPropagation()}>
            <div className="cal-modal-head">
              <h3>{form.mode === 'create' ? 'Create Study Session' : 'Edit Event'}</h3>
              <button className="cal-modal-close" onClick={() => setForm(emptyForm())} aria-label="Close">&#215;</button>
            </div>
            <label className="cal-field">
              <span>Title</span>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Integration practice"
                autoFocus
              />
            </label>
            <label className="cal-field">
              <span>Subject</span>
              <select value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}>
                <option value="">No subject</option>
                {subjects.map((s) => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
              </select>
            </label>
            {form.mode === 'create' && (
              <div className="cal-field-row type-row">
                {(['study', 'exam', 'task', 'personal'] as EventType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={'cal-typebtn' + (form.type === t ? ' on' : '')}
                    style={{ ['--ev-accent' as string]: accentOf(t) }}
                    onClick={() => setForm({ ...form, type: t })}
                  >
                    {t === 'study' ? 'Study' : t === 'exam' ? 'Exam' : t === 'task' ? 'Task' : 'Personal'}
                  </button>
                ))}
              </div>
            )}
            <div className="cal-field-row">
              <label className="cal-field">
                <span>Date</span>
                <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </label>
              <label className="cal-field">
                <span>Start</span>
                <input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
              </label>
            </div>
            {form.type !== 'exam' && (
              <label className="cal-field">
                <span>Duration</span>
                <select value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })}>
                  {DURATIONS.map((d) => <option key={d} value={d}>{d} minutes</option>)}
                </select>
              </label>
            )}
            <div className="cal-modal-actions">
              {form.mode === 'edit' && editingEvent && (
                <button className="cal-danger" disabled={saving} onClick={() => void deleteEvent(editingEvent)}>Delete</button>
              )}
              <button className="cal-cancel" onClick={() => setForm(emptyForm())}>Cancel</button>
              <button className="cal-save" disabled={saving} onClick={() => void submitForm()}>
                {saving ? 'Saving\u2026' : form.mode === 'create' ? 'Create' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Event detail modal */}
      {detail && (
        <div className="cal-modal-overlay" onClick={() => setDetail(null)}>
          <div className="cal-modal cal-detailmodal" onClick={(e) => e.stopPropagation()}>
            <div className="cal-modal-head">
              <h3><span className="dt-dot" style={{ background: accentOf(detail.type) }} />{detail.title}</h3>
              <button className="cal-modal-close" onClick={() => setDetail(null)} aria-label="Close">&#215;</button>
            </div>
            <div className="dt-body">
              <p className="dt-sub">{detail.subtitle}</p>
              <p className="dt-line">
                {friendlyDate(detail.date)}
                {detail.time
                  ? ` \u00B7 ${fmtTime12(detail.time)}${detail.minutes ? ` \u2013 ${fmtTime12(endTime(detail.time, detail.minutes))}` : ''}`
                  : ' \u00B7 All day'}
              </p>
              {detail.type === 'exam' && detail.examDaysLeft != null && detail.examDaysLeft >= 0 && (
                <p className="dt-examline">
                  {detail.examDaysLeft === 0 ? 'Exam is today' : `${detail.examDaysLeft} day${detail.examDaysLeft === 1 ? '' : 's'} away`}
                  {' \u00B7 '}{detail.examPrepPct ?? 0}% prepared
                </p>
              )}
            </div>
            <div className="cal-modal-actions wrap">
              {detail.kind === 'task' && !detail.completed && (
                <button className="cal-startfocus" onClick={() => navigate('/focus')}>Start Focus</button>
              )}
              {detail.type === 'exam' && <Link className="cal-cancel" to="/exams">View Exams</Link>}
              <button className="cal-cancel" onClick={() => openEdit(detail)}>Edit</button>
              <button className="cal-danger" onClick={() => void deleteEvent(detail)}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* AI free-slot modal */}
      {aiOpen && (
        <div className="cal-modal-overlay" onClick={() => setAiOpen(false)}>
          <div className="cal-modal cal-aimodal" onClick={(e) => e.stopPropagation()}>
            <div className="cal-modal-head">
              <h3><span className="ai-star">&#10022;</span> AI Schedule</h3>
              <button className="cal-modal-close" onClick={() => setAiOpen(false)} aria-label="Close">&#215;</button>
            </div>
            {aiSlots.length === 0 ? (
              <p className="ai-lead">{'Your week looks packed \u2014 no free 50-minute periods found.'}</p>
            ) : (
              <>
                <p className="ai-lead">I found {aiSlots.length} free study period{aiSlots.length === 1 ? '' : 's'} this week:</p>
                <ul className="ai-slots">
                  {aiSlots.map((s, i) => (
                    <li key={`${s.date}-${s.time}`}>
                      <span className="ai-n">{i + 1}</span>
                      <b>{friendlyDate(s.date)}</b>
                      <span className="ai-t">{fmtTime12(s.time)} {'\u00B7'} 50 min</span>
                    </li>
                  ))}
                </ul>
                {aiSubject && <p className="ai-rec">Recommended for <b>{aiSubject}</b></p>}
              </>
            )}
            <div className="cal-modal-actions">
              <button className="cal-cancel" onClick={() => setAiOpen(false)}>Close</button>
              {aiSlots.length > 0 && (
                <button className="cal-save" disabled={aiBusy} onClick={() => void addAiSlots()}>
                  {aiBusy ? 'Adding\u2026' : 'Add All'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </PageShell>
  )
}
