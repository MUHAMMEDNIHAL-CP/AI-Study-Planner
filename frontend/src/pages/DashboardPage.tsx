import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import EmptyState from '../components/EmptyState'
import PageShell from '../components/PageShell'
import { api, getErrorMessage } from '../lib/api'

type ApiSubject = {
  id: number
  name: string
  weak_topics: string
  weekly_goal_hours: number
}

type ApiExam = {
  id: number
  subject: number | null
  subject_name?: string
  title: string
  date: string
  priority: string
  notes: string
}

type ApiTask = {
  id: number
  subject: number | null
  subject_name?: string
  title: string
  description: string
  due_date: string | null
  scheduled_for: string | null
  duration_minutes: number
  priority: string
  status: 'todo' | 'doing' | 'done'
}

type DashboardSummary = {
  streak: number
  week_minutes: number
  completion_rate: number
  open_tasks: number
  upcoming_exams: ApiExam[]
  recent_logs: Array<{
    date: string
    minutes_studied: number
    focus_score: number
    completed_tasks: number
  }>
}

const todayInput = () => new Date().toISOString().slice(0, 10)

function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return hours ? `${hours}h ${mins}m` : `${mins}m`
}

function shortDate(value: string | null | undefined) {
  if (!value) return 'No date'
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(value))
}

function daysUntil(value: string) {
  const today = new Date(todayInput()).getTime()
  const target = new Date(value).getTime()
  return Math.max(0, Math.ceil((target - today) / 86_400_000))
}

function taskDate(task: ApiTask) {
  return task.scheduled_for ?? task.due_date ?? '9999-12-31'
}

function loadReviewedExams() {
  try {
    return JSON.parse(localStorage.getItem('focusflow.reviewedExams') ?? '[]') as number[]
  } catch {
    return []
  }
}

function dayPart() {
  const hour = new Date().getHours()
  if (hour < 12) return 'morning'
  if (hour < 17) return 'afternoon'
  return 'evening'
}

