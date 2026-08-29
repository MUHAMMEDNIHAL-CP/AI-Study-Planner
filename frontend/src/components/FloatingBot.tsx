import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { useUserProfile, initials } from '../hooks/useUserProfile'
import { api, getErrorMessage } from '../lib/api'
import { notifyStudyActivity } from '../lib/studyActivity'

type ChatMessage = {
  id: string
  role: 'user' | 'bot'
  text: string
  suggestions?: string[]
  action?: { label: string; route: string } | null
}

type ChatResponse = {
  reply: string
  suggestions?: string[]
  action?: { label: string; route: string } | null
}

type QuickAction = {
  label: string
  message: string
  icon: string
}

const pageQuickActions: Record<string, QuickAction[]> = {
  '/dashboard': [
    { label: 'Plan my study', message: 'What should I study now?', icon: '\uD83D\uDCCB' },
    { label: 'Explain a topic', message: 'Explain a topic for me', icon: '\uD83E\uDDE0' },
    { label: 'My progress', message: 'How is my study progress?', icon: '\uD83D\uDCCA' },
    { label: 'Quiz me', message: 'Quiz me on a topic', icon: '\uD83C\uDFAF' },
  ],
  '/subjects': [
    { label: 'Which subject to focus?', message: 'Which subject should I focus on right now?', icon: '\uD83D\uDCDA' },
    { label: 'Weak topics', message: 'What are my weakest topics?', icon: '\uD83D\uDD0D' },
    { label: 'Study tips', message: 'Give me study tips for my subjects', icon: '\uD83D\uDCA1' },
    { label: 'Add a subject', message: 'Help me set up a new subject', icon: '\u2795' },
  ],
  '/planner': [
    { label: 'Optimize schedule', message: 'Can you optimize my study schedule for today?', icon: '\u26A1' },
    { label: 'Plan for tomorrow', message: 'Make my plan for tomorrow', icon: '\uD83D\uDCC5' },
    { label: 'Exam strategy', message: 'What is my best exam preparation strategy?', icon: '\uD83C\uDFAF' },
    { label: 'Review weak areas', message: 'Which weak areas should I prioritize?', icon: '\uD83D\uDD0D' },
  ],
  '/tasks': [
    { label: 'What to do first?', message: 'What task should I do first right now?', icon: '\u2B50' },
    { label: 'Reorganize tasks', message: 'Can you reorganize my tasks by priority?', icon: '\uD83D\uDD04' },
    { label: 'Overdue tasks', message: 'Do I have any overdue tasks?', icon: '\u23F0' },
    { label: 'Add a task', message: 'Help me create a study task', icon: '\u2795' },
  ],
  '/focus': [
    { label: 'Ready for session', message: 'Ready for my next focus session. Any tips?', icon: '\uD83E\uDDD8' },
    { label: 'What to study?', message: 'What should I study in this focus session?', icon: '\uD83C\uDFAF' },
    { label: 'Motivate me', message: 'I need motivation to start studying', icon: '\uD83D\uDCAA' },
    { label: 'Session length', message: 'How long should my focus session be?', icon: '\u23F1\uFE0F' },
  ],
  '/progress': [
    { label: 'Analyze my data', message: 'Analyze my study progress and give insights', icon: '\uD83D\uDCCA' },
    { label: 'Am I improving?', message: 'Am I improving compared to last week?', icon: '\uD83D\uDCC8' },
    { label: 'Subject breakdown', message: 'How am I doing in each subject?', icon: '\uD83D\uDCDA' },
    { label: 'Study advice', message: 'Based on my progress, what should I change?', icon: '\uD83D\uDCA1' },
  ],
  '/notes': [
    { label: 'Study techniques', message: 'What are the best note-taking techniques?', icon: '\uD83D\uDCDD' },
    { label: 'Summarize notes', message: 'How should I organize my study notes?', icon: '\uD83D\uDCCB' },
    { label: 'Active recall', message: 'How can I use notes for active recall?', icon: '\uD83E\uDDE0' },
    { label: 'Note tips', message: 'Give me tips for better study notes', icon: '\uD83D\uDCA1' },
  ],
  '/exams': [
    { label: 'Am I ready?', message: 'Am I prepared for my upcoming exam?', icon: '\uD83C\uDF93' },
    { label: 'Create study plan', message: 'Create a study plan for my next exam', icon: '\uD83D\uDCCB' },
    { label: 'What to focus on?', message: 'What topics should I focus on for my exam?', icon: '\uD83C\uDFAF' },
    { label: 'Mock exam', message: 'Give me a mock exam on my weakest subject', icon: '\uD83D\uDCDD' },
  ],
  '/ai-tutor': [
    { label: 'Plan my day', message: 'Plan my study day', icon: '\uD83D\uDCC5' },
    { label: 'Exam prep', message: 'Help me prepare for my next exam', icon: '\uD83C\uDF93' },
    { label: 'Explain a topic', message: 'Explain a topic for me', icon: '\uD83E\uDDE0' },
    { label: 'Quiz me', message: 'Quiz me on a topic', icon: '\uD83D\uDCDD' },
  ],
  '/calendar': [
    { label: 'Upcoming deadlines', message: 'What are my upcoming deadlines?', icon: '\uD83D\uDCC5' },
    { label: 'Plan my week', message: 'Help me plan my study week', icon: '\uD83D\uDCCB' },
    { label: 'Exam countdown', message: 'How many days until my next exam?', icon: '\u23F0' },
  ],
}

