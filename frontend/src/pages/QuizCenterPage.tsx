import { useState } from 'react'
import { toast } from 'react-toastify'
import { api, getErrorMessage } from '../lib/api'

type Question = {
  id: number
  question: string
  options: string[]
  answer_index: number
  explanation: string
}

type Quiz = {
  id: number
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

export default function QuizCenterPage() {
  const [topic, setTopic] = useState('')
  const [difficulty, setDifficulty] = useState('medium')
  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [result, setResult] = useState<QuizResult | null>(null)
  const [loading, setLoading] = useState(false)

  async function generateQuiz(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setResult(null)
    try {
      const { data } = await api.post<Quiz>('/quiz/generate/', { topic, difficulty, count: 5 })
      setQuiz(data)
      setAnswers({})
      toast.success('Quiz generated')
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  async function submitQuiz() {
    if (!quiz) return
    try {
      const { data } = await api.post<QuizResult>(`/quiz/${quiz.id}/submit/`, { answers })
      setResult(data)
      toast.success(`Score: ${data.score}/${data.total}`)
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  return (
    <div className="p-6">
      <div className="glass p-6 rounded-lg shadow-glass max-w-5xl mx-auto text-left">
        <h2 className="text-2xl font-semibold">Quiz Center</h2>
        <p className="text-sm opacity-80 mt-2">Generate MCQs from your topics and get instant scoring.</p>

        <form className="mt-6 grid grid-cols-1 gap-3 rounded-lg border border-white/10 bg-white/5 p-4 md:grid-cols-[1fr_180px_auto]" onSubmit={generateQuiz}>
          <input className="rounded-md px-3 py-2" placeholder="Topic, e.g. Organic chemistry" value={topic} onChange={(e) => setTopic(e.target.value)} required />
          <select className="rounded-md px-3 py-2" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
          <button className="rounded-md bg-blue-600 px-4 py-2 font-medium text-white disabled:opacity-60" disabled={loading} type="submit">
            {loading ? 'Generating...' : 'Generate'}
          </button>
        </form>

        {quiz ? (
          <section className="mt-6 space-y-4">
            <div className="rounded-lg border border-white/10 bg-white/5 p-4">
              <h3 className="font-semibold">{quiz.topic} • {quiz.difficulty}</h3>
              <p className="mt-1 text-sm opacity-75">{quiz.total_questions} questions</p>
            </div>
            {quiz.questions.map((question) => (
              <div className="rounded-lg border border-white/10 bg-white/5 p-4" key={question.id}>
                <div className="font-medium text-[color:var(--text-h)]">{question.id}. {question.question}</div>
                <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                  {question.options.map((option, index) => (
                    <label className="flex cursor-pointer items-start gap-2 rounded-md bg-black/10 p-3 text-sm" key={option}>
                      <input
                        checked={answers[question.id] === index}
                        className="mt-1"
                        name={`q-${question.id}`}
                        type="radio"
                        onChange={() => setAnswers((current) => ({ ...current, [question.id]: index }))}
                      />
                      <span>{option}</span>
                    </label>
                  ))}
                </div>
                {result ? (
                  <p className="mt-3 text-sm text-teal-300">
                    {result.results.find((item) => item.id === question.id)?.explanation}
                  </p>
                ) : null}
              </div>
            ))}
            <button className="rounded-md bg-teal-600 px-4 py-2 font-medium text-white" onClick={submitQuiz} type="button">Submit answers</button>
            {result ? <span className="ml-3 font-semibold text-[color:var(--text-h)]">Score {result.score}/{result.total}</span> : null}
          </section>
        ) : null}
      </div>
    </div>
  )
}
