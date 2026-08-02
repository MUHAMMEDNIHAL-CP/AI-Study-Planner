import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { toast } from 'react-toastify'
import { api, getErrorMessage } from '../lib/api'
import AppHeader from '../components/AppHeader'

type TutorMode = 'explain' | 'summary' | 'flashcards'
type ExplainLevel = 'kid' | 'exam' | 'research'

type TutorResponse = {
  history_id?: number
  title: string
  provider?: string
  ai_warning?: string
  explanation?: string
  summary?: string[]
  flashcards?: { front: string; back: string }[]
  next_steps?: string[]
}

type ExplainerResponse = {
  history_id?: number
  provider?: string
  ai_warning?: string
  topic?: string
  level?: string
  explanation: string
  analogy: string
  steps: string[]
  check_question: string
}

type AiHistory = {
  id: number
  feature: string
  provider: string
  prompt: string
  response: Partial<TutorResponse & ExplainerResponse>
  created_at: string
}

type SpeechResultEvent = {
  results: ArrayLike<ArrayLike<{ transcript: string }>>
}

type SpeechRecognitionLike = {
  continuous: boolean
  interimResults: boolean
  lang: string
  start: () => void
  onresult: ((event: SpeechResultEvent) => void) | null
  onerror: (() => void) | null
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike

type ChatMessage = {
  id: string
  role: 'student' | 'coach'
  text: string
}

const modeLabels: Record<TutorMode, string> = {
  explain: 'Explain',
  summary: 'Summary',
  flashcards: 'Flashcards',
}

const levelLabels: Record<ExplainLevel, string> = {
  kid: 'Kid Mode',
  exam: 'Exam Mode',
  research: 'Research',
}

function responseText(answer: TutorResponse | null, explainer: ExplainerResponse | null) {
  if (explainer) return explainer.explanation
  if (answer?.explanation) return answer.explanation
  if (answer?.summary?.length) return answer.summary.join(' ')
  if (answer?.flashcards?.length) return answer.flashcards.map((card) => `${card.front}: ${card.back}`).join(' ')
  return ''
}

function responseTitle(answer: TutorResponse | null, explainer: ExplainerResponse | null, topic: string) {
  if (explainer) return `ELI5: ${explainer.topic || topic}`
  if (answer?.title) return answer.title
  return 'Your AI Tutor is ready'
}

function formatHistoryDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(
    new Date(value),
  )
}

