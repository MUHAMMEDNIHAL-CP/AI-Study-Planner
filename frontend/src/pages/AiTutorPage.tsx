import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent, KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import PageShell from '../components/PageShell'
import { IconAnalytics, IconBot } from '../components/icons'
import { api, getErrorMessage } from '../lib/api'
import { useUserProfile, firstName } from '../hooks/useUserProfile'
import { notifyStudyActivity } from '../lib/studyActivity'

/* ── Types ─────────────────────────────────────────────────── */

type DashboardData = {
  current_streak: number
  longest_streak: number
  today_minutes: number
  completion_rate: number
  open_tasks: number
  subjects_summary: Array<{ name: string; color: string; topics_completed: number; total_topics: number }>
  upcoming_exams: Array<{ id: number; title: string; date: string; subject_name?: string }>
  total_completed_tasks: number
  total_focus_sessions: number
}

type ExamLite = {
  id: number
  title: string
  date: string
  subject_name?: string
  days_left?: number
  preparation_pct?: number
}

type TaskLite = {
  id: number
  title: string
  subject_name?: string
  due_date?: string | null
  scheduled_for?: string | null
  duration_minutes: number
  status: string
  priority?: string
}

type NoteLite = { id: number; title: string; content: string }

type QuizHistoryItem = { id: number; topic: string; score: number | null; total_questions: number }

type AiHistoryItem = {
  id: number
  feature: string
  prompt: string
  response: Record<string, unknown>
  created_at: string
}

type Question = { id: number; question: string; options: string[]; answer_index: number; explanation: string }
type QuizShape = { id: number; topic: string; questions: Question[] }

type PlanRow = { time: string; subject: string; topic: string; minutes: number }

type ExamPlanData = {
  subject: string
  daysLeft: number
  prepPct: number
  strong: string[]
  weakish: string[]
  days: Array<{ day: number; focus: string }>
}

type MsgAction = {
  label: string
  kind: 'start-focus' | 'add-plan' | 'add-examplan' | 'open-quiz'
  route?: string
}

type ChatMessage = {
  id: string
  role: 'student' | 'coach'
  text: string
  mode?: QuickKey | 'chat'
  plan?: PlanRow[]
  examPlan?: ExamPlanData
  quizTopic?: string
  actions?: MsgAction[]
  chips?: string[]
}

type QuickKey = 'plan' | 'exam' | 'learn' | 'practice' | 'analyze' | 'revise'

type Conversation = {
  id: string
  title: string
  updated_at: string
  messages: ChatMessage[]
}

const CHATS_KEY = 'FLOX.ai.chats.v1'

/* ── Constants ─────────────────────────────────────────────── */

const QUICK_CARDS: Array<{ key: QuickKey; icon: string; label: string }> = [
  { key: 'plan', icon: '\uD83D\uDCC5', label: 'What should I study?' },
  { key: 'exam', icon: '\uD83C\uDF93', label: 'Prepare for exam' },
  { key: 'learn', icon: '\uD83E\uDDE0', label: 'Explain a topic' },
  { key: 'practice', icon: '\uD83D\uDCDD', label: 'Quiz me' },
]

const INPUT_CHIPS: Array<{ key: QuickKey; icon: string; label: string }> = [
  { key: 'plan', icon: '\uD83D\uDCC5', label: 'Plan' },
  { key: 'learn', icon: '\uD83E\uDDE0', label: 'Explain' },
  { key: 'practice', icon: '\uD83D\uDCDD', label: 'Quiz' },
  { key: 'exam', icon: '\uD83C\uDF93', label: 'Exam' },
]

const QUIZ_SOURCES: Array<{ key: 'subject' | 'weak' | 'notes' | 'topic'; label: string }> = [
  { key: 'subject', label: 'Current subject' },
  { key: 'weak', label: 'Weak topics' },
  { key: 'notes', label: 'Recent notes' },
  { key: 'topic', label: 'Choose a topic' },
]

/* ── Helpers ───────────────────────────────────────────────── */

function pad2(n: number) { return n < 10 ? '0' + n : '' + n }
function keyOf(d: Date) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) }
function todayKey() { return keyOf(new Date()) }

function daysUntil(date: string) {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return Math.max(0, Math.ceil((new Date(date + 'T00:00:00').getTime() - now.getTime()) / 86400000))
}

function fmtMinutes(m: number) {
  const h = Math.floor(m / 60)
  const min = m % 60
  return h ? h + 'h ' + min + 'm' : min + 'm'
}

function hourLabel(hhmm: string) {
  const [hStr, mStr] = hhmm.split(':')
  const h = Number(hStr)
  const ap = h >= 12 ? 'PM' : 'AM'
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h
  return h12 + ':' + mStr + ' ' + ap
}

function shiftDays(iso: string, n: number) {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return keyOf(d)
}

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7) }

function loadChats(): Conversation[] {
  try {
    const raw = localStorage.getItem(CHATS_KEY)
    return raw ? (JSON.parse(raw) as Conversation[]) : []
  } catch {
    return []
  }
}

function saveChats(chats: Conversation[]) {
  localStorage.setItem(CHATS_KEY, JSON.stringify(chats.slice(0, 40)))
}