export default function DashboardPage() {
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null)
  const [subjects, setSubjects] = useState<ApiSubject[]>([])
  const [exams, setExams] = useState<ApiExam[]>([])
  const [tasks, setTasks] = useState<ApiTask[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingTaskId, setSavingTaskId] = useState<number | null>(null)
  const [reviewedExamIds, setReviewedExamIds] = useState<number[]>(() => loadReviewedExams())
  const [firstName, setFirstName] = useState('Scholar')

  useEffect(() => {
    let active = true

    async function loadDashboard() {
      try {
        const [profileRes, dashboardRes, subjectsRes, examsRes, tasksRes] = await Promise.all([
          api.get<{ username: string }>('/auth/me/'),
          api.get<DashboardSummary>('/study/dashboard/'),
          api.get<ApiSubject[]>('/study/subjects/'),
          api.get<ApiExam[]>('/study/exams/'),
          api.get<ApiTask[]>('/study/tasks/'),
        ])
        if (!active) return
        setFirstName(profileRes.data.username.split(/\s+/)[0] || 'Scholar')
        setDashboard(dashboardRes.data)
        setSubjects(subjectsRes.data)
        setExams(examsRes.data)
        setTasks(tasksRes.data)
        setError(null)
      } catch (err) {
        if (active) setError(getErrorMessage(err))
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadDashboard()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('focusflow.reviewedExams', JSON.stringify(reviewedExamIds))
  }, [reviewedExamIds])

  const openTasks = useMemo(
    () =>
      tasks
        .filter((task) => task.status !== 'done')
        .sort((a, b) => taskDate(a).localeCompare(taskDate(b))),
    [tasks],
  )
  const todayTasks = openTasks.slice(0, 5)
  const recentLogs = dashboard?.recent_logs ?? []
  const averageFocus = recentLogs.length
    ? Math.round(recentLogs.reduce((total, log) => total + log.focus_score, 0) / recentLogs.length)
    : 0
  const upcomingExams = (dashboard?.upcoming_exams.length ? dashboard.upcoming_exams : exams)
    .filter((exam) => exam.date >= todayInput())
    .slice(0, 4)
  const completionRate = dashboard?.completion_rate ?? 0
  const nextTask = openTasks[0]
  const nextExam = upcomingExams[0]

  const recommendations = [
    openTasks.length
      ? `Finish "${openTasks[0].title}" before opening a new study block.`
      : 'Your task list is clear. Add the next study block in Planner.',
    upcomingExams.length
      ? `${upcomingExams[0].title} is in ${daysUntil(upcomingExams[0].date)} days — schedule one recall session today.`
      : 'No upcoming exams yet. Add exam dates to unlock smarter planning.',
    averageFocus >= 70
      ? 'Focus quality looks strong. Turn weak topics into a quiz next.'
      : 'Start with a 25-minute Focus Mode session, then log your minutes.',
  ]

  const flowPath = [
    {
      label: 'Start',
      title: nextTask ? nextTask.title : 'Add your first priority task',
      text: nextTask ? `${nextTask.duration_minutes} min · ${nextTask.subject_name || 'General'}` : 'Create a task so FocusFlow can guide your day.',
      to: nextTask ? '/focus' : '/planner',
    },
    {
      label: 'Recall',
      title: subjects[0]?.weak_topics || subjects[0]?.name || 'Practice a weak topic',
      text: 'Active recall beats rereading notes.',
      to: '/quiz',
    },
    {
      label: 'Review',
      title: nextExam ? `${nextExam.title} countdown` : 'Set an exam target',
      text: nextExam ? `${daysUntil(nextExam.date)} days left · ${nextExam.subject_name || 'General'}` : 'Add exam dates to personalize your orbit.',
      to: '/planner',
    },
  ]

  async function toggleTask(task: ApiTask) {
    const nextStatus = task.status === 'done' ? 'todo' : 'done'
    setSavingTaskId(task.id)
    setTasks((current) => current.map((item) => (item.id === task.id ? { ...item, status: nextStatus } : item)))
    try {
      await api.patch(`/study/tasks/${task.id}/`, { status: nextStatus })
      const { data } = await api.get<DashboardSummary>('/study/dashboard/')
      setDashboard(data)
    } catch (err) {
      setTasks((current) => current.map((item) => (item.id === task.id ? task : item)))
      setError(getErrorMessage(err))
    } finally {
      setSavingTaskId(null)
    }
  }

  function toggleExamReviewed(examId: number) {
    setReviewedExamIds((current) =>
      current.includes(examId) ? current.filter((id) => id !== examId) : [...current, examId],
    )
  }

  const subtitle = loading
    ? 'Syncing your planner, exams, tasks, and focus logs.'
    : nextTask
      ? `Your next best move is "${nextTask.title}". Keep it small, focused, and finishable.`
      : `You have ${subjects.length} subject${subjects.length === 1 ? '' : 's'} and a ${dashboard?.streak ?? 0}-day streak. Add one priority task to begin.`

  return (
    <PageShell
      className="dashboard-clean-page"
      eyebrow="Study dashboard"
      subtitle={subtitle}
      title={`Good ${dayPart()}, ${firstName}.`}
      actions={
        <>
          <Link className="gradient-action" to="/focus">Start Focus</Link>
          <Link className="ghost-action" to="/planner">Plan Study</Link>
        </>
      }
    >
      {error ? <div className="dashboard-alert">{error}</div> : null}
      {loading ? <div className="dashboard-loading">Loading live dashboard data...</div> : null}

      <section className="dashboard-clean-metrics">
        <DashboardMetric label="Weekly Focus" value={formatMinutes(dashboard?.week_minutes ?? 0)} detail="Logged this week" />
        <DashboardMetric label="Tasks Done" value={`${completionRate}%`} detail={`${dashboard?.open_tasks ?? openTasks.length} still open`} />
        <DashboardMetric label="Avg Focus" value={`${averageFocus}%`} detail={recentLogs.length ? 'Recent sessions' : 'No logs yet'} />
        <DashboardMetric label="Next Exam" value={upcomingExams[0] ? `${daysUntil(upcomingExams[0].date)}d` : '--'} detail={upcomingExams[0]?.title ?? 'Add exam'} />
      </section>

      <section className="dashboard-flow-path">
        <div className="dashboard-flow-head">
          <div>
            <span className="eyebrow">Today&apos;s orbit path</span>
            <h2>Your guided study sequence</h2>
          </div>
          <span>{openTasks.length ? `${openTasks.length} tasks waiting` : 'Ready to plan'}</span>
        </div>
        <div className="dashboard-flow-steps">
          {flowPath.map((step, index) => (
            <Link className="dashboard-flow-step" key={step.label} to={step.to}>
              <b>{index + 1}</b>
              <div>
                <span>{step.label}</span>
                <strong>{step.title}</strong>
                <small>{step.text}</small>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <main className="dashboard-clean-grid">
        <section className="page-card dashboard-today-card">
          <div className="dashboard-card-head">
            <div>
              <span>Today</span>
              <h2>Priority Tasks</h2>
            </div>
            <Link to="/planner">Open Planner</Link>
          </div>

          <div className="dashboard-task-list">
            {todayTasks.map((task) => (
              <article key={task.id}>
                <button
                  aria-label={`Mark ${task.title} complete`}
                  className={task.status === 'done' ? 'dashboard-check checked' : 'dashboard-check'}
                  disabled={savingTaskId === task.id}
                  onClick={() => void toggleTask(task)}
                  type="button"
                />
                <div>
                  <strong>{task.title}</strong>
                  <span>{task.subject_name || 'General'} · {shortDate(task.due_date ?? task.scheduled_for)} · {task.duration_minutes} min</span>
                </div>
                <b>{task.priority}</b>
              </article>
            ))}
            {!todayTasks.length ? (
              <EmptyState
                actionLabel="Add a task"
                actionTo="/planner"
                description="Create tasks in Study Planner and they will appear here in priority order."
                title="No priority tasks yet"
              />
            ) : null}
          </div>
        </section>

        <aside className="dashboard-side-stack">
          <section className="page-card dashboard-focus-card">
            <div
              className="dashboard-progress-ring"
              style={{ '--dashboard-progress': `${completionRate}%` } as CSSProperties}
            >
              <strong>{completionRate}%</strong>
              <span>Task progress</span>
            </div>
            <div>
              <h2>Focus Snapshot</h2>
              <p>{averageFocus >= 70 ? 'You are in a good rhythm. Keep one quiz or recall block today.' : 'Start with a shorter focus session and log it afterward.'}</p>
            </div>
          </section>

          <section className="page-card dashboard-ai-card">
            <div className="dashboard-card-head">
              <div>
                <span>AI Suggestions</span>
                <h2>Next Best Moves</h2>
              </div>
            </div>
            {recommendations.map((item) => <p key={item}>{item}</p>)}
          </section>
        </aside>

        <section className="page-card dashboard-exams-card">
          <div className="dashboard-card-head">
            <div>
              <span>Exam timeline</span>
              <h2>Upcoming Exams</h2>
            </div>
            <Link to="/planner">Add Exam</Link>
          </div>

          <div className="dashboard-exam-list">
            {upcomingExams.map((exam) => (
              <article className={reviewedExamIds.includes(exam.id) ? 'reviewed' : ''} key={exam.id}>
                <time>{shortDate(exam.date)}</time>
                <div>
                  <strong>{exam.title}</strong>
                  <span>{exam.subject_name || 'No subject'} · {daysUntil(exam.date)} days left</span>
                </div>
                <div className="dashboard-exam-actions">
                  <b>{exam.priority}</b>
                  <button
                    aria-label={`Mark ${exam.title} reviewed`}
                    className={reviewedExamIds.includes(exam.id) ? 'dashboard-check checked' : 'dashboard-check'}
                    onClick={() => toggleExamReviewed(exam.id)}
                    type="button"
                  />
                </div>
              </article>
            ))}
            {!upcomingExams.length ? (
              <EmptyState
                actionLabel="Add an exam"
                actionTo="/planner"
                description="Exam countdowns and revision reminders show up here once you add dates."
                title="No exams added"
              />
            ) : null}
          </div>
        </section>

        <section className="dashboard-tool-grid">
          <DashboardTool title="AI Tutor" text="Explain difficult topics and generate flashcards." to="/ai-tutor" />
          <DashboardTool title="Quiz Center" text="Turn weak topics into active-recall quizzes." to="/quiz" />
          <DashboardTool title="Analytics" text="Review focus score and study minutes." to="/analytics" />
          <DashboardTool title="Burnout Check" text="Scan fatigue and get recovery steps." to="/burnout" />
        </section>
      </main>
    </PageShell>
  )
}

function DashboardMetric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article className="dashboard-clean-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  )
}

function DashboardTool({ title, text, to }: { title: string; text: string; to: string }) {
  return (
    <Link className="page-card dashboard-tool-card" to={to}>
      <strong>{title}</strong>
      <span>{text}</span>
    </Link>
  )
}
