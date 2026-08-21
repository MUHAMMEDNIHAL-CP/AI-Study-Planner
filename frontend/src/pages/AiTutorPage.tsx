import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'react-toastify'
import PageShell from '../components/PageShell'
import { api, getErrorMessage } from '../lib/api'
import { useUserProfile } from '../hooks/useUserProfile'

type AiMode = 'plan' | 'exam' | 'learn' | 'practice' | 'analyze' | 'chat'

type AiHistoryItem = {
  id: number
  feature: string
  provider: string
  prompt: string
  response: Record<string, unknown>
  created_at: string
}

type ChatMessage = {
  id: string
  role: 'student' | 'coach'
  text: string
  mode?: AiMode
}

type DashboardData = {
  current_streak: number
  longest_streak: number
  today_minutes: number
  completion_rate: number
  open_tasks: number
  subjects_summary: Array<{
    name: string
    color: string
    topics_completed: number
    total_topics: number
  }>
  upcoming_exams: Array<{
    id: number
    title: string
    date: string
    subject_name?: string
  }>
  total_completed_tasks: number
  total_study_hours: number
  total_focus_sessions: number
}

type ChatResponse = {
  reply: string
  suggestions?: string[]
  action?: { label: string; route: string } | null
}

const AI_MODES: { key: AiMode; icon: string; label: string; desc: string }[] = [
  { key: 'plan', icon: '📅', label: 'Plan My Day', desc: 'Create a study plan' },
  { key: 'exam', icon: '🎓', label: 'Exam Prep', desc: 'Prepare for exams' },
  { key: 'learn', icon: '🧠', label: 'Explain Topic', desc: 'Teach me a concept' },
  { key: 'practice', icon: '📝', label: 'Quiz Me', desc: 'Test my knowledge' },
  { key: 'analyze', icon: '📊', label: 'Analyze Me', desc: 'Review my progress' },
  { key: 'chat', icon: '🚀', label: 'General Chat', desc: 'Ask anything' },
]

