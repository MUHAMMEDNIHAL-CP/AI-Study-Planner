import { useEffect, useMemo, useState } from 'react'
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

function formatHours(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return hours ? `${hours}h ${mins}m` : `${mins}m`
}

function shortDate(date: string) {
  return new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [date, setDate] = useState(today)
  const [minutes, setMinutes] = useState('90')
  const [focus, setFocus] = useState('82')
  const [completed, setCompleted] = useState('3')
  const [breaks, setBreaks] = useState('2')
  const [mood, setMood] = useState('great')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const daily = useMemo(() => analytics?.daily ?? [], [analytics])
  const chartLogs = daily.slice(-14)
  const bestDay = useMemo(
    () => daily.reduce<Log | null>((best, log) => (!best || log.focus_score > best.focus_score ? log : best), null),
    [daily],
  )
  const consistency = daily.length ? Math.round((daily.filter((log) => log.minutes_studied > 0).length / 14) * 100) : 0
  const avgMinutes = daily.length
    ? Math.round(daily.reduce((total, log) => total + log.minutes_studied, 0) / daily.length)
    : 0

  async function loadAnalytics() {
    const { data } = await api.get<Analytics>('/productivity/analytics/')
    setAnalytics(data)
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
    setSaving(true)
    try {
      await api.post('/productivity/logs/', {
        date,
        minutes_studied: Number(minutes),
        focus_score: Number(focus),
        completed_tasks: Number(completed),
        breaks_taken: Number(breaks),
        mood,
      })
      toast.success('Productivity logged')
      await loadAnalytics()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="flow-page"><div className="page-card">Loading analytics...</div></div>

  return (
    <div className="flow-page analytics-page">
      <section className="page-title analytics-title-row">
        <div>
          <h1>Analytics</h1>
          <p>Track focus quality, completed tasks, and productivity momentum from your real logs.</p>
        </div>
        <strong>{daily.length} logged days</strong>
      </section>

      <div className="analytics-stat-row analytics-metrics">
        <article className="page-card">
          <span>Total Study</span>
          <strong>{formatHours(analytics?.total_minutes ?? 0)}</strong>
          <small>Last 14 days</small>
        </article>
        <article className="page-card">
          <span>Avg Focus</span>
          <strong>{analytics?.average_focus ?? 0}%</strong>
          <small>{bestDay ? `Best: ${shortDate(bestDay.date)}` : 'No focus logs yet'}</small>
        </article>
        <article className="page-card">
          <span>Tasks Done</span>
          <strong>{analytics?.completed_tasks ?? 0}</strong>
          <small>{formatHours(avgMinutes)} average/day</small>
        </article>
        <article className="page-card">
          <span>Consistency</span>
          <strong>{Math.min(consistency, 100)}%</strong>
          <small>Study days in window</small>
        </article>
      </div>

      <div className="analytics-layout">
        <section className="page-card analytics-chart">
          <div className="analytics-card-head">
            <div>
              <h2>Focus Trend</h2>
              <span>Daily focus score and study minutes</span>
            </div>
          </div>
          {chartLogs.length ? (
            <>
              <div className="analytics-bars">
                {chartLogs.map((log) => (
                  <article key={log.id}>
                    <div className="analytics-bar-track">
                      <i style={{ height: `${Math.max(log.focus_score, 8)}%` }} />
                    </div>
                    <strong>{log.focus_score}%</strong>
                    <span>{shortDate(log.date)}</span>
                    <small>{formatHours(log.minutes_studied)}</small>
                  </article>
                ))}
              </div>
              <div className="analytics-log-list">
                {daily.slice(0, 5).map((log) => (
                  <article key={log.id}>
                    <div>
                      <strong>{shortDate(log.date)}</strong>
                      <span>{log.mood} mood - {log.breaks_taken} breaks</span>
                    </div>
                    <b>{formatHours(log.minutes_studied)}</b>
                    <em>{log.focus_score}%</em>
                  </article>
                ))}
              </div>
            </>
          ) : (
            <div className="analytics-empty-state">
              <h3>No analytics yet</h3>
              <p>Log today's study session to start building your trend chart.</p>
            </div>
          )}
        </section>

        <form className="page-card analytics-form analytics-log-form" onSubmit={addLog}>
          <h2>Log Study Day</h2>
          <label>Date<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
          <label>Minutes<input min="0" type="number" value={minutes} onChange={(e) => setMinutes(e.target.value)} /></label>
          <label>Focus %<input max="100" min="0" type="number" value={focus} onChange={(e) => setFocus(e.target.value)} /></label>
          <label>Tasks<input min="0" type="number" value={completed} onChange={(e) => setCompleted(e.target.value)} /></label>
          <label>Breaks<input min="0" type="number" value={breaks} onChange={(e) => setBreaks(e.target.value)} /></label>
          <label>Mood<select value={mood} onChange={(e) => setMood(e.target.value)}><option value="low">Low</option><option value="okay">Okay</option><option value="good">Good</option><option value="great">Great</option></select></label>
          <button className="gradient-action" disabled={saving} type="submit">{saving ? 'Saving...' : 'Save Log'}</button>
        </form>
      </div>
    </div>
  )
}

