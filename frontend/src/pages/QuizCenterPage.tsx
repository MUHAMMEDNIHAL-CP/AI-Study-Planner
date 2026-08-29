import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'react-toastify'
import PageShell from '../components/PageShell'
import { api, getErrorMessage } from '../lib/api'

/* ── Types ─────────────────────────────────────────────────── */

type Question = { id: number; question: string; options: string[]; answer_index: number; explanation: string }
type Quiz = { id: number; topic: string; difficulty: string; questions: Question[]; score: number | null; total_questions: number; created_at: string }
type QuizResult = { score: number; total: number; results: { id: number; correct: boolean; explanation: string; answer_index: number; selected?: number }[] }
type Subject = { id: number; name: string; color: string; weak_topics?: string; total_topics: number; topics_completed: number }
type Exam = { id: number; title: string; date: string; subject: number | null; subject_name?: string; preparation_pct?: number }
type NoteLite = { id: number; title: string; content: string }

type QuizView = 'dashboard' | 'active' | 'result'
type SourceKey = 'subject' | 'notes' | 'weak' | 'exam'

type PerfBar = { concept: string; pct: number }
type AiAnalysis = {
  strong: string[]
  weak: string[]
  recommendation: string
  performance: PerfBar[]
}

const EMPTY_ANALYSIS: AiAnalysis = { strong: [], weak: [], recommendation: '', performance: [] }

/* ── Constants ─────────────────────────────────────────────── */

const DIFFICULTIES = [
  { key: 'easy', label: 'Easy', color: '#36d479' },
  { key: 'medium', label: 'Medium', color: '#ffb84d' },
  { key: 'hard', label: 'Hard', color: '#ff6b6b' },
]

const QUESTION_COUNTS = [5, 10, 15, 20]

const SOURCES: Array<{ key: SourceKey; label: string; icon: string }> = [
  { key: 'subject', label: 'Subject', icon: '\uD83D\uDCD8' },
  { key: 'notes', label: 'My Notes', icon: '\uD83D\uDCDD' },
  { key: 'weak', label: 'Weak Topics', icon: '\uD83C\uDFAF' },
  { key: 'exam', label: 'Exam', icon: '\uD83C\uDF93' },
]

const SUBJECT_ICONS = ['\uD83D\uDCD8', '\uD83D\uDCD0', '\uD83D\uDEE1', '\uD83E\uDDEA', '\uD83E\uDDEB', '\uD83E\uDDCA']

function accColor(pct: number) {
  return pct >= 80 ? '#36d479' : pct >= 60 ? '#ffb84d' : '#ff6b6b'
}

function accDot(pct: number) {
  return pct >= 80 ? '\uD83D\uDFE2' : pct >= 60 ? '\uD83D\uDFE1' : pct >= 45 ? '\uD83D\uDFE0' : '\uD83D\uDD34'
}

function currentTs() {
  return Date.now()
}

function fmtTime(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m + 'm ' + (s < 10 ? '0' : '') + s + 's'
}

function dayKey(iso: string) {
  return iso.slice(0, 10)
}