const MODE_SUGGESTIONS: Record<AiMode, string[]> = {
  plan: ['Plan my study day', 'Optimize my schedule', 'What should I study now?'],
  exam: ['Create an exam study plan', 'Am I ready for my exam?', 'What topics should I focus on?'],
  learn: ['Explain constructors in C++', 'What is polymorphism?', 'Simplify integration for me'],
  practice: ['Quiz me on C++', 'Give me 10 questions on Module 2', 'Test my knowledge'],
  analyze: ['Analyze my study progress', 'Which subject needs attention?', 'Am I improving?'],
  chat: ['I have 2 hours today. What should I study?', 'Why am I losing my streak?', 'Give me study tips'],
}
function groupHistoryByDate(items: AiHistoryItem[]) {
  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  const yesterday = new Date(now.getTime() - 86400000).toISOString().slice(0, 10)
  const groups: { label: string; items: AiHistoryItem[] }[] = []
  const byDate = new Map<string, AiHistoryItem[]>()
  for (const item of items) {
    const d = item.created_at.slice(0, 10)
    if (!byDate.has(d)) byDate.set(d, [])
    byDate.get(d)!.push(item)
  }
  if (byDate.has(today)) {
    groups.push({ label: 'TODAY', items: byDate.get(today)! })
    byDate.delete(today)
  }
  if (byDate.has(yesterday)) {
    groups.push({ label: 'YESTERDAY', items: byDate.get(yesterday)! })
    byDate.delete(yesterday)
  }
  const sorted = [...byDate.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  for (const [date, dateItems] of sorted.slice(0, 5)) {
    const label = new Date(date + 'T00:00:00').toLocaleDateString(undefined, {
      month: 'short', day: 'numeric',
    }).toUpperCase()
    groups.push({ label, items: dateItems })
  }
  return groups
}

function daysUntil(date: string) {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return Math.max(0, Math.ceil((new Date(date + 'T00:00:00').getTime() - now.getTime()) / 86400000))
}

function formatMinutes(m: number) {
  const h = Math.floor(m / 60)
  const min = m % 60
  return h ? h + 'h ' + min + 'm' : min + 'm'
}

function getGreeting(mode: AiMode, name: string, nextExam: DashboardData['upcoming_exams'][0] | null, dashboard: DashboardData | null): string {
  switch (mode) {
    case 'plan':
      return 'Hey ' + name + '! I can create a personalized study plan for today. I will check your schedule, upcoming exams, and weak areas. What time do you want to start studying?'
    case 'exam':
      if (nextExam) {
        return 'Your next exam is ' + nextExam.title + ' in ' + daysUntil(nextExam.date) + ' days. Let me help you prepare. What topics do you want to focus on?'
      }
      return 'I do not see any upcoming exams. Would you like to add one, or should I help you plan ahead?'
    case 'learn':
      return 'I am ready to explain any topic! Tell me what you would like to learn, and I will break it down in a way that is easy to understand.'
    case 'practice':
      return 'Let us test your knowledge! Tell me the subject or topic and I will create a quiz for you.'
    case 'analyze':
      return buildAnalysis(dashboard)
    default:
      return 'How can I help you study today, ' + name + '?'
  }
}

function buildAnalysis(dash: DashboardData | null): string {
  if (!dash) return 'Loading your data. Give me a moment...'
  const lines: string[] = []
  lines.push('YOUR AI ANALYSIS')
  lines.push('')
  lines.push('Here is what I see in your progress:')
  lines.push('Study time: ' + formatMinutes(dash.today_minutes) + ' today')
  lines.push('Streak: ' + dash.current_streak + ' days (best: ' + dash.longest_streak + ')')
  lines.push('Tasks completed: ' + dash.total_completed_tasks + ' (' + dash.completion_rate + '% completion)')
  const subjects = dash.subjects_summary || []
  if (subjects.length) {
    const weakest = subjects
      .filter((s) => s.total_topics > 0)
      .sort((a, b) => (a.topics_completed / a.total_topics) - (b.topics_completed / b.total_topics))[0]
    if (weakest) {
      const pct = Math.round((weakest.topics_completed / weakest.total_topics) * 100)
      lines.push('')
      lines.push(weakest.name + ' needs attention at ' + pct + '% completion.')
      lines.push('I recommend adding 2 ' + weakest.name + ' sessions this week.')
    }
  }
  if (dash.current_streak > 0) {
    lines.push('')
    lines.push('You are on a ' + dash.current_streak + '-day streak. Keep it going!')
  }
  return lines.join('\n')
}

export default function AiTutorPage() {
  const profile = useUserProfile()
  const userName = profile?.username?.split(/\s+/)[0] || 'there'

  const [history, setHistory] = useState<AiHistoryItem[]>([])
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [activeMode, setActiveMode] = useState<AiMode | null>(null)
  const [showWelcome, setShowWelcome] = useState(true)
  const [mobilePanel, setMobilePanel] = useState<'conversations' | 'chat' | 'context'>('chat')

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const isCoarsePointer = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => { scrollToBottom() }, [messages, scrollToBottom])

  useEffect(() => {
    if (!showWelcome && inputRef.current && !isCoarsePointer) inputRef.current.focus()
  }, [showWelcome, isCoarsePointer])

  useEffect(() => {
    if (!input && inputRef.current) inputRef.current.style.height = 'auto'
  }, [input])

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const [histRes, dashRes] = await Promise.all([
          api.get<AiHistoryItem[]>('/ai/history/'),
          api.get<DashboardData>('/study/dashboard/'),
        ])
        if (!active) return
        setHistory(histRes.data)
        setDashboard(dashRes.data)
      } catch {
        if (!active) return
      }
    }
    void load()
    return () => { active = false }
  }, [])

  const historyGroups = useMemo(() => groupHistoryByDate(history), [history])

  const weakSubject = useMemo(() => {
    if (!dashboard?.subjects_summary?.length) return null
    return dashboard.subjects_summary
      .filter((s) => s.total_topics > 0)
      .sort((a, b) => (a.topics_completed / a.total_topics) - (b.topics_completed / b.total_topics))[0] || null
  }, [dashboard])

  const nextExam = dashboard?.upcoming_exams?.[0] || null

  const examPrepPct = useMemo(() => {
    if (!nextExam || !dashboard?.subjects_summary) return 0
    const subj = dashboard.subjects_summary.find((s) => s.name === nextExam.subject_name)
    if (!subj || !subj.total_topics) return 0
    return Math.round((subj.topics_completed / subj.total_topics) * 100)
  }, [nextExam, dashboard])

  function startMode(mode: AiMode) {
    setActiveMode(mode)
    setShowWelcome(false)
    setMobilePanel('chat')
    const greeting = getGreeting(mode, userName, nextExam, dashboard)
    setMessages([{ id: 'welcome-' + Date.now(), role: 'coach', text: greeting, mode }])
  }

  function startNewChat() {
    setMessages([])
    setActiveMode(null)
    setShowWelcome(true)
    setInput('')
    setMobilePanel('chat')
  }

  function loadHistoryItem(item: AiHistoryItem) {
    setShowWelcome(false)
    setActiveMode('chat')
    setMobilePanel('chat')
    const resp = item.response as Record<string, unknown> | undefined
    const responseText = resp
      ? (resp.reply as string) || (resp.explanation as string) || (resp.title as string) || item.prompt
      : item.prompt
    setMessages([
      { id: 'hist-s-' + item.id, role: 'student', text: item.prompt },
      { id: 'hist-c-' + item.id, role: 'coach', text: responseText || item.prompt },
    ])
  }

  async function sendMessage(text: string) {
    const trimmed = text.trim()
    if (!trimmed || loading) return
    setMessages((prev) => [...prev, { id: 's-' + Date.now(), role: 'student', text: trimmed }])
    setInput('')
    setLoading(true)
    try {
      const { data } = await api.post<ChatResponse>('/ai/chat/', {
        message: trimmed,
        context: { page: '/ai-tutor', mode: activeMode },
      })
      setMessages((prev) => [...prev, { id: 'c-' + Date.now(), role: 'coach', text: data.reply, mode: activeMode ?? undefined }])
    } catch (err) {
      setMessages((prev) => [...prev, { id: 'err-' + Date.now(), role: 'coach', text: 'I am having trouble connecting right now. Please try again.' }])
      toast.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    void sendMessage(input)
  }

  function autoResizeInput() {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 132) + 'px'
  }

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !isCoarsePointer) {
      e.preventDefault()
      void sendMessage(input)
    }
  }

  return (
    <PageShell
      className="ai-coach-page"
      eyebrow="AI Coach"
      title="AI Study Coach"
      subtitle="Plan, learn, practice, and analyze with your AI coach."
    >
      <div className="ac-layout">
        {/* Mobile panel tabs */}
        <div className="ac-mobile-tabs">
          <button className={mobilePanel === 'conversations' ? 'active' : ''} onClick={() => setMobilePanel('conversations')} type="button">Chats</button>
          <button className={mobilePanel === 'chat' ? 'active' : ''} onClick={() => setMobilePanel('chat')} type="button">AI</button>
          <button className={mobilePanel === 'context' ? 'active' : ''} onClick={() => setMobilePanel('context')} type="button">Context</button>
        </div>

        {/* Left: Conversations */}
        <aside className={'ac-sidebar ' + (mobilePanel === 'conversations' ? 'ac-mobile-show' : '')}>
          <div className="ac-sidebar-header">
            <span className="eyebrow">CONVERSATIONS</span>
            <button className="ac-new-chat-btn" onClick={startNewChat} type="button">+ New Chat</button>
          </div>
          <div className="ac-sidebar-list">
            {historyGroups.map((group) => (
              <div className="ac-history-group" key={group.label}>
                <span className="ac-history-date">{group.label}</span>
                {group.items.map((item) => (
                  <button className="ac-history-item" key={item.id} onClick={() => loadHistoryItem(item)} type="button">
                    <span className="ac-history-title">{String((item.response as Record<string, unknown>)?.title || item.prompt || 'Chat')}</span>
                    <span className="ac-history-time">{new Date(item.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>
                  </button>
                ))}
              </div>
            ))}
            {!historyGroups.length && (
              <p className="ac-empty-hint">No conversations yet.</p>
            )}
          </div>
        </aside>

        {/* Center: Chat */}
        <main className={'ac-chat ' + (mobilePanel === 'chat' ? 'ac-mobile-show' : '')}>
          {showWelcome ? (
            <div className="ac-welcome">
              <div className="ac-welcome-icon">{'\uD83E\uDD16'}</div>
              <h2 className="ac-welcome-name">Hey {userName}!</h2>
              <p className="ac-welcome-sub">I am your Flox AI Coach.</p>
              <p className="ac-welcome-desc">I can help you plan, learn, revise, practice, and stay on track.</p>
              <div className="ac-mode-grid">
                {AI_MODES.map((mode) => (
                  <button className="ac-mode-card" key={mode.key} onClick={() => startMode(mode.key)} type="button">
                    <span className="ac-mode-icon">{mode.icon}</span>
                    <strong>{mode.label}</strong>
                    <span>{mode.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="ac-messages">
              {messages.map((msg) => (
                <div className={'ac-msg ' + msg.role} key={msg.id}>
                  {msg.role === 'coach' && <span className="ac-msg-avatar">{'\uD83E\uDD16'}</span>}
                  <div className="ac-msg-content">
                    <p>{msg.text}</p>
                  </div>
                  {msg.role === 'student' && <span className="ac-msg-avatar user-avatar">{userName.charAt(0).toUpperCase()}</span>}
                </div>
              ))}
              {loading && (
                <div className="ac-msg coach">
                  <span className="ac-msg-avatar">{'\uD83E\uDD16'}</span>
                  <div className="ac-msg-content">
                    <div className="ac-typing"><span /><span /><span /></div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}

          {messages.length <= 2 && activeMode && !loading && (
            <div className="ac-suggestions">
              {MODE_SUGGESTIONS[activeMode].map((s) => (
                <button className="ac-suggestion-chip" key={s} onClick={() => void sendMessage(s)} type="button">{s}</button>
              ))}
            </div>
          )}

          <form className="ac-input-bar" onSubmit={handleSubmit}>
            <textarea
              ref={inputRef}
              rows={1}
              placeholder="Ask Flox AI..."
              value={input}
              onChange={(e) => { setInput(e.target.value); autoResizeInput() }}
              onKeyDown={handleInputKeyDown}
              disabled={loading}
            />
            <button className="ac-send-btn" disabled={!input.trim() || loading} type="submit" aria-label="Send message">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" />
              </svg>
            </button>
          </form>
        </main>
        {/* Right: Study Context */}
        <aside className={'ac-context ' + (mobilePanel === 'context' ? 'ac-mobile-show' : '')}>
          <div className="ac-ctx-section">
            <span className="eyebrow">TODAY</span>
            <div className="ac-ctx-stat">
              <span>Study time</span>
              <strong>{formatMinutes(dashboard?.today_minutes ?? 0)}</strong>
            </div>
            <div className="ac-ctx-stat">
              <span>Tasks</span>
              <strong>{dashboard?.total_completed_tasks ?? 0} done</strong>
            </div>
            <div className="ac-ctx-stat">
              <span>{'\uD83D\uDD25'} Streak</span>
              <strong>{dashboard?.current_streak ?? 0} days</strong>
            </div>
          </div>

          {nextExam && (
            <div className="ac-ctx-section">
              <span className="eyebrow">NEXT EXAM</span>
              <div className="ac-ctx-exam-name">{nextExam.title}</div>
              <div className="ac-ctx-stat">
                <span>{daysUntil(nextExam.date)} days left</span>
              </div>
              <div className="ac-ctx-bar-track">
                <div className="ac-ctx-bar-fill" style={{ width: examPrepPct + '%' }} />
              </div>
              <div className="ac-ctx-bar-label">{examPrepPct}% prepared</div>
            </div>
          )}

          {weakSubject && (
            <div className="ac-ctx-section">
              <span className="eyebrow">WEAK SUBJECT</span>
              <div className="ac-ctx-weak-name">{weakSubject.name}</div>
              <div className="ac-ctx-bar-track">
                <div className="ac-ctx-bar-fill warning" style={{ width: (weakSubject.total_topics ? Math.round((weakSubject.topics_completed / weakSubject.total_topics) * 100) : 0) + '%' }} />
              </div>
              <div className="ac-ctx-bar-label">{weakSubject.total_topics ? Math.round((weakSubject.topics_completed / weakSubject.total_topics) * 100) : 0}% complete</div>
            </div>
          )}

          <div className="ac-ctx-section ac-ctx-suggestion">
            <span className="eyebrow">AI SUGGESTION</span>
            <p>{'\uD83D\uDCA1'} You should revise {weakSubject?.name || 'your weakest subject'} today.</p>
          </div>
        </aside>
      </div>
    </PageShell>
  )
}