const defaultQuickActions: QuickAction[] = [
  { label: 'What should I study?', message: 'What should I study now?', icon: '\uD83C\uDFAF' },
  { label: 'Explain a topic', message: 'Explain a topic for me', icon: '\uD83E\uDDE0' },
  { label: 'My progress', message: 'How is my study progress?', icon: '\uD83D\uDCCA' },
  { label: 'Quiz me', message: 'Quiz me on a topic', icon: '\uD83D\uDCDD' },
]

function getGreeting(name: string) {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning, ' + name + '!'
  if (hour < 17) return 'Good afternoon, ' + name + '!'
  return 'Good evening, ' + name + '!'
}

export default function FloatingBot() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [hasWelcomed, setHasWelcomed] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const location = useLocation()
  const navigate = useNavigate()
  const profile = useUserProfile()
  const name = profile?.username?.split(/\s+/)[0] || 'there'

  const currentPath = location.pathname
  const quickActions = pageQuickActions[currentPath] || defaultQuickActions
  const isCoarsePointer = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  useEffect(() => {
    if (isOpen && inputRef.current && !isCoarsePointer) {
      inputRef.current.focus()
    }
  }, [isOpen, isCoarsePointer])

  useEffect(() => {
    if (isOpen && !hasWelcomed) {
      setHasWelcomed(true)
      setMessages([{
        id: 'welcome',
        role: 'bot',
        text: getGreeting(name) + ' What would you like help with today?',
        suggestions: quickActions.map(a => a.label),
      }])
    }
  }, [isOpen, hasWelcomed, name, quickActions])

  useEffect(() => {
    setHasWelcomed(false)
  }, [currentPath])

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return

    const userMsg: ChatMessage = {
      id: 'user-' + Date.now(),
      role: 'user',
      text: text.trim(),
    }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const { data } = await api.post<ChatResponse>('/ai/chat/', {
        message: text.trim(),
        context: { page: currentPath },
      })
      notifyStudyActivity()

      const botMsg: ChatMessage = {
        id: 'bot-' + Date.now(),
        role: 'bot',
        text: data.reply,
        suggestions: data.suggestions,
        action: data.action,
      }
      setMessages(prev => [...prev, botMsg])
    } catch (err) {
      setMessages(prev => [...prev, {
        id: 'bot-err-' + Date.now(),
        role: 'bot',
        text: 'I am having trouble connecting right now. Please try again.',
      }])
      toast.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    void sendMessage(input)
  }

  function handleSuggestionClick(suggestion: string) {
    const action = quickActions.find(a => a.label === suggestion)
    void sendMessage(action?.message || suggestion)
  }

  function handleActionClick(route: string) {
    navigate(route)
    setIsOpen(false)
  }

  return (
    <>
      <button
        className={'floating-bot-btn ' + (isOpen ? 'open' : '')}
        onClick={() => setIsOpen(prev => !prev)}
        type="button"
        aria-label="Open AI assistant"
      >
        {isOpen ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 8V4H8" />
            <rect x="2" y="2" width="20" height="20" rx="5" />
            <path d="M12 11v4" />
            <path d="M12 18h.01" />
          </svg>
        )}
      </button>

      {isOpen && (
        <div className="floating-bot-panel">
          <header className="floating-bot-header">
            <div className="floating-bot-header-left">
              <span className="floating-bot-avatar">{'\uD83E\uDD16'}</span>
              <div>
                <strong>Flox AI</strong>
                <small>Study Assistant</small>
              </div>
            </div>
            <button
              className="floating-bot-close"
              onClick={() => setIsOpen(false)}
              type="button"
              aria-label="Close assistant"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </header>

          <div className="floating-bot-messages">
            {messages.map((msg) => (
              <div className={'floating-bot-msg ' + msg.role} key={msg.id}>
                {msg.role === 'bot' && <span className="floating-bot-msg-avatar">{'\uD83E\uDD16'}</span>}
                <div className="floating-bot-msg-content">
                  <p>{msg.text}</p>
                  {msg.action && (
                    <button
                      className="floating-bot-action-btn"
                      onClick={() => handleActionClick(msg.action!.route)}
                      type="button"
                    >
                      {msg.action.label}
                    </button>
                  )}
                  {msg.suggestions && msg.suggestions.length > 0 && (
                    <div className="floating-bot-suggestions">
                      {msg.suggestions.map((s) => (
                        <button
                          className="floating-bot-suggestion"
                          key={s}
                          onClick={() => handleSuggestionClick(s)}
                          type="button"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {msg.role === 'user' && (
                  <span className="floating-bot-msg-avatar user">{initials(name)}</span>
                )}
              </div>
            ))}
            {loading && (
              <div className="floating-bot-msg bot">
                <span className="floating-bot-msg-avatar">{'\uD83E\uDD16'}</span>
                <div className="floating-bot-msg-content">
                  <div className="floating-bot-typing">
                    <span /><span /><span />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {messages.length <= 1 && (
            <div className="floating-bot-quick-actions">
              {quickActions.map((action) => (
                <button
                  className="floating-bot-quick-action"
                  key={action.label}
                  onClick={() => void sendMessage(action.message)}
                  type="button"
                >
                  <span className="qa-icon">{action.icon}</span>
                  <span>{action.label}</span>
                </button>
              ))}
            </div>
          )}

          <form className="floating-bot-input" onSubmit={handleSubmit}>
            <input
              ref={inputRef}
              placeholder="Ask anything about your studies..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
            />
            <button
              className="floating-bot-send"
              disabled={!input.trim() || loading}
              type="submit"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m22 2-7 20-4-9-9-4Z" />
                <path d="M22 2 11 13" />
              </svg>
            </button>
          </form>
        </div>
      )}
    </>
  )
}
