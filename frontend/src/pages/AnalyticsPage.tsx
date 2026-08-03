import { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import PageShell from '../components/PageShell'
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

type TabKey = 'overview' | 'trend' | 'log'

const MOOD_COLORS: Record<string, string> = {
  low: '#fb7185',
  okay: '#fbbf24',
  good: '#a78bfa',
  great: '#4ade80',
}

function formatHours(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return hours ? `${hours}h ${mins}m` : `${mins}m`
}

function shortDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function fullDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

function moodLabel(mood: string) {
  switch (mood) {
    case 'low':
      return 'Low energy'
    case 'okay':
      return 'Okay'
    case 'good':
      return 'Good'
    case 'great':
      return 'Great'
    default:
      return 'Good'
  }
}

const today = new Date().toISOString().slice(0, 10)

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
  const [activeTab, setActiveTab] = useState<TabKey>('overview')

  const daily = useMemo(() => analytics?.daily ?? [], [analytics])
  const chartLogs = daily.slice(-14).reverse()
  const bestFocusDay = useMemo(
    () => daily.reduce<Log | null>((best, log) => (!best || log.focus_score > best.focus_score ? log : best), null),
    [daily],
  )
  const bestFocus = bestFocusDay?.focus_score ?? 0
  const mostMinutesDay = useMemo(
    () => daily.reduce<Log | null>((best, log) => (!best || log.minutes_studied > best.minutes_studied ? log : best), null),
    [daily],
  )
  const studyDays = daily.filter((log) => log.minutes_studied > 0).length
  const consistency = daily.length ? Math.round((studyDays / 14) * 100) : 0
  const avgMinutes = daily.length
    ? Math.round(daily.reduce((total, log) => total + log.minutes_studied, 0) / daily.length)
    : 0
  const maxFocus = Math.max(8, ...chartLogs.map((log) => log.focus_score))
  const maxMinutes = Math.max(1, ...chartLogs.map((log) => log.minutes_studied))

  const weekData = useMemo(() => {
    const weeks: Array<{ label: string; total: number; avg: number }> = []
    for (let index = 0; index < 2; index += 1) {
      const weekLogs = daily.slice(index * 7, index * 7 + 7)
      const total = weekLogs.reduce((sum, log) => sum + log.minutes_studied, 0)
      const focused = weekLogs.filter((log) => log.focus_score > 0)
      const avg = focused.length
        ? Math.round(focused.reduce((sum, log) => sum + log.focus_score, 0) / focused.length)
        : 0
      weeks.push({ label: index === 0 ? 'This week' : 'Last week', total, avg })
    }
    return weeks
  }, [daily])

  const moodCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    daily.forEach((log) => {
      counts[log.mood] = (counts[log.mood] ?? 0) + 1
    })
    return counts
  }, [daily])

  const totalBreaks = useMemo(() => daily.reduce((sum, log) => sum + log.breaks_taken, 0), [daily])

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
      toast.success('Study day logged')
      await loadAnalytics()
      setActiveTab('overview')
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const heroMetrics = [
    {
      label: 'Total Study',
      value: formatHours(analytics?.total_minutes ?? 0),
      detail: `${studyDays} active day${studyDays === 1 ? '' : 's'} in the last 14`,
      tone: 'analytics-tone-coral',
      icon: '◷',
    },
    {
      label: 'Average Focus',
      value: `${analytics?.average_focus ?? 0}%`,
      detail: bestFocus ? `Best day: ${bestFocus}% · ${shortDate(bestFocusDay!.date)}` : 'Log a session to start',
      tone: 'analytics-tone-mint',
      icon: '◎',
    },
    {
      label: 'Tasks Completed',
      value: `${analytics?.completed_tasks ?? 0}`,
      detail: `${formatHours(avgMinutes)} avg study time per day`,
      tone: 'analytics-tone-violet',
      icon: '✓',
    },
    {
      label: 'Consistency',
      value: `${Math.min(consistency, 100)}%`,
      detail: studyDays ? `${studyDays} of 14 days studied` : 'No logs in this window',
      tone: 'analytics-tone-amber',
      icon: '📅',
    },
  ]

  const tabs: Array<{ key: TabKey; label: string; icon: string }> = [
    { key: 'overview', label: 'Overview', icon: '◆' },
    { key: 'trend', label: 'Trend', icon: '📈' },
    { key: 'log', label: 'Log Study Day', icon: '+' },
  ]

  if (loading) {
    return (
      <PageShell eyebrow="Performance hub" title="Loading insights..." subtitle="Gathering your focus and study data.">
        <div className="analytics-skeleton">Crunching your productivity numbers...</div>
      </PageShell>
    )
  }

  return (
    <PageShell
      className="analytics-orbit-page"
      eyebrow="Performance hub"
      title="Study Analytics"
      subtitle="See focus quality, study momentum, and task completion at a glance — then log today's session to keep the streak alive."
      actions={<strong className="analytics-day-pill">{studyDays} logged days</strong>}
    >
      <div className="analytics-hero-metrics">
        {heroMetrics.map((metric) => (
          <article className={`analytics-hero-metric ${metric.tone}`} key={metric.label}>
            <span className="analytics-metric-icon">{metric.icon}</span>
            <div>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
              <small>{metric.detail}</small>
            </div>
          </article>
        ))}
      </div>

      <nav className="analytics-tabs" aria-label="Analytics sections">
        {tabs.map((tab) => (
          <button
            className={activeTab === tab.key ? 'active' : ''}
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            type="button"
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === 'overview' ? (
        <div className="analytics-overview-grid">
          <section className="page-card analytics-recent-card">
            <div className="analytics-card-head">
              <div>
                <span className="eyebrow">Recent activity</span>
                <h2>Latest Study Days</h2>
              </div>
            </div>
            {daily.length ? (
              <div className="analytics-recent-list">
                {daily.slice(0, 6).map((log) => (
                  <article key={log.id}>
                    <time>{fullDate(log.date)}</time>
                    <div className="analytics-recent-main">
                      <strong>{log.completed_tasks} task{log.completed_tasks === 1 ? '' : 's'} · {formatHours(log.minutes_studied)}</strong>
                      <span>
                        <i className="analytics-mood-dot" style={{ background: MOOD_COLORS[log.mood] ?? '#a78bfa' }} />
                        {moodLabel(log.mood)} mood · {log.breaks_taken} breaks
                      </span>
                    </div>
                    <b>{log.focus_score}% focus</b>
                  </article>
                ))}
              </div>
            ) : (
              <div className="analytics-empty-state">
                <h3>No study days yet</h3>
                <p>Log your first study session in the Log tab to unlock insights, streaks, and trends.</p>
                <button className="gradient-action" onClick={() => setActiveTab('log')} type="button">
                  Log Study Day
                </button>
              </div>
            )}
          </section>

          <aside className="analytics-overview-side">
            <section className="page-card analytics-insights-card">
              <div className="analytics-card-head">
                <div>
                  <span className="eyebrow">Highlights</span>
                  <h2>Best Moments</h2>
                </div>
              </div>
              <div className="analytics-insight-list">
                {daily.length ? (
                  <>
                    <p><b>🎯</b><span><strong>Peak focus</strong>{bestFocusDay ? `${shortDate(bestFocusDay.date)} · ${bestFocus}% focus` : 'No logs yet'}</span></p>
                    <p><b>⚡</b><span><strong>Deepest session</strong>{mostMinutesDay && mostMinutesDay.minutes_studied > 0 ? `${shortDate(mostMinutesDay.date)} · ${formatHours(mostMinutesDay.minutes_studied)}` : 'No study minutes yet'}</span></p>
                    <p><b>📅</b><span><strong>Study days</strong>{studyDays} of 14 days in this window</span></p>
                    <p><b>☕</b><span><strong>Breaks taken</strong>{totalBreaks} total across your sessions</span></p>
                  </>
                ) : (
                  <div className="analytics-empty-state compact">
                    <p>Highlights appear once you log a few sessions.</p>
                  </div>
                )}
              </div>
            </section>

            <section className="page-card analytics-mood-card">
              <div className="analytics-card-head">
                <div>
                  <span className="eyebrow">Mood pattern</span>
                  <h2>Session Feelings</h2>
                </div>
              </div>
              {Object.keys(moodCounts).length ? (
                <div className="analytics-mood-track">
                  {(['great', 'good', 'okay', 'low'] as const).map((key) => (
                    <div key={key}>
                      <span>{moodLabel(key)}</span>
                      <div className="analytics-mood-bar">
                        <i style={{ width: `${(moodCounts[key] ?? 0) / Math.max(1, daily.length) * 100}%` }} />
                      </div>
                      <b>{moodCounts[key] ?? 0}</b>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="analytics-empty-state compact">
                  <p>Your mood pattern will show here after logging sessions.</p>
                </div>
              )}
            </section>
          </aside>
        </div>
      ) : null}

      {activeTab === 'trend' ? (
        <div className="analytics-trend-grid">
          <section className="page-card analytics-trend-card">
            <div className="analytics-card-head">
              <div>
                <span className="eyebrow">14-day window</span>
                <h2>Focus &amp; Study Trend</h2>
              </div>
            </div>
            {chartLogs.length ? (
              <>
                <div className="analytics-bars">
                  {chartLogs.map((log) => (
                    <article key={log.id} title={`${fullDate(log.date)} · ${formatHours(log.minutes_studied)} · ${log.focus_score}% focus`}>
                      <div className="analytics-bar-track">
                        <i
                          className="analytics-bar-minutes"
                          style={{ height: `${Math.max((log.minutes_studied / maxMinutes) * 100, 7)}%` }}
                        />
                        <i
                          className="analytics-bar-focus"
                          style={{ height: `${Math.max((log.focus_score / maxFocus) * 100, 7)}%` }}
                        />
                      </div>
                      <strong>{log.focus_score}%</strong>
                      <span>{shortDate(log.date)}</span>
                      <small>{formatHours(log.minutes_studied)}</small>
                    </article>
                  ))}
                </div>
                <div className="analytics-chart-legend">
                  <span><i className="legend-minutes" /> Study minutes</span>
                  <span><i className="legend-focus" /> Focus score</span>
                </div>
              </>
            ) : (
              <div className="analytics-empty-state">
                <h3>No trend data yet</h3>
                <p>Log a study day to start building your focus and minutes chart.</p>
                <button className="gradient-action" onClick={() => setActiveTab('log')} type="button">
                  Log Study Day
                </button>
              </div>
            )}
          </section>

          <aside className="analytics-trend-side">
            {weekData.map((week) => (
              <section className="page-card analytics-week-card" key={week.label}>
                <div className="analytics-card-head">
                  <div>
                    <span className="eyebrow">Weekly view</span>
                    <h2>{week.label}</h2>
                  </div>
                </div>
                <div className="analytics-week-stats">
                  <div>
                    <span>Study time</span>
                    <strong>{formatHours(week.total)}</strong>
                  </div>
                  <div>
                    <span>Avg focus</span>
                    <strong>{week.avg ? `${week.avg}%` : '--'}</strong>
                  </div>
                </div>
              </section>
            ))}
            <section className="page-card analytics-consistency-card">
              <div className="analytics-consistency-ring" style={{ '--consistency': `${Math.min(consistency, 100)}%` } as React.CSSProperties}>
                <strong>{Math.min(consistency, 100)}%</strong>
                <span>consistency</span>
              </div>
              <p>{consistency >= 70 ? 'Excellent rhythm — keep the daily study habit going.' : consistency >= 40 ? 'Good momentum — try to add one more study day this week.' : 'Let us help you build a steadier study routine.'}</p>
            </section>
          </aside>
        </div>
      ) : null}

      {activeTab === 'log' ? (
        <div className="analytics-log-layout">
          <form className="page-card analytics-log-form" onSubmit={addLog}>
            <div className="analytics-card-head">
              <div>
                <span className="eyebrow">Daily check-in</span>
                <h2>Log Today&apos;s Study</h2>
              </div>
            </div>

            <div className="analytics-log-fields">
              <label>
                <span>Date</span>
                <input type="date" value={date} max={today} onChange={(event) => setDate(event.target.value)} />
              </label>
              <label>
                <span>Minutes studied</span>
                <input min="0" type="number" placeholder="90" value={minutes} onChange={(event) => setMinutes(event.target.value)} />
              </label>
              <label>
                <span>Focus %</span>
                <input max="100" min="0" placeholder="82" type="number" value={focus} onChange={(event) => setFocus(event.target.value)} />
              </label>
              <label>
                <span>Tasks completed</span>
                <input min="0" placeholder="3" type="number" value={completed} onChange={(event) => setCompleted(event.target.value)} />
              </label>
              <label>
                <span>Breaks taken</span>
                <input min="0" placeholder="2" type="number" value={breaks} onChange={(event) => setBreaks(event.target.value)} />
              </label>
              <label>
                <span>How did it feel?</span>
                <select value={mood} onChange={(event) => setMood(event.target.value)}>
                  <option value="low">Low energy</option>
                  <option value="okay">Okay</option>
                  <option value="good">Good</option>
                  <option value="great">Great</option>
                </select>
              </label>
            </div>

            <button className="gradient-action" disabled={saving} type="submit">
              {saving ? 'Saving...' : 'Save Study Day'}
            </button>
          </form>

          <aside className="analytics-log-side">
            <section className="page-card analytics-log-tip">
              <span className="eyebrow">Why log?</span>
              <h2>Every session counts</h2>
              <p>Logging minutes keeps your streak alive, refines your focus trend, and helps the AI tutor tailor better recommendations.</p>
              <ul>
                <li>🔥 Streaks count study days, not minutes</li>
                <li>📈 Focus scores shape your trend chart</li>
                <li>🧠 Mood data powers burnout insight</li>
              </ul>
            </section>
          </aside>
        </div>
      ) : null}
    </PageShell>
  )
}

