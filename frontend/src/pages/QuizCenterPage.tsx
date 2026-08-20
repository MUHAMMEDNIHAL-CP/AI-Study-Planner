import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import PageShell from '../components/PageShell'
import { api, getErrorMessage } from '../lib/api'

type Question = { id: number; question: string; options: string[]; answer_index: number; explanation: string }
type Quiz = { id: number; topic: string; difficulty: string; questions: Question[]; score: number | null; total_questions: number; created_at: string }
type QuizResult = { score: number; total: number; results: { id: number; correct: boolean; explanation: string; answer_index: number; selected?: number }[] }
type Subject = { id: number; name: string; color: string; weak_topics: string; total_topics: number; topics_completed: number }
type Exam = { id: number; subject: number | null; subject_name?: string; title: string; date: string }

type QuizView = 'dashboard' | 'active' | 'result'

const DIFFICULTIES = [
  { key: 'easy', label: 'Easy', color: '#36d479' },
  { key: 'medium', label: 'Medium', color: '#ffb84d' },
  { key: 'hard', label: 'Hard', color: '#ff6b6b' },
]

const QUESTION_COUNTS = [5, 10, 15, 20]

function fmtTime(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m + 'm ' + (s < 10 ? '0' : '') + s + 's'
}

function timeAgo(date: string) {
  const mins = Math.floor((Date.now() - new Date(date).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return mins + 'm ago'
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return hrs + 'h ago'
  const days = Math.floor(hrs / 24)
  if (days === 1) return 'Yesterday'
  if (days < 7) return days + 'd ago'
  return new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export default function QuizCenterPage() {
  const [view, setView] = useState<QuizView>('dashboard')
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [exams, setExams] = useState<Exam[]>([])
  const [history, setHistory] = useState<Quiz[]>([])
  const [loading, setLoading] = useState(true)

  const [quizSubject, setQuizSubject] = useState('')
  const [quizTopic, setQuizTopic] = useState('')
  const [quizDifficulty, setQuizDifficulty] = useState('medium')
  const [quizCount, setQuizCount] = useState(10)
  const [generating, setGenerating] = useState(false)

  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null)
  const [currentQ, setCurrentQ] = useState(0)
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [submitted, setSubmitted] = useState(false)
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null)
  const [quizStartTime, setQuizStartTime] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [showFeedback, setShowFeedback] = useState<{ correct: boolean; explanation: string } | null>(null)

  const [aiAnalysis, setAiAnalysis] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [viewHistoryId, setViewHistoryId] = useState<number | null>(null)
  const [viewHistoryQuiz, setViewHistoryQuiz] = useState<Quiz | null>(null)

  const loadData = useCallback(async () => {
    try {
      const [subRes, examRes, histRes] = await Promise.all([
        api.get<Subject[]>('/study/subjects/'),
        api.get<Exam[]>('/study/exams/'),
        api.get<Quiz[]>('/quiz/history/').catch(() => ({ data: [] as Quiz[] })),
      ])
      setSubjects(subRes.data)
      setExams(examRes.data)
      setHistory(histRes.data)
    } catch (err) { toast.error(getErrorMessage(err)) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void loadData() }, [loadData])

  useEffect(() => {
    if (view !== 'active' || submitted) return
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - quizStartTime) / 1000)), 1000)
    return () => clearInterval(timer)
  }, [view, submitted, quizStartTime])

  const stats = useMemo(() => {
    const completed = history.filter((q) => q.score !== null)
    const total = completed.length
    const avgScore = total > 0 ? Math.round(completed.reduce((sum, q) => sum + ((q.score ?? 0) / q.total_questions) * 100, 0) / total) : 0
    const totalCorrect = completed.reduce((sum, q) => sum + (q.score ?? 0), 0)
    const totalQuestions = completed.reduce((sum, q) => sum + q.total_questions, 0)
    const accuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0
    return { total, avgScore, accuracy, completed: total }
  }, [history])

  const weakTopics = useMemo(() => {
    const topicScores = new Map<string, { correct: number; total: number }>()
    for (const q of history) {
      if (q.score === null) continue
      const existing = topicScores.get(q.topic) || { correct: 0, total: 0 }
      existing.correct += q.score
      existing.total += q.total_questions
      topicScores.set(q.topic, existing)
    }
    const topics: { name: string; accuracy: number; color: string }[] = []
    topicScores.forEach((data, name) => {
      const acc = Math.round((data.correct / data.total) * 100)
      topics.push({ name, accuracy: acc, color: acc >= 80 ? '#36d479' : acc >= 60 ? '#ffb84d' : '#ff6b6b' })
    })
    return topics.sort((a, b) => a.accuracy - b.accuracy).slice(0, 5)
  }, [history])

  const recentQuizzes = useMemo(() => {
    return viewHistoryId !== null ? history.filter((q) => q.id === viewHistoryId) : []
  }, [history, viewHistoryId])

  async function generateQuiz() {
    const topic = quizTopic.trim() || subjects.find((s) => s.id === Number(quizSubject))?.name || ''
    if (!topic) { toast.warn('Select a subject or enter a topic.'); return }
    setGenerating(true)
    try {
      const { data } = await api.post<Quiz>('/quiz/generate/', {
        topic, difficulty: quizDifficulty, count: quizCount,
      })
      setActiveQuiz(data)
      setCurrentQ(0)
      setAnswers({})
      setSubmitted(false)
      setQuizResult(null)
      setQuizStartTime(Date.now())
      setElapsed(0)
      setShowFeedback(null)
      setView('active')
      setViewHistoryId(null)
      setViewHistoryQuiz(null)
      toast.success('Quiz generated!')
    } catch (err) { toast.error(getErrorMessage(err)) }
    finally { setGenerating(false) }
  }

  async function submitQuiz() {
    if (!activeQuiz) return
    const unanswered = activeQuiz.questions.length - Object.keys(answers).length
    if (unanswered > 0) { toast.warn('Answer all questions before submitting.'); return }
    try {
      const { data } = await api.post<QuizResult>('/quiz/' + activeQuiz.id + '/submit/', { answers })
      setQuizResult(data)
      setSubmitted(true)
      setView('result')
      setElapsed(Math.floor((Date.now() - quizStartTime) / 1000))
      await loadData()
      void generateAiAnalysis(activeQuiz.topic, data)
    } catch (err) { toast.error(getErrorMessage(err)) }
  }

  async function generateAiAnalysis(topic: string, result: QuizResult) {
    setAiLoading(true)
    setAiAnalysis('')
    try {
      const { data } = await api.post('/ai/chat/', {
        message: `Analyze quiz results for "${topic}". Score: ${result.score}/${result.total} (${Math.round((result.score / result.total) * 100)}%). Correct: ${result.results.filter((r) => r.correct).map((r) => r.id).join(',')}. Wrong: ${result.results.filter((r) => !r.correct).map((r) => r.id).join(',')}. Give a brief analysis with strong areas, weak areas, and a specific revision recommendation.`,
        context: { page: '/quiz', mode: 'analysis' },
      })
      setAiAnalysis(data.reply || 'No analysis available.')
    } catch { setAiAnalysis('AI analysis is temporarily unavailable.') }
    finally { setAiLoading(false) }
  }

  function answerQuestion(qId: number, optIdx: number) {
    if (submitted) return
    setAnswers((p) => ({ ...p, [qId]: optIdx }))
  }

  function nextQuestion() {
    if (!activeQuiz) return
    if (currentQ < activeQuiz.questions.length - 1) setCurrentQ((p) => p + 1)
  }

  function prevQuestion() {
    if (currentQ > 0) setCurrentQ((p) => p - 1)
  }

  function reviewAnswer(qId: number, selected: number | undefined, answerIndex: number) {
    setShowFeedback({
      correct: selected === answerIndex,
      explanation: activeQuiz?.questions.find((q) => q.id === qId)?.explanation || viewHistoryQuiz?.questions.find((q) => q.id === qId)?.explanation || '',
    })
  }

  function viewHistoryItem(quiz: Quiz) {
    setViewHistoryId(quiz.id)
    setViewHistoryQuiz(quiz)
    setActiveQuiz(quiz)
    setAnswers({})
    setCurrentQ(0)
    setSubmitted(true)
    setView('result')
    setQuizResult(quiz.score !== null ? { score: quiz.score, total: quiz.total_questions, results: quiz.questions.map((q) => ({ id: q.id, correct: false, explanation: q.explanation, answer_index: q.answer_index })) } : null)
  }

  function startQuizFromSubject(subject: Subject) {
    setQuizSubject(String(subject.id))
    setQuizTopic(subject.weak_topics || subject.name)
    setView('dashboard')
  }

  function resetToDashboard() {
    setView('dashboard')
    setActiveQuiz(null)
    setQuizResult(null)
    setSubmitted(false)
    setCurrentQ(0)
    setAnswers({})
    setViewHistoryId(null)
    setViewHistoryQuiz(null)
    setShowFeedback(null)
  }

  if (loading) {
    return <PageShell eyebrow="Quiz" title="Loading..." subtitle="Fetching quiz data."><div className="page-card">Loading...</div></PageShell>
  }

  const displayQuiz = viewHistoryQuiz || activeQuiz
  const currentQuestion = displayQuiz?.questions[currentQ]
  const progressPct = displayQuiz ? Math.round(((currentQ + 1) / displayQuiz.questions.length) * 100) : 0
  const answeredCount = Object.keys(answers).length

  return (
    <PageShell
      className="zq-page"
      eyebrow="Quiz"
      title="Quiz"
      subtitle="Test your knowledge and find your weak areas."
      actions={
        view === 'dashboard' ? (
          <button className="zq-create-btn" onClick={() => { setView('dashboard'); setQuizTopic('') }} type="button">+ Create Quiz</button>
        ) : view === 'active' ? (
          <div className="zq-active-nav">
            <button className="zq-back-btn" onClick={resetToDashboard} type="button">{'\u2190'} Back</button>
            <span className="zq-progress-label">{currentQ + 1} / {displayQuiz?.questions.length}</span>
          </div>
        ) : (
          <button className="zq-back-btn" onClick={resetToDashboard} type="button">{'\u2190'} All Quizzes</button>
        )
      }
    >
      {/* ═══════════ DASHBOARD ═══════════ */}
      {view === 'dashboard' && (
        <>
          {/* Stats */}
          <div className="zq-stats-row">
            <div className="zq-stat-card">
              <span className="zq-stat-num">{stats.total}</span>
              <span className="zq-stat-label">Quizzes</span>
            </div>
            <div className="zq-stat-card">
              <span className="zq-stat-num">{stats.accuracy}%</span>
              <span className="zq-stat-label">Accuracy</span>
            </div>
            <div className="zq-stat-card">
              <span className="zq-stat-num">{stats.completed}</span>
              <span className="zq-stat-label">Completed</span>
            </div>
            <div className="zq-stat-card">
              <span className="zq-stat-num">{stats.avgScore}%</span>
              <span className="zq-stat-label">Avg Score</span>
            </div>
          </div>

          {/* Generator */}
          <div className="zq-generator">
            <h2 className="zq-section-title">Create Quiz</h2>
            <div className="zq-gen-grid">
              <div className="zq-gen-field">
                <label>Subject</label>
                <select value={quizSubject} onChange={(e) => {
                  setQuizSubject(e.target.value)
                  const s = subjects.find((s) => s.id === Number(e.target.value))
                  if (s) setQuizTopic(s.weak_topics || s.name)
                }}>
                  <option value="">Custom topic</option>
                  {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="zq-gen-field">
                <label>Topic</label>
                <input placeholder="e.g. Constructors & Destructors" value={quizTopic} onChange={(e) => setQuizTopic(e.target.value)} />
              </div>
              <div className="zq-gen-field">
                <label>Difficulty</label>
                <div className="zq-diff-row">
                  {DIFFICULTIES.map((d) => (
                    <button key={d.key} className={'zq-diff-chip' + (quizDifficulty === d.key ? ' active' : '')} style={quizDifficulty === d.key ? { borderColor: d.color, color: d.color, background: d.color + '12' } : undefined} onClick={() => setQuizDifficulty(d.key)} type="button">{d.label}</button>
                  ))}
                </div>
              </div>
              <div className="zq-gen-field">
                <label>Questions</label>
                <div className="zq-count-row">
                  {QUESTION_COUNTS.map((c) => (
                    <button key={c} className={'zq-count-chip' + (quizCount === c ? ' active' : '')} onClick={() => setQuizCount(c)} type="button">{c}</button>
                  ))}
                </div>
              </div>
            </div>
            <button className="zq-generate-btn" disabled={generating} onClick={() => void generateQuiz()} type="button">
              {generating ? 'Generating...' : 'Generate Quiz'}
            </button>
          </div>

          <div className="zq-two-col">
            {/* Quick Start */}
            <div className="zq-quick-start">
              <h2 className="zq-section-title">Start a Quiz</h2>
              <div className="zq-subject-grid">
                {subjects.length > 0 ? subjects.map((s) => (
                  <button key={s.id} className="zq-subject-card" onClick={() => startQuizFromSubject(s)} type="button">
                    <span className="zq-subject-dot" style={{ background: s.color }} />
                    <strong>{s.name}</strong>
                    <span className="zq-subject-meta">{s.topics_completed}/{s.total_topics} topics</span>
                    <span className="zq-subject-start">Start {'\u2192'}</span>
                  </button>
                )) : (
                  <p className="zq-empty-text">Add subjects first to get quick-start quizzes.</p>
                )}
              </div>
            </div>

            {/* Weak Topics */}
            <div className="zq-weak-section">
              <h2 className="zq-section-title">Weak Topics</h2>
              {weakTopics.length > 0 ? (
                <div className="zq-weak-list">
                  {weakTopics.map((t) => (
                    <div key={t.name} className="zq-weak-item">
                      <div className="zq-weak-info">
                        <span className="zq-weak-name">{t.name}</span>
                        <span className="zq-weak-acc" style={{ color: t.color }}>{t.accuracy}%</span>
                      </div>
                      <div className="zq-weak-bar">
                        <div className="zq-weak-fill" style={{ width: t.accuracy + '%', background: t.color }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="zq-empty-text">Complete some quizzes to see weak topic analysis.</p>
              )}
            </div>
          </div>

          {/* Exam Practice */}
          {exams.length > 0 && (
            <div className="zq-exam-section">
              <h2 className="zq-section-title">Exam Practice</h2>
              <div className="zq-exam-grid">
                {exams.filter((e) => new Date(e.date) >= new Date()).slice(0, 3).map((e) => {
                  const daysLeft = Math.ceil((new Date(e.date).getTime() - Date.now()) / 86400000)
                  return (
                    <div key={e.id} className="zq-exam-card">
                      <strong>{e.title}</strong>
                      <span className="zq-exam-date">{e.date} ({daysLeft} days)</span>
                      <button className="zq-exam-practice-btn" onClick={() => { setQuizTopic(e.title); setQuizSubject(e.subject ? String(e.subject) : ''); setQuizDifficulty('hard'); setQuizCount(15); }} type="button">Practice Quiz</button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* History */}
          <div className="zq-history-section">
            <h2 className="zq-section-title">Recent Quizzes</h2>
            {history.length > 0 ? (
              <div className="zq-history-list">
                {history.slice(0, 10).map((q) => {
                  const pct = q.score !== null ? Math.round((q.score / q.total_questions) * 100) : 0
                  return (
                    <button key={q.id} className="zq-history-item" onClick={() => viewHistoryItem(q)} type="button">
                      <div className="zq-history-info">
                        <strong>{q.topic}</strong>
                        <span>{q.difficulty} {'\u00b7'} {q.total_questions}Q</span>
                      </div>
                      <div className="zq-history-score" style={{ color: pct >= 80 ? '#36d479' : pct >= 60 ? '#ffb84d' : '#ff6b6b' }}>
                        {q.score !== null ? pct + '%' : 'In Progress'}
                      </div>
                      <span className="zq-history-time">{timeAgo(q.created_at)}</span>
                    </button>
                  )
                })}
              </div>
            ) : (
              <p className="zq-empty-text">No quizzes taken yet. Generate one above!</p>
            )}
          </div>
        </>
      )}

      {/* ═══════════ ACTIVE QUIZ ═══════════ */}
      {view === 'active' && displayQuiz && currentQuestion && (
        <div className="zq-quiz-active">
          <div className="zq-quiz-bar">
            <div className="zq-bar-track">
              <div className="zq-bar-fill" style={{ width: progressPct + '%' }} />
            </div>
            <span className="zq-bar-label">{currentQ + 1} / {displayQuiz.questions.length}</span>
          </div>

          <div className="zq-question-card">
            <h2 className="zq-q-text">{currentQuestion.question}</h2>
            <div className="zq-options">
              {currentQuestion.options.map((opt, idx) => {
                const isSelected = answers[currentQuestion.id] === idx
                return (
                  <button key={idx} className={'zq-option' + (isSelected ? ' selected' : '')} onClick={() => answerQuestion(currentQuestion.id, idx)} type="button">
                    <span className="zq-option-letter">{String.fromCharCode(65 + idx)}</span>
                    <span className="zq-option-text">{opt}</span>
                  </button>
                )
              })}
            </div>

            {showFeedback && (
              <div className={'zq-feedback ' + (showFeedback.correct ? 'correct' : 'wrong')}>
                <strong>{showFeedback.correct ? '\u2713 Correct!' : '\u2717 Not quite.'}</strong>
                <p>{showFeedback.explanation}</p>
                <button className="zq-feedback-close" onClick={() => setShowFeedback(null)} type="button">Continue</button>
              </div>
            )}
          </div>

          <div className="zq-quiz-nav">
            <button className="zq-nav-btn" onClick={prevQuestion} disabled={currentQ === 0} type="button">{'\u2190'} Prev</button>
            {currentQ === displayQuiz.questions.length - 1 ? (
              <button className="zq-submit-btn" onClick={() => void submitQuiz()} type="button">Submit Quiz</button>
            ) : (
              <button className="zq-nav-btn primary" onClick={nextQuestion} type="button">Next {'\u2192'}</button>
            )}
          </div>

          <div className="zq-q-dots">
            {displayQuiz.questions.map((q, i) => (
              <span key={q.id} className={'zq-dot' + (i === currentQ ? ' current' : '') + (answers[q.id] !== undefined ? ' answered' : '')} onClick={() => setCurrentQ(i)} />
            ))}
          </div>

          <div className="zq-side-info">
            <div className="zq-side-card">
              <span>Topic</span>
              <strong>{displayQuiz.topic}</strong>
            </div>
            <div className="zq-side-card">
              <span>Difficulty</span>
              <strong style={{ color: DIFFICULTIES.find((d) => d.key === displayQuiz.difficulty)?.color }}>{displayQuiz.difficulty}</strong>
            </div>
            <div className="zq-side-card">
              <span>Time</span>
              <strong>{fmtTime(elapsed)}</strong>
            </div>
            <div className="zq-side-card">
              <span>Answered</span>
              <strong>{answeredCount}/{displayQuiz.questions.length}</strong>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ RESULT ═══════════ */}
      {view === 'result' && displayQuiz && quizResult && (
        <div className="zq-result">
          <div className="zq-result-hero">
            <span className="zq-result-emoji">{'\uD83C\uDF89'}</span>
            <h2>Quiz Complete</h2>
            <div className="zq-result-score">
              <span className="zq-result-pct">{Math.round((quizResult.score / quizResult.total) * 100)}%</span>
              <span className="zq-result-fraction">{quizResult.score} / {quizResult.total}</span>
            </div>
            <div className="zq-result-meta">
              <div><span>Correct</span><strong>{quizResult.score}</strong></div>
              <div><span>Incorrect</span><strong>{quizResult.total - quizResult.score}</strong></div>
              <div><span>Time</span><strong>{fmtTime(elapsed)}</strong></div>
            </div>
            <div className="zq-result-bar-wrap">
              <div className="zq-result-bar">
                <div className="zq-result-fill" style={{ width: Math.round((quizResult.score / quizResult.total) * 100) + '%' }} />
              </div>
              <span className="zq-result-bar-pct">{Math.round((quizResult.score / quizResult.total) * 100)}%</span>
            </div>
          </div>

          {/* AI Analysis */}
          <div className="zq-ai-analysis">
            <h3>{'\u2726'} Flox AI Analysis</h3>
            {aiLoading ? (
              <div className="zq-ai-loading"><div className="ac-typing"><span /><span /><span /></div></div>
            ) : aiAnalysis ? (
              <p>{aiAnalysis}</p>
            ) : (
              <p>Generating analysis...</p>
            )}
          </div>

          {/* Answer Review */}
          <div className="zq-review">
            <h2 className="zq-section-title">Review Answers</h2>
            {displayQuiz.questions.map((q, i) => {
              const ans = quizResult.results.find((r) => r.id === q.id)
              const isCorrect = ans?.correct
              return (
                <div key={q.id} className={'zq-review-item' + (isCorrect ? ' correct' : ' wrong')}>
                  <div className="zq-review-head">
                    <span className="zq-review-num">{i + 1}</span>
                    <span className={'zq-review-badge ' + (isCorrect ? 'correct' : 'wrong')}>{isCorrect ? '\u2713' : '\u2717'}</span>
                  </div>
                  <p className="zq-review-q">{q.question}</p>
                  <div className="zq-review-opts">
                    {q.options.map((opt, oi) => {
                      const isAnswer = oi === q.answer_index
                      const wasSelected = ans?.selected === oi
                      return (
                        <span key={oi} className={'zq-review-opt' + (isAnswer ? ' answer' : '') + (wasSelected && !isAnswer ? ' selected-wrong' : '')}>
                          {String.fromCharCode(65 + oi)} {opt}
                        </span>
                      )
                    })}
                  </div>
                  {q.explanation && <p className="zq-review-explain">{q.explanation}</p>}
                </div>
              )
            })}
          </div>

          <div className="zq-result-actions">
            <button className="zq-back-btn" onClick={resetToDashboard} type="button">Back to Quiz</button>
          </div>
        </div>
      )}

      {/* Feedback overlay */}
      {showFeedback && (
        <div className="zq-feedback-overlay" onClick={() => setShowFeedback(null)}>
          <div className={'zq-feedback-modal ' + (showFeedback.correct ? 'correct' : 'wrong')} onClick={(e) => e.stopPropagation()}>
            <strong>{showFeedback.correct ? '\u2713 Correct!' : '\u2717 Not quite.'}</strong>
            <p>{showFeedback.explanation}</p>
            <button onClick={() => setShowFeedback(null)} type="button">Continue</button>
          </div>
        </div>
      )}
    </PageShell>
  )
}