export default function AiTutorPage() {
  const [mode, setMode] = useState<TutorMode>('explain')
  const [level, setLevel] = useState<ExplainLevel>('kid')
  const [topic, setTopic] = useState('Quantum Entanglement Basics')
  const [prompt, setPrompt] = useState('')
  const [answer, setAnswer] = useState<TutorResponse | null>(null)
  const [explainer, setExplainer] = useState<ExplainerResponse | null>(null)
  const [history, setHistory] = useState<AiHistory[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'coach',
      text: 'Choose a mode, enter a topic, and ask what you want to understand. I will explain it in a study-friendly way.',
    },
  ])
  const [provider, setProvider] = useState('checking')
  const [loading, setLoading] = useState(false)
  const [listening, setListening] = useState(false)

  const providerLabel = provider === 'gemini' ? 'Gemini live' : provider === 'mock' ? 'Fallback mode' : provider
  const activeText = responseText(answer, explainer)
  const latestFlashcards = useMemo(() => {
    const fromAnswer = answer?.flashcards
    if (fromAnswer?.length) return fromAnswer
    const fromHistory = history.find((item) => item.response.flashcards?.length)?.response.flashcards
    return fromHistory?.length ? fromHistory : []
  }, [answer, history])

  useEffect(() => {
    let active = true

    async function loadTutorData() {
      try {
        const [statusRes, historyRes] = await Promise.all([
          api.get<{ provider: string; gemini_configured: boolean }>('/ai/status/'),
          api.get<AiHistory[]>('/ai/history/'),
        ])
        if (!active) return
        setProvider(statusRes.data.gemini_configured ? statusRes.data.provider : 'mock')
        setHistory(historyRes.data.filter((item) => item.feature === 'tutor'))
      } catch (error) {
        if (!active) return
        setProvider('unknown')
        toast.error(getErrorMessage(error))
      }
    }

    void loadTutorData()
    return () => {
      active = false
    }
  }, [])

  async function refreshHistory() {
    try {
      const { data } = await api.get<AiHistory[]>('/ai/history/')
      setHistory(data.filter((item) => item.feature === 'tutor'))
    } catch {
      // History is helpful, but the active answer already rendered.
    }
  }

  async function askTutor(event?: FormEvent) {
    event?.preventDefault()
    const cleanTopic = topic.trim()
    const cleanPrompt = prompt.trim()
    if (!cleanTopic) {
      toast.info('Enter a topic first.')
      return
    }

    setLoading(true)
    setMessages((current) => [
      ...current,
      {
        id: `${Date.now()}-student`,
        role: 'student',
        text: cleanPrompt || `${modeLabels[mode]} ${cleanTopic}`,
      },
    ])

    try {
      const { data } = await api.post<TutorResponse>('/ai/tutor/', { mode, topic: cleanTopic, prompt: cleanPrompt })
      setAnswer(data)
      setExplainer(null)
      setProvider(data.provider ?? 'gemini')
      const text = responseText(data, null) || data.title
      setMessages((current) => [...current, { id: `${Date.now()}-coach`, role: 'coach', text }])
      speak(text)
      setPrompt('')
      void refreshHistory()
      toast.success('Tutor response ready.')
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  async function explainTopic() {
    const cleanTopic = topic.trim()
    if (!cleanTopic) {
      toast.info('Enter a topic first.')
      return
    }

    setLoading(true)
    setMessages((current) => [
      ...current,
      { id: `${Date.now()}-student`, role: 'student', text: `${levelLabels[level]} explanation for ${cleanTopic}` },
    ])

    try {
      const { data } = await api.post<ExplainerResponse>('/ai/explain/', { topic: cleanTopic, level })
      setExplainer(data)
      setAnswer(null)
      setProvider(data.provider ?? 'gemini')
      const text = `${data.explanation} Analogy: ${data.analogy}`
      setMessages((current) => [...current, { id: `${Date.now()}-coach`, role: 'coach', text }])
      speak(text)
      void refreshHistory()
      toast.success('Explanation generated.')
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  function speak(text = activeText) {
    if (!text || !('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 0.94
    utterance.pitch = 1
    window.speechSynthesis.speak(utterance)
  }

  function stopSpeech() {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
  }

  async function copyAnswer() {
    const text = activeText || 'No answer generated yet.'
    await navigator.clipboard.writeText(text)
    toast.success('Answer copied.')
  }

  function startDictation() {
    const speechWindow = window as Window & {
      SpeechRecognition?: SpeechRecognitionConstructor
      webkitSpeechRecognition?: SpeechRecognitionConstructor
    }
    const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition
    if (!Recognition) {
      toast.info('Speech recognition is not supported in this browser.')
      return
    }
    const recognition = new Recognition()
    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = 'en-US'
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript
      if (transcript) setPrompt(transcript)
      setListening(false)
    }
    recognition.onerror = () => {
      setListening(false)
      toast.error('Voice capture failed.')
    }
    setListening(true)
    recognition.start()
  }

  function openHistoryItem(item: AiHistory) {
    setTopic(item.response.topic || item.prompt || topic)
    if (item.response.explanation && item.response.analogy) {
      setExplainer(item.response as ExplainerResponse)
      setAnswer(null)
    } else {
      setAnswer(item.response as TutorResponse)
      setExplainer(null)
    }
  }

  return (
    <div className="flow-page tutor-page">
      <AppHeader className="tutor-top">
        <label className="flow-search"><span>Ask difficult concepts, summaries, and flashcards...</span></label>
        <strong className="tutor-top-brand">FocusFlow AI</strong>
      </AppHeader>

      <section className="tutor-hero">
        <div>
          <span className="eyebrow">AI Tutor workspace</span>
          <h1>Study with a focused AI tutor.</h1>
          <p>Ask questions, simplify hard topics, generate summaries, and turn answers into active-recall cards.</p>
        </div>
        <div className={`provider-card provider-card-${provider}`}>
          <span>Provider</span>
          <strong>{providerLabel}</strong>
          <small>{provider === 'gemini' ? 'AI calls are connected.' : 'Fallback answers keep the page working.'}</small>
        </div>
      </section>

      <div className="tutor-grid">
        <main className="tutor-chat">
          <form className="tutor-composer top-composer" onSubmit={askTutor}>
            <label>
              Topic
              <input value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="Photosynthesis, limits, market failure..." />
            </label>
            <label>
              Mode
              <select value={mode} onChange={(event) => setMode(event.target.value as TutorMode)}>
                {(Object.keys(modeLabels) as TutorMode[]).map((item) => <option value={item} key={item}>{modeLabels[item]}</option>)}
              </select>
            </label>
            <label>
              Level
              <select value={level} onChange={(event) => setLevel(event.target.value as ExplainLevel)}>
                {(Object.keys(levelLabels) as ExplainLevel[]).map((item) => <option value={item} key={item}>{levelLabels[item]}</option>)}
              </select>
            </label>
            <button className="gradient-action" disabled={loading} type="submit">{loading ? 'Thinking...' : 'Ask Tutor'}</button>
          </form>

          <section className="tutor-answer-card">
            <div className="tutor-answer-head">
              <div>
                <span className="eyebrow">{explainer ? levelLabels[level] : modeLabels[mode]}</span>
                <h2>{responseTitle(answer, explainer, topic)}</h2>
              </div>
              <b className={`provider-pill provider-${provider}`}>{providerLabel}</b>
            </div>

            {answer?.ai_warning || explainer?.ai_warning ? (
              <div className="dashboard-alert">{answer?.ai_warning ?? explainer?.ai_warning}</div>
            ) : null}

            <p>{activeText || 'Ask a question, request a summary, or press ELI5 to generate a focused tutor response.'}</p>

            {answer?.summary?.length ? (
              <ul className="answer-list">
                {answer.summary.map((item) => <li key={item}>{item}</li>)}
              </ul>
            ) : null}

            {answer?.next_steps?.length ? (
              <div className="tutor-next-steps">
                {answer.next_steps.map((item) => <span key={item}>{item}</span>)}
              </div>
            ) : null}

            {explainer ? (
              <div className="concept-grid">
                <article><b>ANALOGY</b><strong>{explainer.analogy}</strong><span>{explainer.check_question}</span></article>
                <article><b>RECALL PATH</b><strong>{explainer.steps.length} steps</strong><span>{explainer.steps.join(' -> ')}</span></article>
              </div>
            ) : null}

            {latestFlashcards.length ? (
              <div className="flashcard-grid">
                {latestFlashcards.slice(0, 4).map((card) => (
                  <article key={card.front}><b>{card.front}</b><span>{card.back}</span></article>
                ))}
              </div>
            ) : null}

            <div className="tutor-answer-actions">
              <button className="ghost-button" disabled={!activeText} onClick={() => speak()} type="button">Read Aloud</button>
              <button className="ghost-button" onClick={stopSpeech} type="button">Stop Voice</button>
              <button className="ghost-button" disabled={!activeText} onClick={() => void copyAnswer()} type="button">Copy</button>
              <button className="ghost-button" disabled={loading} onClick={explainTopic} type="button">ELI5</button>
            </div>
          </section>

          <section className="tutor-conversation page-card">
            <div className="section-heading">
              <div>
                <span>Conversation</span>
                <h2>FocusFlow Coach</h2>
              </div>
            </div>
            <div className="chat-window tutor-chat-window">
              {messages.map((message) => (
                <p className={`coach-message ${message.role}`} key={message.id}>{message.text}</p>
              ))}
            </div>
          </section>

          <form className="bottom-composer tutor-bottom-composer" onSubmit={askTutor}>
            <button className="round-control" onClick={startDictation} type="button">{listening ? '...' : 'Mic'}</button>
            <input
              placeholder="Ask your tutor anything..."
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
            />
            <button className="gradient-action" disabled={loading} type="submit">{loading ? 'Sending...' : 'Send'}</button>
          </form>
        </main>

        <aside className="tutor-right">
          <section className="page-card tutor-side-card tutor-voice-card">
            <div className="panel-heading"><h3>Voice Coach</h3><span>{listening ? 'Live' : 'Ready'}</span></div>
            <p>Dictate your question, then let FocusFlow read the answer aloud.</p>
            <button className="gradient-action" type="button" onClick={startDictation}>{listening ? 'Listening...' : 'Start Mic'}</button>
          </section>

          <section className="page-card tutor-side-card">
            <div className="panel-heading"><h3>Recent Tutor Work</h3><span>{history.length}</span></div>
            <div className="tutor-history-list">
              {history.slice(0, 5).map((item) => (
                <button key={item.id} onClick={() => openHistoryItem(item)} type="button">
                  <strong>{item.response.title || item.response.topic || item.prompt}</strong>
                  <span>{formatHistoryDate(item.created_at)} - {item.provider}</span>
                </button>
              ))}
              {!history.length ? <p className="empty-state">Your tutor history will appear after the first AI answer.</p> : null}
            </div>
          </section>

          <section className="page-card tutor-side-card">
            <div className="panel-heading"><h3>Flashcard Deck</h3><span>{latestFlashcards.length}</span></div>
            <div className="tutor-deck-list">
              {latestFlashcards.slice(0, 3).map((card) => (
                <article key={card.front}><strong>{card.front}</strong><span>{card.back}</span></article>
              ))}
              {!latestFlashcards.length ? <p className="empty-state">Generate flashcards to build a quick recall deck.</p> : null}
            </div>
          </section>

          <section className="page-card focus-goal tutor-goal-card">
            <h3>Study Prompt Quality</h3>
            <strong>{prompt.length || topic.length}</strong>
            <span>characters of context</span>
          </section>
        </aside>
      </div>
    </div>
  )
}
