import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { toast } from 'react-toastify'
import { api, getErrorMessage } from '../lib/api'
import AppHeader from '../components/AppHeader'

type Question = { id: number; question: string; options: string[]; answer_index: number; explanation: string }
type Quiz = {
  id: number
  provider?: string
  topic: string
  difficulty: string
  questions: Question[]
  total_questions: number
}
type QuizResult = {
  score: number
  total: number
  results: { id: number; correct: boolean; explanation: string; answer_index: number; selected?: number }[]
}

type Subject = {
  id: number
  name: string
  weak_topics: string
  weekly_goal_hours: number
}

export default function QuizCenterPage() {
  const [topic, setTopic] = useState('Neural Networks')
  const [difficulty, setDifficulty] = useState('medium')
  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [result, setResult] = useState<QuizResult | null>(null)
  const [provider, setProvider] = useState('checking')
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [selectedSubjectId, setSelectedSubjectId] = useState('')
  const [loading, setLoading] = useState(false)
  const answeredCount = Object.keys(answers).length
  const liveScore = useMemo(
    () => quiz?.questions.filter((question) => answers[question.id] === question.answer_index).length ?? 0,
    [answers, quiz],
  )
  const progress = quiz ? Math.round((answeredCount / quiz.questions.length) * 100) : 0
  const accuracy = quiz
    ? result
      ? Math.round((result.score / result.total) * 100)
      : answeredCount
        ? Math.round((liveScore / answeredCount) * 100)
        : 0
    : 0
  const quizTip = useMemo(() => {
    if (!quiz) return 'Generate a quiz from one of your Study Planner subjects. Start with weak topics for the biggest memory gain.'
    if (!answeredCount) return 'Answer from memory first. Do not reread notes until after you commit to an option.'
    if (result) {
      return accuracy >= 80
        ? 'Strong recall. Now raise the difficulty or generate a new quiz on a related weak topic.'
        : 'Review every explanation you missed, then regenerate an easier quiz on the same topic.'
    }
    return accuracy >= 70
      ? 'Good pace. Finish the remaining questions before checking the final grade.'
      : 'Slow down and explain each option aloud before choosing. Accuracy matters more than speed here.'
  }, [accuracy, answeredCount, quiz, result])

  useEffect(() => {
    let active = true

    async function loadStatus() {
      try {
        const [statusRes, subjectRes] = await Promise.all([
          api.get<{ provider: string }>('/ai/status/'),
          api.get<Subject[]>('/study/subjects/'),
        ])
        if (!active) return
        setProvider(statusRes.data.provider)
        setSubjects(subjectRes.data)
        if (subjectRes.data[0]) {
          setSelectedSubjectId(String(subjectRes.data[0].id))
          setTopic(subjectRes.data[0].weak_topics || subjectRes.data[0].name)
        }
      } catch {
        if (active) setProvider('unknown')
      }
    }

    void loadStatus()
    return () => {
      active = false
    }
  }, [])

  async function generateQuiz(event?: React.FormEvent | React.MouseEvent) {
    event?.preventDefault()
    if (!topic.trim()) {
      toast.warn('Enter a topic first.')
      return
    }

    setLoading(true)
    setResult(null)
    try {
      const { data } = await api.post<Quiz>('/quiz/generate/', { topic: topic.trim(), difficulty, count: 5 })
      setQuiz(data)
      setAnswers({})
      setProvider(data.provider ?? provider)
      toast.success(`${data.provider === 'gemini' ? 'Gemini' : 'AI'} quiz generated`)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  function selectSubject(subject: Subject) {
    setSelectedSubjectId(String(subject.id))
    setTopic(subject.weak_topics || subject.name)
    setQuiz(null)
    setResult(null)
    setAnswers({})
  }

  async function submitQuiz() {
    if (!quiz) return
    if (answeredCount < quiz.questions.length) {
      toast.warn('Please answer every question before submitting.')
      return
    }

    try {
      const { data } = await api.post<QuizResult>(`/quiz/${quiz.id}/submit/`, { answers })
      setResult(data)
      toast.success(`Score: ${data.score}/${data.total}`)
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  function optionState(question: Question, index: number) {
    const selected = answers[question.id]
    if (selected === undefined) return ''
    if (index === question.answer_index) return 'correct'
    if (selected === index) return 'incorrect'
    return 'muted'
  }

  return (
    <div className="flow-page quiz-page">
      <AppHeader />

      <section className="page-title planner-title-row">
        <div>
          <h1>Quiz Center</h1>
          <p>Generate AI active-recall quizzes, select answers, and get instant explanations.</p>
        </div>
        <b className={`provider-pill provider-${provider}`}>{provider}</b>
      </section>

      <div className="quiz-layout">
        <main className="quiz-main">
          <section className="page-card">
            <div className="panel-heading">
              <h2>Your Subjects</h2>
              <button type="button" onClick={() => void generateQuiz()} disabled={loading}>
                {loading ? 'Generating...' : 'Generate'}
              </button>
            </div>
            <div className="subject-picks">
              {subjects.length ? subjects.map((subject) => (
                <button
                  className={String(subject.id) === selectedSubjectId ? 'selected' : ''}
                  key={subject.id}
                  onClick={() => selectSubject(subject)}
                  type="button"
                >
                  <b>{subject.name.slice(0, 2).toUpperCase()}</b>
                  <strong>{subject.name}</strong>
                  <span>{subject.weak_topics || `${subject.weekly_goal_hours}h weekly goal`}</span>
                </button>
              )) : (
                <div className="quiz-empty-state subject-empty-card">
                  <h3>No subjects yet</h3>
                  <p>Add subjects in Study Planner, or type a custom topic below and generate a quiz.</p>
                </div>
              )}
            </div>
          </section>

          <div className="quiz-controls">
            <section className="page-card">
              <h2>Difficulty Level</h2>
              {['easy', 'medium', 'hard'].map((level) => (
                <label className={difficulty === level ? 'difficulty active' : 'difficulty'} key={level}>
                  <span>{level}</span>
                  <input checked={difficulty === level} onChange={() => setDifficulty(level)} type="radio" />
                </label>
              ))}
            </section>

            <form className="page-card generator-card" onSubmit={generateQuiz}>
              <h2>Quiz Generator</h2>
              <label className="quiz-topic-input">
                Custom topic or weak area
                <input value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="Example: Organic chemistry alcohols" />
              </label>
              <div className="progress-label">
                <span>{quiz ? 'Answered Questions' : 'Ready to generate'}</span>
                <b>{quiz ? `${answeredCount}/${quiz.questions.length}` : '0/5'}</b>
              </div>
              <div className="thin-progress"><i style={{ width: `${loading ? 72 : progress}%` }} /></div>
              <button className="gradient-action" disabled={loading} type="submit">
                {loading ? 'Generating Gemini Quiz...' : 'Start AI Quiz'}
              </button>
            </form>
          </div>

          <section className="page-card performance-card">
            <div className="quiz-section-head">
              <div>
                <h2>{quiz ? `${quiz.topic} Challenge` : 'Recent Performance'}</h2>
                {quiz ? <span>{quiz.questions.length} questions - {quiz.difficulty}</span> : null}
              </div>
              {quiz ? <strong>{result ? `${result.score}/${result.total}` : `${liveScore}/${quiz.questions.length}`}</strong> : null}
            </div>

            {quiz ? (
              <div className="quiz-questions">
                {quiz.questions.map((question) => (
                  <article key={question.id}>
                    <strong>{question.id}. {question.question}</strong>
                    <div className="quiz-option-list">
                      {question.options.map((option, index) => (
                        <button
                          className={optionState(question, index)}
                          key={`${question.id}-${option}`}
                          onClick={() => setAnswers((current) => ({ ...current, [question.id]: index }))}
                          type="button"
                        >
                          <span>{String.fromCharCode(65 + index)}</span>
                          {option}
                        </button>
                      ))}
                    </div>
                    {answers[question.id] !== undefined || result ? <p>{question.explanation}</p> : null}
                  </article>
                ))}
                <button className="gradient-action quiz-submit-button" onClick={submitQuiz} type="button">
                  Submit Answers
                </button>
                {result ? (
                  <div className="quiz-score-card">
                    <strong>Final Grade: {Math.round((result.score / result.total) * 100)}%</strong>
                    <span>{result.score} correct out of {result.total}</span>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="quiz-empty-state">
                <h3>No active quiz yet</h3>
                <p>Choose a topic and press Start AI Quiz. The questions will appear here with instant feedback.</p>
              </div>
            )}
          </section>
        </main>

        <aside className="quiz-side">
          <section className="page-card quiz-session-card">
            <div className="quiz-session-head">
              <div>
                <h2>Quiz Session</h2>
                <span>{quiz ? quiz.topic : 'No quiz active'}</span>
              </div>
              <b>{quiz?.difficulty ?? 'ready'}</b>
            </div>
            <div className="quiz-progress-ring" style={{ '--quiz-progress': `${progress}%` } as CSSProperties}>
              <strong>{progress}%</strong>
              <span>answered</span>
            </div>
            <div className="quiz-side-stats">
              <article>
                <span>Questions</span>
                <strong>{quiz ? `${answeredCount}/${quiz.questions.length}` : '0/0'}</strong>
              </article>
              <article>
                <span>Accuracy</span>
                <strong>{quiz ? `${accuracy}%` : '--'}</strong>
              </article>
            </div>
            <div className="quiz-session-tip">
              <span>Flow AI Tip</span>
              <p>{quizTip}</p>
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}