function chatGroups(chats: Conversation[]): Array<{ label: string; items: Conversation[] }> {
  const tk = todayKey()
  const yk = shiftDays(tk, -1)
  const groups: Array<{ label: string; items: Conversation[] }> = []
  const buckets = new Map<string, Conversation[]>()
  for (const c of chats) {
    const dk = c.updated_at.slice(0, 10)
    if (!buckets.has(dk)) buckets.set(dk, [])
    buckets.get(dk)!.push(c)
  }
  const ordered = [...buckets.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  for (const [dk, items] of ordered) {
    let label: string
    if (dk === tk) label = 'TODAY'
    else if (dk === yk) label = 'YESTERDAY'
    else label = new Date(dk + 'T00:00:00').toLocaleDateString(undefined, { month: 'long', day: 'numeric' }).toUpperCase()
    groups.push({ label, items })
  }
  return groups
}

type SpeechRecLike = {
  lang: string
  interimResults: boolean
  continuous: boolean
  start: () => void
  stop: () => void
  onresult: ((e: { results: Array<Array<{ transcript: string }>> }) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
}

function htmlStrip(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim()
}


/* ── In-chat quiz runner ───────────────────────────────────── */

function QuizRunner({ quiz }: { quiz: QuizShape }) {
  const navigate = useNavigate()
  const [idx, setIdx] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const [score, setScore] = useState(0)
  const [done, setDone] = useState(false)

  const q = quiz.questions[idx]
  const total = quiz.questions.length

  function choose(i: number) {
    if (picked !== null) return
    setPicked(i)
    if (i === q.answer_index) setScore((s) => s + 1)
  }

  function next() {
    if (idx + 1 >= total) { setDone(true); return }
    setIdx(idx + 1)
    setPicked(null)
  }

  function restart() {
    setIdx(0)
    setPicked(null)
    setScore(0)
    setDone(false)
  }

  if (done) {
    const pct = Math.round((score / total) * 100)
    return (
      <div className="ac-quiz">
        <div className={'ac-quiz-verdict' + (pct >= 60 ? ' good' : '')}>
          {pct >= 60 ? '\u2713' : '\u2717'} Score: {score} / {total} ({pct}%)
        </div>
        <p className="ac-quiz-note">
          {pct >= 80
            ? 'Excellent! This topic is looking strong.'
            : pct >= 60
              ? 'Solid effort. A quick revision will lock it in.'
              : 'This topic needs another pass. I recommend a 50-minute session.'}
        </p>
        <div className="ac-msg-actions">
          <button onClick={restart}>Retake</button>
          <button className="primary" onClick={() => navigate('/quiz')}>Open Quiz Center</button>
        </div>
      </div>
    )
  }

  return (
    <div className="ac-quiz">
      <div className="ac-quiz-head">
        {'\uD83D\uDCDD'} QUIZ MODE{' '}
        <b>{quiz.topic}</b>
        <span>Question {idx + 1} / {total}</span>
      </div>
      <p className="ac-quiz-q">{q.question}</p>
      <div className="ac-quiz-options">
        {q.options.map((opt, i) => (
          <button
            key={i}
            className={
              'ac-quiz-opt' +
              (picked === null ? '' : i === q.answer_index ? ' correct' : picked === i ? ' wrong' : ' dim')
            }
            disabled={picked !== null}
            onClick={() => choose(i)}
          >
            <i>{'\u25CB'}</i> {opt}
          </button>
        ))}
      </div>
      {picked !== null && (
        <>
          <div className={'ac-quiz-feedback' + (picked === q.answer_index ? ' good' : ' bad')}>
            {picked === q.answer_index ? '\u2713 Correct!' : '\u2717 Not quite.'}
            {q.explanation ? ' ' + q.explanation : ''}
          </div>
          <div className="ac-msg-actions">
            <button className="primary" onClick={next}>
              {idx + 1 >= total ? 'See results' : 'Next Question \u2192'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}


/* ── Page ──────────────────────────────────────────────────── */

export default function AiTutorPage() {
  const profile = useUserProfile()
  const navigate = useNavigate()
  const userName = firstName(profile) || 'there'

  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [exams, setExams] = useState<ExamLite[]>([])
  const [tasks, setTasks] = useState<TaskLite[]>([])
  const [quizHist, setQuizHist] = useState<QuizHistoryItem[]>([])
  const [notes, setNotes] = useState<NoteLite[]>([])
  const [aiHistory, setAiHistory] = useState<AiHistoryItem[]>([])

  const [chats, setChats] = useState<Conversation[]>(() => loadChats())
  const [activeId, setActiveId] = useState<string | null>(null)

  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [topicMode, setTopicMode] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [ctxOpen, setCtxOpen] = useState(false)
  const [notePicker, setNotePicker] = useState(false)
  const [noteQuery, setNoteQuery] = useState('')
  const [attachments, setAttachments] = useState<Array<{ kind: 'note' | 'file'; label: string; content: string }>>([])
  const [listening, setListening] = useState(false)
  const [genBusy, setGenBusy] = useState(false)
  const [quizBank, setQuizBank] = useState<Record<string, QuizShape>>({})

  const fileRef = useRef<HTMLInputElement | null>(null)
  const recRef = useRef<SpeechRecLike | null>(null)
  const endRef = useRef<HTMLDivElement | null>(null)

  /* ── Data load ── */

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const [dashRes, examRes, taskRes, quizRes, noteRes, histRes] = await Promise.all([
          api.get<DashboardData>('/study/dashboard/').catch(() => ({ data: null as DashboardData | null })),
          api.get<ExamLite[]>('/study/exams/').catch(() => ({ data: [] as ExamLite[] })),
          api.get<TaskLite[]>('/study/tasks/').catch(() => ({ data: [] as TaskLite[] })),
          api.get<QuizHistoryItem[]>('/quiz/history/').catch(() => ({ data: [] as QuizHistoryItem[] })),
          api.get<NoteLite[]>('/notes/').catch(() => ({ data: [] as NoteLite[] })),
          api.get<AiHistoryItem[]>('/ai/history/').catch(() => ({ data: [] as AiHistoryItem[] })),
        ])
        if (!alive) return
        setDashboard(dashRes.data)
        setExams([...examRes.data].sort((a, b) => a.date.localeCompare(b.date)))
        setTasks(taskRes.data)
        setQuizHist(quizRes.data)
        setNotes(noteRes.data)
        setAiHistory(histRes.data)
      } catch {
        /* panels degrade gracefully */
      }
    })()
    return () => { alive = false }
  }, [])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chats, activeId, sending])

  /* ── Derived ── */

  const activeChat = useMemo(() => chats.find((c) => c.id === activeId) ?? null, [chats, activeId])
  const messages = activeChat?.messages ?? []

  useEffect(() => {
    document.body.classList.add('ai-coach-page-active')
    return () => document.body.classList.remove('ai-coach-page-active')
  }, [])

  const nextExam = exams[0] ?? null

  const weakSubject = useMemo(() => {
    if (!dashboard?.subjects_summary?.length) return null
    return (
      [...dashboard.subjects_summary]
        .filter((s) => s.total_topics > 0)
        .sort((a, b) => a.topics_completed / a.total_topics - b.topics_completed / b.total_topics)[0] ?? null
    )
  }, [dashboard])

  const weakTopicStat = useMemo(() => {
    const done = quizHist.filter((q) => q.score !== null && q.total_questions > 0)
    const map = new Map<string, { correct: number; total: number }>()
    for (const q of done) {
      const e = map.get(q.topic) ?? { correct: 0, total: 0 }
      e.correct += q.score ?? 0
      e.total += q.total_questions
      map.set(q.topic, e)
    }
    let worst: { topic: string; acc: number } | null = null
    for (const [topic, v] of map) {
      const acc = Math.round((v.correct / v.total) * 100)
      if (!worst || acc < worst.acc) worst = { topic, acc }
    }
    return worst
  }, [quizHist])

  const nextSession = useMemo(() => {
    const nowIso = new Date().toISOString().slice(0, 16)
    return (
      tasks
        .filter((t) => t.status !== 'done' && t.scheduled_for && t.scheduled_for.slice(0, 16) >= nowIso)
        .sort((a, b) => (a.scheduled_for ?? '').localeCompare(b.scheduled_for ?? ''))[0] ?? null
    )
  }, [tasks])

  const tasksDoneToday = dashboard?.total_completed_tasks ?? 0
  const tasksTotalToday = (dashboard?.total_completed_tasks ?? 0) + (dashboard?.open_tasks ?? 0)

  const groups = useMemo(() => chatGroups(chats), [chats])

  function commitChats(next: Conversation[]) {
    setChats(next)
    saveChats(next)
  }

  function patchActive(fn: (c: Conversation) => Conversation) {
    if (!activeChat) return
    commitChats(chats.map((c) => (c.id === activeChat.id ? fn(c) : c)))
  }

  function appendMsgs(msgs: ChatMessage[]) {
    if (!msgs.length) return
    if (activeChat) {
      patchActive((c) => ({
        ...c,
        updated_at: new Date().toISOString(),
        title: c.messages.length === 0 ? deriveTitle(msgs) : c.title,
        messages: [...c.messages, ...msgs],
      }))
    } else {
      const conv: Conversation = {
        id: uid(),
        title: deriveTitle(msgs),
        updated_at: new Date().toISOString(),
        messages: msgs,
      }
      commitChats([conv, ...chats])
      setActiveId(conv.id)
    }
  }

  function deriveTitle(msgs: ChatMessage[]) {
    const firstStudent = msgs.find((m) => m.role === 'student')
    if (firstStudent) return firstStudent.text.slice(0, 34) || 'New chat'
    const coach = msgs[0]
    if (coach?.mode === 'plan') return '\uD83D\uDCC5 Plan my day'
    if (coach?.mode === 'exam') return '\uD83C\uDF93 Exam prep'
    if (coach?.mode === 'practice') return '\uD83D\uDCDD Quiz'
    if (coach?.mode === 'analyze') return '\uD83D\uDCCA Progress analysis'
    if (coach?.text) return coach.text.replace(/\n/g, ' ').slice(0, 34)
    return 'New chat'
  }

  function newChat() {
    setActiveId(null)
    setInput('')
    setTopicMode(false)
    setSidebarOpen(false)
  }

  function openChat(c: Conversation) {
    setActiveId(c.id)
    setSidebarOpen(false)
  }

  function deleteChat(id: string) {
    const next = chats.filter((c) => c.id !== id)
    commitChats(next)
    if (activeId === id) setActiveId(null)
  }

  function renameChat(id: string) {
    const c = chats.find((x) => x.id === id)
    if (!c) return
    const name = window.prompt('Rename conversation', c.title)
    if (name && name.trim()) commitChats(chats.map((x) => (x.id === id ? { ...x, title: name.trim() } : x)))
  }

  /* ── Send ── */

  async function send(raw?: string) {
    const text = (raw ?? input).trim()
    if ((!text && attachments.length === 0) || sending) return

    if (topicMode) {
      setTopicMode(false)
      setInput('')
      await generateQuiz(text)
      return
    }

    const attText = attachments.map((a) => '[Attached ' + a.kind + ': ' + a.label + ']\n' + a.content).join('\n\n')
    const student: ChatMessage = { id: uid(), role: 'student', text: text || '(attachment)', mode: 'chat' }
    appendMsgs([student])
    setInput('')
    setSending(true)
    const atts = attachments
    setAttachments([])
    try {
      const { data } = await api.post<{ reply: string; suggestions?: string[] }>('/ai/chat/', {
        message: text + (attText ? '\n\n' + attText : ''),
        context: { page: '/ai-tutor', mode: 'chat', hasAttachment: atts.length > 0 },
      })
      notifyStudyActivity()
      appendMsgs([{ id: uid(), role: 'coach', text: data.reply, chips: data.suggestions?.slice(0, 3), mode: 'chat' }])
    } catch (err) {
      appendMsgs([{ id: uid(), role: 'coach', text: 'I am having trouble connecting right now. Please try again.', mode: 'chat' }])
      toast.error(getErrorMessage(err))
    } finally {
      setSending(false)
    }
  }

  /* ── Quick flows ── */

  function buildPlanRows(): PlanRow[] {
    const open = tasks.filter((t) => t.status !== 'done')
    const pool: Array<{ subject: string; topic: string; minutes: number }> = open
      .slice(0, 4)
      .map((t) => ({
        subject: t.subject_name ?? t.title,
        topic: t.subject_name ? t.title : 'Focus session',
        minutes: t.duration_minutes || 50,
      }))
    if (pool.length < 3) {
      const subjNames = dashboard?.subjects_summary?.map((s) => s.name) ?? []
      const revSubj = weakSubject?.name ?? subjNames[0]
      if (revSubj) pool.push({ subject: revSubj, topic: 'Revision', minutes: 30 })
      const second = subjNames.find((n) => n !== revSubj)
      if (pool.length < 3 && second) pool.push({ subject: second, topic: 'Practice problems', minutes: 45 })
    }
    const startH = Math.min(Math.max(new Date().getHours() + 1, 9), 19)
    let cursorMin = startH * 60
    return pool.slice(0, 4).map((p) => {
      const h = Math.floor(cursorMin / 60)
      const m = cursorMin % 60
      const row = { time: pad2(h) + ':' + pad2(m === 0 ? 0 : m >= 30 ? 30 : 0), subject: p.subject, topic: p.topic, minutes: p.minutes }
      cursorMin += p.minutes + 15
      return row
    })
  }

  function runQuick(key: QuickKey) {
    setSidebarOpen(false)
    if (key === 'plan') {
      const rows = buildPlanRows()
      const totalMin = rows.reduce((s, r) => s + r.minutes, 0)
      appendMsgs([
        {
          id: uid(),
          role: 'coach',
          mode: 'plan',
          text: "I've created a study plan based on your tasks" + (weakSubject ? ", your weakest subject (" + weakSubject.name + ')' : '') + ' and today\u2019s schedule.',
          plan: rows,
          actions: [
            { label: 'Add to Planner (' + fmtMinutes(totalMin) + ')', kind: 'add-plan' },
            { label: 'Start First Session', kind: 'start-focus', route: '/focus' },
          ],
        },
      ])
      return
    }
    if (key === 'exam') {
      const ex = nextExam
      if (!ex) {
        appendMsgs([{ id: uid(), role: 'coach', mode: 'exam', text: 'I don\u2019t see any upcoming exams. Add one on the Exams page and I\u2019ll build you a preparation plan.' }])
        return
      }
      const daysLeft = ex.days_left ?? daysUntil(ex.date)
      const subjName = ex.subject_name ?? ex.title
      const summary = dashboard?.subjects_summary?.find((s) => s.name === subjName)
      const prepPct = ex.preparation_pct ?? (summary && summary.total_topics ? Math.round((summary.topics_completed / summary.total_topics) * 100) : 0)
      const topicsSorted = [...(summary ? [{ name: 'Core concepts', pct: prepPct }] : [])]
      const weakish = topicsSorted.filter((t) => t.pct < 70).map((t) => t.name)
      const strong = topicsSorted.filter((t) => t.pct >= 70).map((t) => t.name)
      const n = Math.min(Math.max(daysLeft, 3), 12)
      const days: ExamPlanData['days'] = []
      for (let k = 1; k <= n; k++) {
        days.push({
          day: k,
          focus: k === n ? 'Mock Exam \u0026 Review' : k % 3 === 0 ? subjName + ' practice problems' : (weakish[k % Math.max(weakish.length, 1)] ?? subjName + ' revision'),
        })
      }
      appendMsgs([
        {
          id: uid(),
          role: 'coach',
          mode: 'exam',
          text: subjName + ' is in ' + daysLeft + ' days. Here is your focused preparation plan.',
          examPlan: { subject: subjName, daysLeft, prepPct, strong, weakish, days },
          actions: [{ label: 'Add Plan to Calendar', kind: 'add-examplan' }],
        },
      ])
      return
    }
    if (key === 'learn') {
      appendMsgs([
        {
          id: uid(),
          role: 'coach',
          mode: 'learn',
          text: 'Ready to learn! Tell me any topic \u2014 for example \u201Cexplain polymorphism\u201D or \u201Cintegration by parts\u201D \u2014 and I\u2019ll break it down step by step.',
          chips: ['Explain polymorphism', 'Explain constructors', 'What is integration?'],
        },
      ])
      return
    }
    if (key === 'practice') {
      appendMsgs([{ id: uid(), role: 'coach', mode: 'practice', text: 'What should I quiz you on?', chips: QUIZ_SOURCES.map((s) => s.label) }])
      return
    }
    if (key === 'analyze') {
      const d = dashboard
      const lines: string[] = []
      if (d) {
        lines.push('Here is what I see in your progress:')
        lines.push('\u2022 Study time today: ' + fmtMinutes(d.today_minutes))
        lines.push('\u2022 Streak: ' + d.current_streak + ' days (best ' + d.longest_streak + ')')
        lines.push('\u2022 Tasks completed: ' + d.total_completed_tasks + ' (' + d.completion_rate + '% rate)')
        if (weakSubject) {
          const pct = Math.round(((weakSubject.topics_completed / weakSubject.total_topics) * 100) || 0)
          lines.push('\u2022 ' + weakSubject.name + ' needs attention at ' + pct + '% completion.')
        }
        if (weakTopicStat) lines.push('\u2022 Weakest quiz topic: ' + weakTopicStat.topic + ' (' + weakTopicStat.acc + '% accuracy).')
      } else {
        lines.push('Loading your data\u2026 give me a moment.')
      }
      appendMsgs([{ id: uid(), role: 'coach', mode: 'analyze', text: lines.join('\n'), actions: [{ label: 'Revise Weak Topic', kind: 'start-focus', route: '/focus' }] }])
      return
    }
    appendMsgs([
      {
        id: uid(),
        role: 'coach',
        mode: 'revise',
        text: weakTopicStat
          ? 'Let\u2019s revise ' + weakTopicStat.topic + ' \u2014 your accuracy there is ' + weakTopicStat.acc + '%. A 50-minute focused session should turn it around.'
          : 'Tell me which topic feels rusty and I\u2019ll structure a revision session for you.',
        actions: [{ label: 'Start 50 min Session', kind: 'start-focus', route: '/focus' }],
      },
    ])
  }

  function onChip(label: string) {
    const src = QUIZ_SOURCES.find((s) => s.label.toLowerCase() === label.toLowerCase())
    if (src && messages[messages.length - 1]?.mode === 'practice') { void handleQuizSource(src.key); return }
    if (/^quiz me$/i.test(label)) { runQuick('practice'); return }
    void send(label)
  }

  async function handleQuizSource(src: 'subject' | 'weak' | 'notes' | 'topic') {
    if (src === 'topic') {
      setTopicMode(true)
      toast.info('Type the topic you want to be quizzed on.')
      return
    }
    let topic = ''
    if (src === 'subject') topic = dashboard?.subjects_summary?.[0]?.name ?? ''
    else if (src === 'weak') topic = weakSubject?.name ?? weakTopicStat?.topic ?? ''
    else if (src === 'notes') topic = notes[0]?.title ?? ''
    if (!topic) { toast.warn('Nothing found for that source yet.'); return }
    await generateQuiz(topic)
  }

  async function generateQuiz(topic: string) {
    if (genBusy) return
    setGenBusy(true)
    try {
      const { data } = await api.post<QuizShape>('/quiz/generate/', { topic, difficulty: 'medium', count: 10 })
      notifyStudyActivity()
      appendMsgs([
        {
          id: uid(),
          role: 'coach',
          mode: 'practice',
          quizTopic: topic,
          text: data.questions.length + ' questions on ' + topic + '. Answer right here \u2014 good luck!',
          actions: [{ label: 'Open in Quiz Center', kind: 'open-quiz', route: '/quiz' }],
        },
      ])
      setQuizBank((prev) => ({ ...prev, [topic]: data }))
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setGenBusy(false)
    }
  }

  /* ── Actions on coach messages ── */

  async function runAction(action: MsgAction, msg: ChatMessage) {
    if (action.kind === 'start-focus' && action.route) { navigate(action.route); return }
    if (action.kind === 'open-quiz' && action.route) { navigate(action.route); return }
    if (action.kind === 'add-plan' && msg.plan) {
      try {
        for (const r of msg.plan) {
          await api.post('/study/tasks/', {
            title: r.subject + ': ' + r.topic,
            subject: null,
            scheduled_for: todayKey() + 'T' + r.time + ':00',
            duration_minutes: r.minutes,
            priority: 'medium',
            status: 'todo',
          })
        }
        notifyStudyActivity()
        toast.success(msg.plan.length + ' sessions added to your calendar.')
      } catch (err) { toast.error(getErrorMessage(err)) }
      return
    }
    if (action.kind === 'add-examplan' && msg.examPlan) {
      const plan = msg.examPlan
      const base = nextExam?.date ?? todayKey()
      try {
        for (const d of plan.days) {
          await api.post('/study/tasks/', {
            title: plan.subject + ': ' + d.focus,
            subject: null,
            scheduled_for: shiftDays(base, -(plan.days.length - d.day)) + 'T18:00:00',
            duration_minutes: 60,
            priority: 'high',
            status: 'todo',
          })
        }
        notifyStudyActivity()
        toast.success(plan.days.length + '-day exam plan added.')
      } catch (err) { toast.error(getErrorMessage(err)) }
    }
  }

  /* ── Attachments & voice ── */

  function attachNote(n: NoteLite) {
    setAttachments((prev) => [...prev, { kind: 'note', label: n.title || 'Untitled note', content: (n.title || '') + '\n' + htmlStrip(n.content).slice(0, 1600) }])
    setNotePicker(false)
    setNoteQuery('')
    toast.success('Note attached.')
  }

  function onPickFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    const lower = f.name.toLowerCase()
    if (lower.endsWith('.pdf') || lower.endsWith('.docx')) {
      setAttachments((prev) => [...prev, { kind: 'file', label: f.name, content: '(User attached the document "' + f.name + '". Refer to it by name.)' }])
      toast.info('Attached ' + f.name + ' (text extraction coming soon).')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setAttachments((prev) => [...prev, { kind: 'file', label: f.name, content: String(reader.result ?? '').slice(0, 3000) }])
      toast.success('File attached.')
    }
    reader.readAsText(f)
  }

  function toggleMic() {
    const SR = (window as unknown as { SpeechRecognition?: new () => SpeechRecLike; webkitSpeechRecognition?: new () => SpeechRecLike }).SpeechRecognition
      ?? (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecLike }).webkitSpeechRecognition
    if (!SR) { toast.info('Voice input is not supported in this browser.'); return }
    if (listening) { recRef.current?.stop(); setListening(false); return }
    const rec = new SR()
    rec.lang = 'en-US'
    rec.interimResults = false
    rec.continuous = false
    rec.onresult = (e) => {
      const said = e.results?.[0]?.[0]?.transcript ?? ''
      setInput((p) => (p ? p + ' ' : '') + said)
    }
    rec.onend = () => setListening(false)
    rec.onerror = () => setListening(false)
    recRef.current = rec
    rec.start()
    setListening(true)
  }

  const filteredNotes = useMemo(
    () => notes.filter((n) => (n.title ?? '').toLowerCase().includes(noteQuery.toLowerCase())).slice(0, 8),
    [notes, noteQuery],
  )


  /* ── Render helpers ── */

  const taRef = useRef<HTMLTextAreaElement | null>(null)

  function autoResize() {
    const el = taRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }

  function onComposerKeyDown(e: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void send()
    }
  }

  function onComposerSubmit(e: FormEvent) {
    e.preventDefault()
    void send()
  }

  function humanPrompt(raw: string): string {
    const t = String(raw ?? '').trim()
    if (t.startsWith('{')) return 'Review the FLOX AI session I ran earlier.'
    if (t.startsWith('"') || t.startsWith("'")) return t.replace(/^['"]|['"]$/g, '')
    return t
  }

  function openAiHistoryItem(item: AiHistoryItem) {
    const resp = item.response as Record<string, unknown> | undefined
    const isQuiz = item.feature === 'quiz' || item.feature === 'practice'
    const questions = Array.isArray(resp?.questions) ? (resp?.questions as unknown[]) : []
    const promptText = humanPrompt(item.prompt)
    const mode = isQuiz ? ('practice' as const) : ('chat' as const)
    const coachText = isQuiz
      ? 'Here\u2019s a ' + (questions.length || 10) + '-question quiz for you. Answer right here \u2014 good luck!'
      : resp
        ? String(resp.reply ?? resp.explanation ?? resp.title ?? '') || promptText
        : promptText
    const conv: Conversation = {
      id: uid(),
      title: (String(resp?.title ?? '') || promptText).slice(0, 36),
      updated_at: item.created_at,
      messages: [
        { id: uid(), role: 'student', text: promptText, mode },
        { id: uid(), role: 'coach', text: coachText, mode },
      ],
    }
    commitChats([conv, ...chats])
    setActiveId(conv.id)
    setSidebarOpen(false)
  }

  async function deleteAiHistory(id: number) {
    try {
      await api.delete('/ai/history/', { data: { id } })
      setAiHistory((prev) => prev.filter((h) => h.id !== id))
      toast.success('History item deleted.')
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  const sidebar = (
    <aside className={'ac-sidebar' + (sidebarOpen ? ' open' : '')}>
      <div className="ac-side-head">
        <span className="ac-side-label">CONVERSATIONS</span>
        <button className="ac-newchat" onClick={newChat}>{'\uFF0B'} New Chat</button>
      </div>
      <div className="ac-side-scroll">
        {groups.map((g) => (
          <section key={g.label} className="ac-group">
            <span className="ac-group-label">{g.label}</span>
            {g.items.map((c) => (
              <div key={c.id} className={'ac-chatitem' + (activeId === c.id ? ' active' : '')}>
                <button className="ci-main" onClick={() => openChat(c)}>
                  <span className="ci-title">{c.title}</span>
                </button>
                <details className="ci-more">
                  <summary aria-label="Conversation options">{'\u22EE'}</summary>
                  <div className="ci-menu">
                    <button onClick={() => renameChat(c.id)}>Rename</button>
                    <button className="danger" onClick={() => deleteChat(c.id)}>Delete</button>
                  </div>
                </details>
              </div>
            ))}
          </section>
        ))}

        {!groups.length && <p className="ac-side-empty">No conversations yet.</p>}

        {aiHistory.length > 0 && (
          <section className="ac-group">
            <span className="ac-group-label">HISTORY</span>
            {aiHistory.slice(0, 8).map((h) => (
              <div key={'h' + h.id} className="ac-chatitem hist">
                <button className="ci-main" onClick={() => openAiHistoryItem(h)}>
                  <span className="ci-title">{(h.response?.title as string) || humanPrompt(h.prompt).slice(0, 36)}</span>
                </button>
                <details className="ci-more" onClick={(e) => e.stopPropagation()}>
                  <summary aria-label="History options">{'\u22EE'}</summary>
                  <div className="ci-menu">
                    <button className="danger" onClick={() => void deleteAiHistory(h.id)}>Delete</button>
                  </div>
                </details>
              </div>
            ))}
          </section>
        )}
      </div>
    </aside>
  )

  const contextPanel = (
    <aside className={'ac-context' + (ctxOpen ? ' sheet-open' : '')}>
      <div className="ac-sheet-head">
        <span>Study Context</span>
        <button onClick={() => setCtxOpen(false)} aria-label="Close context">{'\u00D7'}</button>
      </div>

      <div className="ac-ctx-sec">
        <span className="ac-ctx-label">TODAY</span>
        <div className="ac-ctx-row">{'\uD83D\uDD25'} <b>{dashboard?.current_streak ?? 0} day streak</b></div>
        <div className="ac-ctx-row">{'\u23F1'} <b>{fmtMinutes(dashboard?.today_minutes ?? 0)}</b> studied</div>
        <div className="ac-ctx-row">{'\u2713'} <b>{tasksDoneToday} / {tasksTotalToday}</b> tasks</div>
      </div>

      {nextExam && (
        <div className="ac-ctx-sec">
          <span className="ac-ctx-label">NEXT EXAM</span>
          <b className="ac-ctx-strong">{nextExam.subject_name ?? nextExam.title}</b>
          <span className="ac-ctx-sub">{nextExam.days_left ?? daysUntil(nextExam.date)} days left</span>
          <div className="ac-ctx-barlab">Preparation</div>
          <div className="ac-bar"><i style={{ width: Math.min(100, nextExam.preparation_pct ?? 0) + '%' }} /></div>
        </div>
      )}

      {(weakTopicStat || weakSubject) && (
        <div className="ac-ctx-sec">
          <span className="ac-ctx-label">WEAK TOPIC</span>
          <b className="ac-ctx-strong">{weakTopicStat?.topic ?? weakSubject!.name}</b>
          {weakTopicStat && <span className="ac-ctx-sub">Accuracy: {weakTopicStat.acc}%</span>}
        </div>
      )}

      {nextSession && (
        <div className="ac-ctx-sec">
          <span className="ac-ctx-label">NEXT SESSION</span>
          <b className="ac-ctx-strong">{nextSession.subject_name ?? nextSession.title}</b>
          <span className="ac-ctx-sub">
            {new Date(nextSession.scheduled_for!).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
          </span>
          <button className="ac-startlink" onClick={() => navigate('/focus')}>Start {'\u2192'}</button>
        </div>
      )}

    </aside>
  )

  const chatCol = (
    <main className="ac-chat">
      <div className="ac-mobilebar">
        <button onClick={() => setSidebarOpen(true)} aria-label="Conversations">{'\u2630'}</button>
        <span className="mb-title"><IconBot size={16} /> AI Coach</span>
        <button onClick={() => setCtxOpen(true)} aria-label="Study context" className="ac-ctxbtn">
          <IconAnalytics size={18} /> <span>Context</span>
        </button>
      </div>

      {messages.length === 0 ? (
        <div className="ac-welcome">
          <div className="ac-orb" aria-hidden="true">
            <span className="ac-orb-core" />
            <span className="ac-orb-ring" />
            <span className="ac-orb-pulse" />
          </div>
          <h2>FLOX AI</h2>
          <p className="ac-hi">Hey {userName} {'\uD83D\uDC4B'}</p>
          <p className="ac-q">What would you like to work on today?</p>
          <div className="ac-cards">
            {QUICK_CARDS.map((c) => (
              <button key={c.key} className="ac-cardbtn" onClick={() => runQuick(c.key)}>
                <span>{c.icon}</span>
                <b>{c.label}</b>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="ac-msgs">
          {messages.map((m) =>
            m.role === 'student' ? (
              <div key={m.id} className="ac-row student">
                <span className="ac-userbubble">{m.text}</span>
              </div>
            ) : (
              <div key={m.id} className="ac-row coach">
                <div className="ac-card">
                  <header className="ac-brand">
                    <IconBot size={14} /> FLOX AI
                    {m.mode === 'plan' && <em>{'\uD83D\uDCC5'} PLAN</em>}
                    {m.mode === 'exam' && <em>{'\uD83C\uDF93'} EXAM PREP</em>}
                    {m.mode === 'learn' && <em>{'\uD83E\uDDE0'} LEARN MODE</em>}
                  </header>
                  <p className="ac-text">{m.text}</p>

                  {m.plan && (
                    <div className="ac-plan">
                      <span className="ac-mini-kicker">TODAY</span>
                      {m.plan.map((r, i) => (
                        <div key={i} className="ac-plan-row">
                          <span className="pr-time">{hourLabel(r.time)}</span>
                          <span className="pr-body">
                            <b>{r.subject}</b>
                            <em>{r.topic} {'\u00B7'} {r.minutes}m</em>
                          </span>
                        </div>
                      ))}
                      <span className="ac-plan-total">
                        Total: {fmtMinutes(m.plan.reduce((s, r) => s + r.minutes, 0))}
                      </span>
                    </div>
                  )}

                  {m.examPlan && (
                    <div className="ac-exam">
                      <div className="ae-topline">
                        <b>{m.examPlan.subject}</b>
                        <span>{m.examPlan.daysLeft} days remaining</span>
                      </div>
                      <div className="ac-ctx-barlab">Current preparation</div>
                      <div className="ae-barwrap">
                        <div className="ac-bar big"><i style={{ width: m.examPlan.prepPct + '%' }} /></div>
                        <span className="ae-pct">{m.examPlan.prepPct}%</span>
                      </div>
                      {(m.examPlan.strong.length > 0 || m.examPlan.weakish.length > 0) && (
                        <ul className="ae-topics">
                          {m.examPlan.weakish.map((t) => <li key={t} className="warn">{'\u26A0'} {t}</li>)}
                          {m.examPlan.strong.map((t) => <li key={t}>{'\u2713'} {t}</li>)}
                        </ul>
                      )}
                      <span className="ac-mini-kicker">YOUR {m.examPlan.days.length}-DAY PLAN</span>
                      <div className="ae-days">
                        {m.examPlan.days.map((d) => (
                          <div key={d.day} className="ae-day">
                            <span>Day {d.day}</span>
                            <em>{d.focus}</em>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {m.quizTopic && quizBank[m.quizTopic] && <QuizRunner quiz={quizBank[m.quizTopic]} />}

                  {m.actions && (
                    <div className="ac-msg-actions">
                      {m.actions.map((a) => (
                        <button key={a.label} className={a.kind === 'add-plan' || a.kind === 'add-examplan' ? '' : 'primary'} onClick={() => void runAction(a, m)}>
                          {a.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {m.chips && m.chips.length > 0 && (
                    <div className="ac-chips">
                      {m.chips.map((c) => (
                        <button key={c} disabled={sending || genBusy} onClick={() => onChip(c)}>{c}</button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ),
          )}

          {sending && (
            <div className="ac-row coach">
              <div className="ac-card">
                <div className="ac-typing"><span /><span /><span /></div>
              </div>
            </div>
          )}
          {genBusy && (
            <div className="ac-row coach">
              <div className="ac-card"><p className="ac-text">Generating your quiz{'\u2026'}</p></div>
            </div>
          )}
          <div ref={endRef} />
        </div>
      )}

      {messages.length > 0 && !topicMode && (
        <div className="ac-inputchips">
          {INPUT_CHIPS.map((c) => (
            <button key={c.key} disabled={sending} onClick={() => runQuick(c.key)}>
              {c.icon} {c.label}
            </button>
          ))}
        </div>
      )}

      {attachments.length > 0 && (
        <div className="ac-attrow">
          {attachments.map((a, i) => (
            <span key={a.label + i} className="ac-att">
              {a.kind === 'note' ? '\uD83D\uDCC4' : '\uD83D\uDCCE'} {a.label}
              <button onClick={() => setAttachments(attachments.filter((_, j) => j !== i))} aria-label="Remove attachment">{'\u00D7'}</button>
            </span>
          ))}
        </div>
      )}

      <form className="ac-composer" onSubmit={onComposerSubmit}>
        <button type="button" className="ac-round" onClick={() => setNotePicker(true)} aria-label="Attach note or file">+</button>
        <textarea
          ref={taRef}
          rows={1}
          value={input}
          placeholder={topicMode ? 'Type a topic to be quizzed on...' : 'Ask FLOX anything\u2026'}
          onChange={(e) => { setInput(e.target.value); autoResize() }}
          onKeyDown={onComposerKeyDown}
          disabled={sending}
        />
        <button type="button" className={'ac-round mic' + (listening ? ' on' : '')} onClick={toggleMic} aria-label="Voice input">{'\uD83C\uDFA4'}</button>
        <button type="submit" className="ac-send" disabled={(!input.trim() && attachments.length === 0) || sending} aria-label="Send message">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" />
          </svg>
        </button>
      </form>
    </main>
  )

  /* ── Render ── */

  return (
    <PageShell
      className="ai-coach-page"
      title={'\u2726 AI Coach'}
      subtitle="Your personal study assistant."
    >
      <div className="ac-layout">
        {sidebar}
        {chatCol}
        {contextPanel}
      </div>

      {sidebarOpen && <div className="ac-backdrop" onClick={() => setSidebarOpen(false)} />}
      {ctxOpen && <div className="ac-backdrop" onClick={() => setCtxOpen(false)} />}

      {notePicker && (
        <div className="ac-overlay" onClick={() => setNotePicker(false)}>
          <div className="ac-modal" onClick={(e) => e.stopPropagation()}>
            <header className="ac-modal-head">
              <h3>Attach a note</h3>
              <button onClick={() => setNotePicker(false)} aria-label="Close">{'\u00D7'}</button>
            </header>
            <input
              className="ac-note-search"
              placeholder="Search notes..."
              value={noteQuery}
              onChange={(e) => setNoteQuery(e.target.value)}
              autoFocus
            />
            <div className="ac-note-list">
              {filteredNotes.map((n) => (
                <button key={n.id} onClick={() => attachNote(n)}>
                  {'\uD83D\uDCC4'} {n.title || 'Untitled'}
                </button>
              ))}
              {!filteredNotes.length && <p className="ac-side-empty">No notes match.</p>}
            </div>
            <button className="ac-filebtn" onClick={() => fileRef.current?.click()}>
              {'\uD83D\uDCCE'} Upload .txt / .md / .pdf instead
            </button>
            <input ref={fileRef} type="file" accept=".txt,.md,.pdf,.docx" hidden onChange={onPickFile} />
          </div>
        </div>
      )}
    </PageShell>
  )
}
