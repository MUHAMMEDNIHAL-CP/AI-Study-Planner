import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, getErrorMessage } from '../lib/api'

type Exam = {
  id: number
  title: string
  date: string
  priority: string
  subject_name?: string
}

type Log = {
  date: string
  minutes_studied: number
  focus_score: number
  completed_tasks: number
}

type Dashboard = {
  streak: number
  week_minutes: number
  completion_rate: number
  open_tasks: number
  upcoming_exams: Exam[]
  recent_logs: Log[]
}

const emptyDashboard: Dashboard = {
  streak: 0,
  week_minutes: 0,
  completion_rate: 0,
  open_tasks: 0,
  upcoming_exams: [],
  recent_logs: [],
}

export default function DashboardPage() {
  const [dashboard, setDashboard] = useState<Dashboard>(emptyDashboard)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadDashboard() {
      try {
        const { data } = await api.get<Dashboard>('/study/dashboard/')
        setDashboard(data)
      } catch (err) {
        setError(getErrorMessage(err))
      } finally {
        setLoading(false)
      }
    }

    void loadDashboard()
  }, [])

  if (loading) {
    return <div className="p-6 text-center">Loading dashboard...</div>
  }

  return (
    <div className="p-6">
      <div className="glass p-6 rounded-lg shadow-glass max-w-5xl mx-auto text-left">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-2xl font-semibold">Dashboard</h2>
            <p className="text-sm opacity-80 mt-2">Your study momentum, upcoming exams, and recent focus data.</p>
          </div>
          <div className="flex gap-2">
            <Link className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white" to="/planner">
              Plan study
            </Link>
            <Link className="rounded-md border border-white/15 px-3 py-2 text-sm font-medium" to="/analytics">
              Analytics
            </Link>
          </div>
        </div>

        {error ? <div className="mt-4 rounded-md border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-300">{error}</div> : null}

        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            ['Streak', `${dashboard.streak} days`],
            ['This week', `${Math.round(dashboard.week_minutes / 60)} hrs`],
            ['Completion', `${dashboard.completion_rate}%`],
            ['Open tasks', dashboard.open_tasks],
          ].map(([label, value]) => (
            <div className="rounded-lg border border-white/10 bg-white/5 p-4" key={label}>
              <div className="text-xs uppercase opacity-65">{label}</div>
              <div className="mt-2 text-2xl font-semibold text-[color:var(--text-h)]">{value}</div>
            </div>
          ))}
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <section className="rounded-lg border border-white/10 bg-white/5 p-4">
            <h3 className="font-semibold">Upcoming exams</h3>
            <div className="mt-3 space-y-3">
              {dashboard.upcoming_exams.length ? (
                dashboard.upcoming_exams.map((exam) => (
                  <div className="flex items-center justify-between gap-3 rounded-md bg-black/10 p-3" key={exam.id}>
                    <div>
                      <div className="font-medium text-[color:var(--text-h)]">{exam.title}</div>
                      <div className="text-sm opacity-75">{exam.subject_name ?? 'General'} • {exam.priority}</div>
                    </div>
                    <div className="text-sm">{exam.date}</div>
                  </div>
                ))
              ) : (
                <p className="text-sm opacity-75">No exams yet. Add one from the planner.</p>
              )}
            </div>
          </section>

          <section className="rounded-lg border border-white/10 bg-white/5 p-4">
            <h3 className="font-semibold">Recent productivity</h3>
            <div className="mt-3 space-y-3">
              {dashboard.recent_logs.length ? (
                dashboard.recent_logs.map((log) => (
                  <div className="rounded-md bg-black/10 p-3" key={log.date}>
                    <div className="flex justify-between text-sm">
                      <span>{log.date}</span>
                      <span>{log.focus_score}% focus</span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-white/10">
                      <div className="h-2 rounded-full bg-teal-400" style={{ width: `${Math.min(log.focus_score, 100)}%` }} />
                    </div>
                    <div className="mt-2 text-xs opacity-75">{log.minutes_studied} minutes • {log.completed_tasks} tasks</div>
                  </div>
                ))
              ) : (
                <p className="text-sm opacity-75">No productivity logs yet. Add one from Analytics.</p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
