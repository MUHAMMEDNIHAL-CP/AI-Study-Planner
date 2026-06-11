import { useState } from 'react'
import { toast } from 'react-toastify'
import { api, getErrorMessage } from '../lib/api'

type TutorResponse = {
  title: string
  explanation?: string
  summary?: string[]
  flashcards?: { front: string; back: string }[]
  next_steps?: string[]
}

export default function AiTutorPage() {
  const [mode, setMode] = useState('explain')
  const [topic, setTopic] = useState('')
  const [prompt, setPrompt] = useState('')
  const [answer, setAnswer] = useState<TutorResponse | null>(null)
  const [loading, setLoading] = useState(false)

  async function askTutor(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    try {
      const { data } = await api.post<TutorResponse>('/ai/tutor/', { mode, topic, prompt })
      setAnswer(data)
      toast.success('Tutor response ready')
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6">
      <div className="glass p-6 rounded-lg shadow-glass max-w-5xl mx-auto text-left">
        <h2 className="text-2xl font-semibold">AI Tutor</h2>
        <p className="text-sm opacity-80 mt-2">Ask questions, request summaries, or generate flashcards.</p>

        <form className="mt-6 rounded-lg border border-white/10 bg-white/5 p-4" onSubmit={askTutor}>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[180px_1fr]">
            <select className="rounded-md px-3 py-2" value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="explain">Explain</option>
              <option value="summary">Summary</option>
              <option value="flashcards">Flashcards</option>
            </select>
            <input className="rounded-md px-3 py-2" placeholder="Topic, e.g. Newton's laws" value={topic} onChange={(e) => setTopic(e.target.value)} required />
          </div>
          <textarea className="mt-3 min-h-32 w-full rounded-md px-3 py-2" placeholder="Ask a question or paste notes..." value={prompt} onChange={(e) => setPrompt(e.target.value)} />
          <button className="mt-3 rounded-md bg-blue-600 px-4 py-2 font-medium text-white disabled:opacity-60" disabled={loading} type="submit">
            {loading ? 'Thinking...' : 'Ask tutor'}
          </button>
        </form>

        {answer ? (
          <section className="mt-6 rounded-lg border border-white/10 bg-white/5 p-4">
            <h3 className="font-semibold">{answer.title}</h3>
            {answer.explanation ? <p className="mt-3 text-sm leading-6 opacity-90">{answer.explanation}</p> : null}
            {answer.summary ? (
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm">
                {answer.summary.map((item) => <li key={item}>{item}</li>)}
              </ul>
            ) : null}
            {answer.flashcards ? (
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                {answer.flashcards.map((card) => (
                  <div className="rounded-md bg-black/10 p-3" key={card.front}>
                    <div className="text-sm font-medium text-[color:var(--text-h)]">{card.front}</div>
                    <div className="mt-2 text-sm opacity-80">{card.back}</div>
                  </div>
                ))}
              </div>
            ) : null}
            {answer.next_steps ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {answer.next_steps.map((step) => <span className="rounded-full bg-teal-500/15 px-3 py-1 text-sm text-teal-200" key={step}>{step}</span>)}
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </div>
  )
}
