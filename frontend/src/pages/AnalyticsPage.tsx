import { useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import { api, getErrorMessage } from '../lib/api'

type Log = {
  id: number
  date: string
  minutes_studied: number
  focus_score: number
  completed_tasks: number
  breaks_taken: number
  mood: string
}

type Analytics = {
  total_minutes: number
  average_focus: number
  completed_tasks: number
  daily: Log[]
}

const today = new Date().toISOString().slice(0, 10)

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [date, setDate] = useState(today)
  const [minutes, setMinutes] = useState('90')
  const [focus, setFocus] = useState('75')
  const [completed, setCompleted] = useState('2')
  const [mood, setMood] = useState('good')
  const [loading, setLoading] = useState(true)

  async function loadAnalytics() {
    try {
      const { data } = await api.get<Analytics>('/productivity/analytics/')
      setAnalytics(data)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true

    async function loadInitialAnalytics() {
      try {
        const { data } = await api.get<Analytics>('/productivity/analytics/')
        if (active) setAnalytics(data)
      } catch (err) {
        if (active) toast.error(getErrorMessage(err))
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadInitialAnalytics()
    return () => {
      active = false
    }
  }, [])

  async function addLog(event: React.FormEvent) {
    event.preventDefault()
    try {
      await api.post('/productivity/logs/', {
        date,
        minutes_studied: minutes,
        focus_score: focus,
        completed_tasks: completed,
        breaks_taken: 2,
        mood,
      })
      toast.success('Productivity logged')
      await loadAnalytics()
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  if (loading) return <div className="p-6 text-center">Loading analytics...</div>

  return (
    <div className="p-6">
      <div className="glass p-6 rounded-lg shadow-glass max-w-5xl mx-auto text-left">
        <h2 className="text-2xl font-semibold">Analytics</h2>
        <p className="text-sm opacity-80 mt-2">Productivity trends, focus quality, and completed task totals.</p>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <div className="text-xs uppercase opacity-65">Total study</div>
            <div className="mt-2 text-2xl font-semibold text-[color:var(--text-h)]">{Math.round((analytics?.total_minutes ?? 0) / 60)} hrs</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <div className="text-xs uppercase opacity-65">Average focus</div>
            <div className="mt-2 text-2xl font-semibold text-[color:var(--text-h)]">{analytics?.average_focus ?? 0}%</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <div className="text-xs uppercase opacity-65">Completed tasks</div>
            <div className="mt-2 text-2xl font-semibold text-[color:var(--text-h)]">{analytics?.completed_tasks ?? 0}</div>
          </div>
        </div>

        <form className="mt-6 grid grid-cols-1 gap-3 rounded-lg border border-white/10 bg-white/5 p-4 md:grid-cols-5" onSubmit={addLog}>
          <input className="rounded-md px-3 py-2" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <input className="rounded-md px-3 py-2" min="0" type="number" value={minutes} onChange={(e) => setMinutes(e.target.value)} placeholder="Minutes" />
          <input className="rounded-md px-3 py-2" max="100" min="0" type="number" value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="Focus %" />
          <select className="rounded-md px-3 py-2" value={mood} onChange={(e) => setMood(e.target.value)}>
            <option value="low">Low</option>
            <option value="okay">Okay</option>
            <option value="good">Good</option>
            <option value="great">Great</option>
          </select>
          <button className="rounded-md bg-blue-600 px-4 py-2 font-medium text-white" type="submit">Log day</button>
          <input className="rounded-md px-3 py-2 md:col-span-2" min="0" type="number" value={completed} onChange={(e) => setCompleted(e.target.value)} placeholder="Completed tasks" />
        </form>

        <section className="mt-6 rounded-lg border border-white/10 bg-white/5 p-4">
          <h3 className="font-semibold">Last 14 days</h3>
          <div className="mt-4 space-y-3">
            {analytics?.daily.length ? analytics.daily.map((log) => (
              <div className="grid grid-cols-[110px_1fr_70px] items-center gap-3 text-sm" key={log.id}>
                <span>{log.date}</span>
                <div className="h-3 rounded-full bg-white/10">
                  <div className="h-3 rounded-full bg-teal-400" style={{ width: `${Math.min(log.focus_score, 100)}%` }} />
                </div>
                <span>{log.minutes_studied}m</span>
              </div>
            )) : <p className="text-sm opacity-75">No logs yet.</p>}
          </div>
        </section>
      </div>
    </div>
  )
}