function friendlyDate(date: string) {
  const d = new Date(date)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function quizStreakDays(history: Quiz[]) {
  const done = new Set(
    history.filter((q) => q.score !== null).map((q) => dayKey(q.created_at)),
  )
  if (!done.size) return 0
  const cursor = new Date()
  if (!done.has(dayKey(cursor.toISOString()))) {
    cursor.setDate(cursor.getDate() - 1)
    if (!done.has(dayKey(cursor.toISOString()))) return 0
  }
  let streak = 0
  while (done.has(dayKey(cursor.toISOString()))) {
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

function extractJsonObject(text: string): Record<string, unknown> | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const candidates: string[] = []
  if (fenced) candidates.push(fenced[1])
  const braceStart = text.indexOf('{')
  const braceEnd = text.lastIndexOf('}')
  if (braceStart !== -1 && braceEnd > braceStart) candidates.push(text.slice(braceStart, braceEnd + 1))
  for (const c of candidates) {
    try {
      const parsed = JSON.parse(c.trim()) as unknown
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>
    } catch { /* next candidate */ }
  }
  return null
}

function normalizeAnalysis(obj: Record<string, unknown> | null): AiAnalysis | null {
  if (!obj) return null
  const strArr = (v: unknown) => (Array.isArray(v) ? v.map(String) : [])
  let performance: PerfBar[] = []
  if (Array.isArray(obj.performance)) {
    performance = obj.performance
      .filter((p): p is Record<string, unknown> => !!p && typeof p === 'object')
      .map((p) => ({ concept: String(p.concept ?? p.topic ?? ''), pct: Math.max(0, Math.min(100, Math.round(Number(p.pct ?? p.accuracy ?? 0)))) }))
      .filter((p) => p.concept)
      .slice(0, 6)
  }
  const strong = strArr(obj.strong).slice(0, 4)
  const weak = strArr(obj.weak).slice(0, 4)
  const recommendation = typeof obj.recommendation === 'string' ? obj.recommendation : ''
  if (!strong.length && !weak.length && !recommendation && !performance.length) return null
  return { strong, weak, recommendation, performance }
}

type HintState = { text: string; loading: boolean }

export default function QuizCenterPage() {

  const [view, setView] = useState<QuizView>('dashboard')
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [exams, setExams] = useState<Exam[]>([])
  const [notes, setNotes] = useState<NoteLite[]>([])
  const [history, setHistory] = useState<Quiz[]>([])
  const [loading, setLoading] = useState(true)
  const [nowTs] = useState(() => Date.now())

  /* inline AI generator */
  const [cqSubject, setCqSubject] = useState('')
  const [cqTopic, setCqTopic] = useState('')
  const [cqCustomTopic, setCqCustomTopic] = useState('')
  const [cqSource, setCqSource] = useState<SourceKey>('subject')
  const [cqCount, setCqCount] = useState(10)
  const [cqDifficulty, setCqDifficulty] = useState('medium')
  const [generating, setGenerating] = useState(false)
  const [genOpen, setGenOpen] = useState(false)

  /* active quiz */
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null)
  const [currentQ, setCurrentQ] = useState(0)
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [feedbackQid, setFeedbackQid] = useState<number | null>(null)
  const [hints, setHints] = useState<Record<number, HintState>>({})
  const [openHint, setOpenHint] = useState(false)
  const [startTime, setStartTime] = useState(0)
  const [elapsed, setElapsed] = useState(0)

  /* result */
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null)
  const [analysis, setAnalysis] = useState<AiAnalysis>(EMPTY_ANALYSIS)
  const [showReview, setShowReview] = useState(false)
  const [examMeta, setExamMeta] = useState<{ title: string; before: number } | null>(null)

  const loadRef = useRef(0)

  const loadData = useCallback(async () => {
    const run = ++loadRef.current
    try {
      const [subRes, examRes, histRes, noteRes] = await Promise.all([
        api.get<Subject[]>('/study/subjects/'),
        api.get<Exam[]>('/study/exams/').catch(() => ({ data: [] as Exam[] })),
        api.get<Quiz[]>('/quiz/history/').catch(() => ({ data: [] as Quiz[] })),
        api.get<NoteLite[]>('/notes/').catch(() => ({ data: [] as NoteLite[] })),
      ])
      if (run !== loadRef.current) return
      setSubjects(subRes.data)
      setExams(examRes.data)
      setHistory(histRes.data)
      setNotes(noteRes.data)
    } catch (err) { toast.error(getErrorMessage(err)) }
    finally { if (run === loadRef.current) setLoading(false) }
  }, [])

  useEffect(() => {
    void (async () => { await loadData() })()
  }, [loadData])

  useEffect(() => {
    if (view !== 'active') return
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000)
    return () => clearInterval(timer)
  }, [view, startTime])

  /* ── Derived ── */

  const completed = useMemo(() => history.filter((q) => q.score !== null), [history])

  const stats = useMemo(() => {
    const totalQs = completed.reduce((s, q) => s + q.total_questions, 0)
    const totalCorrect = completed.reduce((s, q) => s + (q.score ?? 0), 0)
    return {
      quizzes: history.length,
      accuracy: totalQs ? Math.round((totalCorrect / totalQs) * 100) : 0,
      completedCount: completed.length,
      streak: quizStreakDays(history),
    }
  }, [history, completed])

  const weakTopics = useMemo(() => {
    const map = new Map<string, { correct: number; total: number }>()
    for (const q of completed) {
      const e = map.get(q.topic) ?? { correct: 0, total: 0 }
      e.correct += q.score ?? 0
      e.total += q.total_questions
      map.set(q.topic, e)
    }
    return [...map.entries()]
      .map(([name, v]) => ({ name, accuracy: Math.round((v.correct / v.total) * 100), dot: accDot(Math.round((v.correct / v.total) * 100)) }))
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, 5)
  }, [completed])

  const subjectStats = useMemo(() => {
    const out = new Map<number, { quizzes: number; accuracy: number }>()
    for (const s of subjects) {
      const weakList = (s.weak_topics ?? '')
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean)
      const rel = completed.filter((q) => {
        const t = q.topic.trim().toLowerCase()
        return t === s.name.toLowerCase() || weakList.includes(t)
      })
      const totalQs = rel.reduce((sum, q) => sum + q.total_questions, 0)
      const correct = rel.reduce((sum, q) => sum + (q.score ?? 0), 0)
      out.set(s.id, { quizzes: rel.length, accuracy: totalQs ? Math.round((correct / totalQs) * 100) : 0 })
    }
    return out
  }, [subjects, completed])

  const nextExam = useMemo(() => {
    const upcoming = exams
      .filter((e) => new Date(e.date).getTime() >= nowTs - 86400000)
      .sort((a, b) => a.date.localeCompare(b.date))
    return upcoming[0] ?? null
  }, [exams, nowTs])

  const recentQuizzes = useMemo(
    () =>
      [...history]
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, 6),
    [history],
  )

  const topicOptions = useMemo(() => {
    if (cqSource === 'notes') return notes.map((n) => n.title)
    const s = subjects.find((x) => x.id === Number(cqSubject))
    const base = s ? [s.name] : []
    const weakList = (s?.weak_topics ?? '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
    const opts = [...new Set([...base, ...weakList])]
    if (cqTopic && !opts.includes(cqTopic)) opts.unshift(cqTopic)
    return opts
  }, [subjects, notes, cqSubject, cqSource, cqTopic])

  function resetActive() {
    setCurrentQ(0)
    setAnswers({})
    setFeedbackQid(null)
    setOpenHint(false)
    setHints({})
    setStartTime(currentTs())
    setElapsed(0)
  }

  function beginQuiz(quiz: Quiz) {
    setActiveQuiz(quiz)
    resetActive()
    setView('active')
  }

  /* ── Inline AI quiz generator ── */

  function pickSubject(id: string) {
    setCqSubject(id)
    const s = subjects.find((x) => x.id === Number(id))
    if (s) { setCqTopic(s.name); setCqSource('subject'); setExamMeta(null) }
  }

  function handleSource(key: SourceKey) {
    setCqSource(key)
    if (key === 'weak') {
      setExamMeta(null)
      if (weakTopics[0]) setCqTopic(weakTopics[0].name)
    } else if (key === 'exam') {
      const ex = nextExam
      if (!ex) { toast.warn('No upcoming exams. Add one on the Exams page.'); setCqSource('subject'); return }
      setCqSubject(ex.subject ? String(ex.subject) : '')
      setCqTopic(ex.title || ex.subject_name || 'Exam preparation')
      setExamMeta({ title: ex.title, before: Math.min(100, Math.max(0, ex.preparation_pct ?? 0)) })
    } else if (key === 'notes') {
      setExamMeta(null)
      if (notes[0]) setCqTopic(notes[0].title)
    } else {
      setExamMeta(null)
      const s = subjects.find((x) => x.id === Number(cqSubject))
      if (s && (!cqTopic || cqTopic === '__custom')) setCqTopic(s.name)
    }
  }

  function openGenerator() {
    setGenOpen(true)
  }

  async function generateQuiz() {
    let topic: string
    let payloadExtra: Record<string, unknown>
    if (cqSource === 'notes') {
      topic = cqTopic === '__custom' ? cqCustomTopic.trim() : cqTopic
      const n = notes.find((x) => x.title === topic) ?? notes[0]
      payloadExtra = { source: 'notes', note_id: n?.id ?? null, notes_context: (n?.content ?? '').slice(0, 1200) }
    } else if (cqSource === 'weak') {
      topic = cqTopic === '__custom' ? cqCustomTopic.trim() : cqTopic || weakTopics[0]?.name || ''
      payloadExtra = { source: 'weak_topics', focus: 'areas where the student struggles' }
    } else if (cqSource === 'exam') {
      topic = cqTopic === '__custom' ? cqCustomTopic.trim() : cqTopic || nextExam?.title || ''
      payloadExtra = { source: 'exam', exam_title: examMeta?.title ?? null }
    } else {
      topic = cqTopic === '__custom' ? cqCustomTopic.trim() : cqTopic || ''
      payloadExtra = { source: 'subject' }
    }
    if (!topic) { toast.warn('Pick a subject or enter a topic.'); return }

    setGenerating(true)
    try {
      const { data } = await api.post<Quiz>('/quiz/generate/', {
        topic,
        difficulty: cqDifficulty,
        count: cqCount,
        ...payloadExtra,
      })
      if (cqSource !== 'exam') setExamMeta(null)
      beginQuiz(data)
      setGenOpen(false)
      toast.success('Quiz ready \u2014 good luck!')
    } catch (err) { toast.error(getErrorMessage(err)) }
    finally { setGenerating(false) }
  }

  async function startSubjectQuiz(s: Subject) {
    setGenerating(true)
    try {
      const { data } = await api.post<Quiz>('/quiz/generate/', {
        topic: s.name,
        difficulty: 'medium',
        count: 10,
        source: 'subject',
      })
      setExamMeta(null)
      beginQuiz(data)
      toast.success('Quiz ready \u2014 good luck!')
    } catch (err) { toast.error(getErrorMessage(err)) }
    finally { setGenerating(false) }
  }

  /* ── Active quiz flow ── */

  const currentQuestion = activeQuiz?.questions[currentQ] ?? null
  const isLast = !!activeQuiz && currentQ === activeQuiz.questions.length - 1

  function pickAnswer(optIdx: number) {
    if (!currentQuestion || answers[currentQuestion.id] !== undefined) return
    setAnswers((p) => ({ ...p, [currentQuestion.id]: optIdx }))
    setFeedbackQid(currentQuestion.id)
  }

  function toggleHint() {
    if (!currentQuestion) return
    setOpenHint((p) => !p)
    if (!hints[currentQuestion.id]) fetchHint(currentQuestion)
  }

  async function fetchHint(q: Question) {
    setHints((p) => ({ ...p, [q.id]: { text: '', loading: true } }))
    try {
      const { data } = await api.post<{ reply?: string }>('/ai/chat/', {
        message:
          'Give ONE short sentence (max 22 words) that helps me reason toward the answer without revealing or narrowing it to any option. Question: "' +
          q.question +
          '" Options: ' +
          q.options.join(' | ') +
          '. Reply with only the hint sentence.',
        context: { page: '/quiz', mode: 'hint' },
      })
      setHints((p) => ({ ...p, [q.id]: { text: data.reply?.trim() || 'Think about what happens step by step before looking at the options.', loading: false } }))
    } catch {
      setHints((p) => ({ ...p, [q.id]: { text: 'Think about what happens step by step before looking at the options.', loading: false } }))
    }
  }

  async function advanceOrSubmit() {
    if (!activeQuiz) return
    if (!isLast) {
      setCurrentQ((p) => p + 1)
      setFeedbackQid(null)
      setOpenHint(false)
      return
    }
    await submitQuiz()
  }

  async function submitQuiz() {
    if (!activeQuiz) return
    try {
      const finalElapsed = elapsed || Math.floor((currentTs() - startTime) / 1000)
      const { data } = await api.post<QuizResult>('/quiz/' + activeQuiz.id + '/submit/', { answers })
      setElapsed(finalElapsed)
      setQuizResult(data)
      setView('result')
      setShowReview(false)
      void loadData()
      void buildAnalysis(activeQuiz, data)
    } catch (err) { toast.error(getErrorMessage(err)) }
  }

  /* ── AI analysis ── */

  async function buildAnalysis(quiz: Quiz, result: QuizResult) {
    setAnalysis(EMPTY_ANALYSIS)
    const wrongQs = result.results.filter((r) => !r.correct)
    const rightQs = result.results.filter((r) => r.correct)
    try {
      const prompt =
        'You are FLOX AI. Analyze this finished quiz and reply with STRICT JSON only, no prose. ' +
        'Schema: {"strong": string[] (up to 3 concepts mastered), "weak": string[] (up to 3 concepts needing revision), ' +
        '"recommendation": string (one sentence, include a suggested revision length in minutes), ' +
        '"performance": [{"concept": string, "pct": number 0-100}] (up to 5 concept-level bars)}. ' +
        'Quiz topic: ' + quiz.topic + '. Difficulty: ' + quiz.difficulty + '.' +
        ' Questions the student answered CORRECTLY: ' +
        (rightQs.length ? rightQs.map((r) => '"' + quiz.questions.find((q) => q.id === r.id)?.question.slice(0, 80) + '"').join('; ') : 'none') +
        '. Answered WRONG: ' +
        (wrongQs.length ? wrongQs.map((r) => '"' + quiz.questions.find((q) => q.id === r.id)?.question.slice(0, 80) + '"').join('; ') : 'none') +
        '.'
      const { data } = await api.post<{ reply?: string }>('/ai/chat/', {
        message: prompt,
        context: { page: '/quiz', mode: 'analysis' },
      })
      const parsed = normalizeAnalysis(extractJsonObject(data.reply ?? ''))
      if (parsed) setAnalysis(parsed)
    } catch { /* keep empty analysis */ }
  }

  /* ── Result actions ── */

  function tryAgain() {
    if (!activeQuiz) return
    setQuizResult(null)
    setAnalysis(EMPTY_ANALYSIS)
    resetActive()
    setView('active')
  }

  function viewHistoryItem(q: Quiz) {
    setActiveQuiz(q)
    setAnswers({})
    setCurrentQ(0)
    setElapsed(0)
    setQuizResult({
      score: q.score ?? 0,
      total: q.total_questions,
      results: q.questions.map((qq) => ({ id: qq.id, correct: false, explanation: qq.explanation, answer_index: qq.answer_index })),
    })
    setAnalysis(EMPTY_ANALYSIS)
    setShowReview(true)
    setExamMeta(null)
    setView('result')
    if (q.score !== null) {
      void buildAnalysisFromStored(q)
    }
  }

  async function buildAnalysisFromStored(quiz: Quiz) {
    setAnalysis(EMPTY_ANALYSIS)
    try {
      const pct = Math.round(((quiz.score ?? 0) / quiz.total_questions) * 100)
      const { data } = await api.post<{ reply?: string }>('/ai/chat/', {
        message:
          'You are FLOX AI. A student previously scored ' + pct + '% on a quiz about "' + quiz.topic +
          '". Reply with STRICT JSON only: {"strong": string[], "weak": string[], "recommendation": string, "performance": [{"concept": string, "pct": number}]}.',
        context: { page: '/quiz', mode: 'analysis' },
      })
      const parsed = normalizeAnalysis(extractJsonObject(data.reply ?? ''))
      if (parsed) setAnalysis(parsed)
    } catch { /* keep empty analysis */ }
  }

  function exitQuiz() {
    setView('dashboard')
    setActiveQuiz(null)
    setQuizResult(null)
    setFeedbackQid(null)
    setShowReview(false)
    setExamMeta(null)
  }


  /* ── Render pieces ── */

  const displayQuiz = activeQuiz
  const resultPct = quizResult ? Math.round((quizResult.score / quizResult.total) * 100) : 0
  const readinessAfter = examMeta && quizResult ? Math.min(100, examMeta.before + Math.round(resultPct / 10)) : 0

  const activeView = activeQuiz && currentQuestion && (
    <div className="zq-take">
      <div className="zt-progress">
        <i style={{ width: Math.round(((currentQ + 1) / activeQuiz.questions.length) * 100) + '%' }} />
      </div>

      <header className="zt-top">
        <button className="zt-exit" onClick={exitQuiz} type="button">{'\u2190'} Exit</button>
        <div className="zt-top-center">
          <span className="zt-title">{activeQuiz.topic}</span>
          <span className="zt-count">Question {currentQ + 1} of {activeQuiz.questions.length}</span>
        </div>
        <div className="zt-timer-pill">{fmtTime(elapsed)}</div>
      </header>

      <main className="zt-body" key={currentQuestion.id}>
        <h2 className="zt-question">{currentQuestion.question}</h2>

        <div className="zt-options">
          {currentQuestion.options.map((opt, idx) => {
            const answered = answers[currentQuestion.id] !== undefined
            const picked = answers[currentQuestion.id] === idx
            const isRight = idx === currentQuestion.answer_index
            let cls = 'zt-opt'
            if (picked) cls += ' picked'
            if (answered && isRight) cls += ' right'
            if (answered && picked && !isRight) cls += ' wrongpick'
            return (
              <button key={idx} className={cls} disabled={answered} onClick={() => pickAnswer(idx)} type="button">
                <span className="zt-letter">{String.fromCharCode(65 + idx)}</span>
                <span className="zt-opt-text">{opt}</span>
                {answered && isRight && <span className="zt-mark ok">{'\u2713'}</span>}
                {answered && picked && !isRight && <span className="zt-mark no">{'\u2717'}</span>}
              </button>
            )
          })}
        </div>

        <div className="zt-bottom-row">
          <button className="zt-hintbtn" onClick={toggleHint} type="button">
            {'\uD83D\uDCA1'} {openHint ? 'Hide Hint' : 'Hint'}
          </button>
          <button
            className="zt-nextbtn"
            disabled={answers[currentQuestion.id] === undefined}
            onClick={() => void advanceOrSubmit()}
            type="button"
          >
            {isLast ? 'See Results \u2192' : 'Next Question \u2192'}
          </button>
        </div>

        {openHint && (
          <div className="zt-hintbox">
            {hints[currentQuestion.id]?.loading ? (
              <div className="ac-typing"><span /><span /><span /></div>
            ) : (
              hints[currentQuestion.id]?.text ?? 'Think it through step by step.'
            )}
          </div>
        )}

        {feedbackQid === currentQuestion.id && answers[currentQuestion.id] !== undefined && (
          (() => {
            const chosenIdx = answers[currentQuestion.id]
            const good = chosenIdx === currentQuestion.answer_index
            return (
              <div className={'zt-feedback ' + (good ? 'good' : 'bad')}>
                <div className="zt-fb-header">
                  <span className="zt-fb-icon">{good ? '\u2713' : '\u2717'}</span>
                  <strong>{good ? 'Correct!' : 'Not quite.'}</strong>
                </div>
                <p className="zt-fb-explain">{currentQuestion.explanation}</p>
                <div className="zt-fb-boxes">
                  <div className="zt-fb-box">
                    <span>Your Answer</span>
                    <b>{currentQuestion.options[chosenIdx]}</b>
                  </div>
                  {!good && (
                    <div className="zt-fb-box right">
                      <span>Correct Answer</span>
                      <b>{currentQuestion.options[currentQuestion.answer_index]}</b>
                    </div>
                  )}
                </div>
              </div>
            )
          })()
        )}
      </main>
    </div>
  )

  const resultView = view === 'result' && displayQuiz && quizResult && (
    <div className="zr-wrap">
      <div className="zr-hero">
        <div className="zr-ring" style={{ '--pct': resultPct + '%' } as React.CSSProperties}>
          <svg viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="52" className="zr-ring-bg" />
            <circle cx="60" cy="60" r="52" className="zr-ring-fill" stroke={accColor(resultPct)} style={{ strokeDashoffset: 326.7 - (326.7 * resultPct) / 100 }} />
          </svg>
          <div className="zr-ring-text">
            <span className="zr-pct" style={{ color: accColor(resultPct) }}>{resultPct}%</span>
            <span className="zr-frac">{quizResult.score}/{quizResult.total}</span>
          </div>
        </div>
        <h2>Quiz Complete</h2>
        <div className="zr-statgrid">
          <div className="zr-stat"><b className="ok">{quizResult.score}</b><span>Correct</span></div>
          <div className="zr-stat"><b className="no">{quizResult.total - quizResult.score}</b><span>Wrong</span></div>
          <div className="zr-stat"><b>{fmtTime(elapsed)}</b><span>Time</span></div>
        </div>
      </div>

      {analysis.performance.length > 0 && (
        <section className="zr-section">
          <span className="zr-section-label">PERFORMANCE</span>
          {analysis.performance.map((p) => (
            <div key={p.concept} className="zp-row">
              <span className="zp-name">{p.concept}</span>
              <div className="zp-bar"><i style={{ width: p.pct + '%', background: accColor(p.pct) }} /></div>
              <span className="zp-pct">{p.pct}%</span>
            </div>
          ))}
        </section>
      )}

      {examMeta && (
        <div className="zr-section">
          <span className="zr-section-label">EXAM READINESS {'\u00B7'} {examMeta.title}</span>
          <div className="zr-readiness-row">
            <span>Before: <b>{examMeta.before}%</b></span>
            <span className="zr-readiness-arrow">{'\u2192'}</span>
            <span>After: <b className="ok">{readinessAfter}%</b></span>
          </div>
        </div>
      )}

      <div className="zr-actions">
        <button className="zr-action-btn outline" onClick={() => setShowReview((p) => !p)} type="button">
          {showReview ? 'Hide Answers' : 'Review Answers'}
        </button>
        <button className="zr-action-btn" onClick={tryAgain} type="button">Try Again</button>
        <button className="zr-action-btn outline" onClick={exitQuiz} type="button">Done</button>
      </div>

      {showReview && (
        <div className="zr-review">
          {displayQuiz.questions.map((qq, i) => {
            const ans = quizResult.results.find((r) => r.id === qq.id)
            const isCorrect = ans ? ans.correct : false
            return (
              <div key={qq.id} className={'zr-item' + (isCorrect ? ' ok' : ' no')}>
                <div className="zri-head">
                  <span className="zri-num">{i + 1}</span>
                  <span className={'zri-badge ' + (isCorrect ? 'ok' : 'no')}>{isCorrect ? '\u2713' : '\u2717'}</span>
                  <p className="zri-q">{qq.question}</p>
                </div>
                <div className="zri-opts">
                  {qq.options.map((opt, oi) => {
                    const isAnswer = oi === qq.answer_index
                    const wasPicked = ans?.selected === oi
                    return (
                      <span key={oi} className={'zri-opt' + (isAnswer ? ' answer' : '') + (wasPicked && !isAnswer ? ' pickedwrong' : '')}>
                        {String.fromCharCode(65 + oi)}{'\u2002'}{opt}
                      </span>
                    )
                  })}
                </div>
                {qq.explanation && <p className="zri-explain">{qq.explanation}</p>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )


  const dashboardView = (
    <>
      <div className="zq-stats-row">
        <div className="zq-stat-card"><span className="zq-stat-icon">{'\uD83D\uDCDD'}</span><b>{stats.quizzes}</b><span className="zq-stat-label">Quizzes</span></div>
        <div className="zq-stat-card"><span className="zq-stat-icon">{'\uD83C\uDFAF'}</span><b>{stats.accuracy}%</b><span className="zq-stat-label">Accuracy</span></div>
        <div className="zq-stat-card"><span className="zq-stat-icon">{'\u2713'}</span><b>{stats.completedCount}</b><span className="zq-stat-label">Completed</span></div>
        <div className="zq-stat-card"><span className="zq-stat-icon">{'\uD83D\uDD25'}</span><b>{stats.streak}</b><span className="zq-stat-label">Streak</span></div>
      </div>

      <section>
        <h2 className="zq-section-title">YOUR SUBJECTS</h2>
        {subjects.length > 0 ? (
          <div className="qz-subjects-grid">
            {subjects.map((s, i) => {
              const st = subjectStats.get(s.id)
              return (
                <article key={s.id} className="qz-subject-card">
                  <div className="qz-sc-left">
                    <span className="qz-sc-icon">{SUBJECT_ICONS[i % SUBJECT_ICONS.length]}</span>
                    <div>
                      <strong className="qz-sc-name">{s.name}</strong>
                      <div className="qz-sc-meta">
                        <span><b>{st?.quizzes ?? 0}</b> quizzes</span>
                        <span className="qz-sc-dot" />
                        <span><b style={{ color: accColor(st?.accuracy ?? 0) }}>{st?.accuracy ?? 0}%</b> avg</span>
                      </div>
                    </div>
                  </div>
                  <button className="qz-sc-btn" disabled={generating} onClick={() => void startSubjectQuiz(s)} type="button">
                    {'\u25B6'} Quiz
                  </button>
                </article>
              )
            })}
          </div>
        ) : (
          <p className="zq-empty-text">Add subjects first to unlock quick quizzes.</p>
        )}
      </section>

      <section>
        <h2 className="zq-section-title">RECENT QUIZZES</h2>
        {recentQuizzes.length > 0 ? (
          <div className="zq-history-list">
            {recentQuizzes.map((qq) => {
              const pct = qq.score !== null ? Math.round((qq.score / qq.total_questions) * 100) : null
              return (
                <button key={qq.id} className="zh-row" onClick={() => viewHistoryItem(qq)} type="button">
                  <div className="zh-info">
                    <span className="zh-topic">{qq.topic}</span>
                    <span className="zh-date">{friendlyDate(qq.created_at)}</span>
                  </div>
                  <div className="zh-right">
                    <span className="zh-pct" style={{ color: pct !== null ? accColor(pct) : undefined }}>{pct !== null ? pct + '%' : '\u2014'}</span>
                    <span className="zh-score">{qq.score !== null ? qq.score + '/' + qq.total_questions : ''}</span>
                  </div>
                </button>
              )
            })}
          </div>
        ) : (
          <p className="zq-empty-text">No quizzes taken yet. Generate one above!</p>
        )}
      </section>
    </>
  )

  /* ── Render ── */

  if (loading) {
    return (
      <PageShell title="Loading..." subtitle="Fetching quiz data.">
        <div className="page-card">Loading...</div>
      </PageShell>
    )
  }

  return (
    <PageShell
      className={'zq-page' + (view === 'active' ? ' taking' : '')}
      title="Quiz"
      subtitle="Test your knowledge and discover what to improve."
      actions={
        view === 'dashboard' ? (
          <button className="zq-create-btn" onClick={openGenerator} type="button">{'\uFF0B'} Create Quiz</button>
        ) : null
      }
    >
      {view === 'dashboard' && dashboardView}
      {view === 'active' && activeView}
      {view === 'result' && resultView}

      {genOpen && (
        <div className="qz-modal-backdrop" onClick={() => setGenOpen(false)}>
          <div className="qz-modal" onClick={(e) => e.stopPropagation()}>
            <div className="qz-modal-head">
              <div>
                <span className="qz-gen-kicker">{'\u2726'} AI QUIZ GENERATOR</span>
                <h3>Create a Quiz</h3>
                <p>Pick a subject or topic, choose your settings, and let AI test your knowledge.</p>
              </div>
              <button className="qz-modal-close" onClick={() => setGenOpen(false)} type="button">&#10005;</button>
            </div>

            <div className="qz-modal-body">
              <div className="qz-gen-grid">
                <label className="qz-field">
                  <span>Subject</span>
                  <select value={cqSubject} onChange={(e) => pickSubject(e.target.value)}>
                    <option value="">No subject</option>
                    {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </label>

                <label className="qz-field">
                  <span>Topic</span>
                  <select value={cqTopic} onChange={(e) => setCqTopic(e.target.value)}>
                    {topicOptions.map((t) => <option key={t} value={t}>{t}</option>)}
                    <option value="__custom">Custom topic...</option>
                  </select>
                </label>

                <label className="qz-field">
                  <span>Questions</span>
                  <select value={cqCount} onChange={(e) => setCqCount(Number(e.target.value))}>
                    {QUESTION_COUNTS.map((c) => <option key={c} value={c}>{c} Questions</option>)}
                  </select>
                </label>

                <label className="qz-field">
                  <span>Difficulty</span>
                  <select value={cqDifficulty} onChange={(e) => setCqDifficulty(e.target.value)}>
                    {DIFFICULTIES.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
                  </select>
                </label>
              </div>

              {cqTopic === '__custom' && (
                <input
                  className="qz-custom-input"
                  placeholder="e.g. Constructors & Destructors"
                  value={cqCustomTopic}
                  onChange={(e) => setCqCustomTopic(e.target.value)}
                />
              )}

              <div className="qz-source-row">
                <span className="qz-source-label">Source</span>
                {SOURCES.map((src) => (
                  <button
                    key={src.key}
                    className={'qz-source' + (cqSource === src.key ? ' on' : '')}
                    onClick={() => handleSource(src.key)}
                    type="button"
                  >
                    <i className="qz-radio" />{src.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="qz-modal-foot">
              <button className="qz-cancel-btn" onClick={() => setGenOpen(false)} type="button">Cancel</button>
              <button className="qz-generate-btn" disabled={generating} onClick={() => void generateQuiz()} type="button">
                {generating ? 'Generating...' : 'Generate Quiz \u2192'}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  )
}
